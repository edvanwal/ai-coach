"use client";

import { useState, useRef, useEffect } from "react";
import type { Profile } from "@/lib/types";
import type { Task } from "@/lib/types";
import type { ChatMessage } from "@/lib/types";

type ConversationItem = { id: string; title: string; createdAt: string };

interface ChatInterfaceProps {
  profile: Profile | null;
  tasks: Task[];
  onTasksChanged?: () => void;
}

export function ChatInterface({ profile, tasks, onTasksChanged }: ChatInterfaceProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [listeningMode, setListeningMode] = useState<"conversation" | "dictation" | null>(null);
  const [isConversationModeActive, setIsConversationModeActive] = useState(false);
  const [recordingSupported, setRecordingSupported] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const conversationModeRef = useRef(false);
  const interruptStreamRef = useRef<MediaStream | null>(null);
  const interruptIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interruptCtxRef = useRef<AudioContext | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const currentConvIdRef = useRef<string | null>(null);
  const hasContent = input.trim().length > 0;
  messagesRef.current = messages;
  currentConvIdRef.current = currentConversationId;

  async function loadConversations() {
    const r = await fetch("/api/conversations", { cache: "no-store" });
    const d = await r.json();
    if (!Array.isArray(d.conversations)) return;
    if (d.conversations.length === 0) {
      const createRes = await fetch("/api/conversations", { method: "POST", cache: "no-store" });
      const createData = await createRes.json();
      if (createData.id) {
        setConversations([{ id: createData.id, title: createData.title, createdAt: createData.createdAt }]);
        setCurrentConversationId(createData.id);
      }
      return;
    }
    setConversations(d.conversations);
    setCurrentConversationId((prev) => prev || d.conversations[0].id);
  }

  async function loadMessages(conversationId: string) {
    const r = await fetch(`/api/conversation?conversationId=${encodeURIComponent(conversationId)}`, {
      cache: "no-store",
    });
    const d = await r.json();
    if (Array.isArray(d.messages)) {
      setMessages(d.messages);
    } else {
      setMessages([]);
    }
  }

  async function deleteConversation(id: string) {
    if (!confirm("Weet je het zeker? Dit gesprek en alle berichten worden verwijderd.")) return;
    const r = await fetch(`/api/conversations/${id}`, { method: "DELETE", cache: "no-store" });
    if (r.ok) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversationId === id) {
        const rest = conversations.filter((c) => c.id !== id);
        if (rest.length > 0) {
          setCurrentConversationId(rest[0].id);
        } else {
          createNewConversation();
        }
      }
      setEditingConversationId(null);
    }
  }

  async function updateConversationTitle(id: string, newTitle: string) {
    const title = newTitle.trim();
    if (!title) return;
    const r = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
      cache: "no-store",
    });
    if (r.ok) {
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    }
    setEditingConversationId(null);
  }

  async function createNewConversation() {
    const r = await fetch("/api/conversations", {
      method: "POST",
      cache: "no-store",
    });
    const d = await r.json();
    if (d.id) {
      setCurrentConversationId(d.id);
      setMessages([]);
      setConversations((prev) => [{ id: d.id, title: d.title, createdAt: d.createdAt }, ...prev]);
      setSidebarOpen(false);
    }
  }

  useEffect(() => {
    setRecordingSupported(
      typeof window !== "undefined" &&
        !!navigator.mediaDevices &&
        typeof MediaRecorder !== "undefined"
    );
    loadConversations();
    return () => {
      vadIntervalRef.current && clearInterval(vadIntervalRef.current);
      interruptIntervalRef.current && clearInterval(interruptIntervalRef.current);
      interruptStreamRef.current?.getTracks().forEach((t) => t.stop());
      interruptCtxRef.current?.close();
      recorderRef.current?.stop();
      currentAudioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId);
    } else {
      setMessages([]);
    }
  }, [currentConversationId]);

  function stopInterruptListener() {
    if (interruptIntervalRef.current) {
      clearInterval(interruptIntervalRef.current);
      interruptIntervalRef.current = null;
    }
    interruptCtxRef.current?.close();
    interruptCtxRef.current = null;
    interruptStreamRef.current?.getTracks().forEach((t) => t.stop());
    interruptStreamRef.current = null;
  }

  function exitConversationMode() {
    currentAudioRef.current?.pause();
    stopInterruptListener();
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    conversationModeRef.current = false;
    setListeningMode(null);
    setIsConversationModeActive(false);
    setIsListening(false);
  }

  async function startInterruptListener() {
    if (!conversationModeRef.current || !recordingSupported) return;
    stopInterruptListener();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      interruptStreamRef.current = stream;
      const ctx = new AudioContext();
      interruptCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const VOLUME_THRESHOLD = 20;
      const SPEECH_MS = 300;
      let speechStart = 0;

      interruptIntervalRef.current = setInterval(() => {
        if (!conversationModeRef.current || recorderRef.current) return;
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
          if (avg > VOLUME_THRESHOLD) {
          if (speechStart === 0) speechStart = Date.now();
          else if (Date.now() - speechStart >= SPEECH_MS) {
            stopInterruptListener();
            currentAudioRef.current?.pause();
            startListening(true);
          }
        } else {
          speechStart = 0;
        }
      }, 100);
    } catch {
      stopInterruptListener();
    }
  }

  async function speakText(text: string, onEnded?: () => void) {
    setTtsError(null);
    try {
      currentAudioRef.current?.pause();
      const res = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        cache: "no-store",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = err?.error ?? `Serverfout ${res.status}`;
        setTtsError(msg);
        onEnded?.();
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      audio.onended = () => {
        stopInterruptListener();
        URL.revokeObjectURL(url);
        onEnded?.();
      };
      await audio.play();
      if (conversationModeRef.current) startInterruptListener();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Spraak mislukt";
      setTtsError(msg);
      onEnded?.();
    }
  }

  async function startListening(enterConversationMode = false) {
    if (!recordingSupported || loading) return;
    stopInterruptListener();
    setListeningMode(enterConversationMode ? "conversation" : "dictation");
    if (enterConversationMode) {
      conversationModeRef.current = true;
      setIsConversationModeActive(true);
    } else {
      // Explicit dictation mode should never inherit conversation mode.
      conversationModeRef.current = false;
      setIsConversationModeActive(false);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      // VAD: stiltedetectie – na ~1.5s stilte automatisch stoppen
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let lastSpeechTime = 0;
      let hasHeardSpeech = false;
      const SILENCE_MS = 1500;
      const VOLUME_THRESHOLD = 15;
      const MAX_RECORDING_MS = 60000;
      const recordStart = Date.now();

      vadIntervalRef.current = setInterval(() => {
        if (!recorderRef.current || recorderRef.current.state !== "recording") return;
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        if (avg > VOLUME_THRESHOLD) {
          hasHeardSpeech = true;
          lastSpeechTime = Date.now();
        } else if (hasHeardSpeech && Date.now() - lastSpeechTime > SILENCE_MS) {
          vadIntervalRef.current && clearInterval(vadIntervalRef.current);
          vadIntervalRef.current = null;
          recorderRef.current?.stop();
          recorderRef.current = null;
        } else if (Date.now() - recordStart > MAX_RECORDING_MS) {
          vadIntervalRef.current && clearInterval(vadIntervalRef.current);
          vadIntervalRef.current = null;
          recorderRef.current?.stop();
          recorderRef.current = null;
        }
      }, 150);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        vadIntervalRef.current && clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = null;
        ctx.close();
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        // Zeer korte/stille opnames → Whisper hallucineert vaak ("Ja", "Oké", etc.)
        const MIN_BLOB_BYTES = 8000; // ~1 sec spraak
        if (blob.size < MIN_BLOB_BYTES) {
          stream.getTracks().forEach((t) => t.stop());
          setIsListening(false);
          setListeningMode(null);
          return;
        }
        const formData = new FormData();
        formData.append("file", blob, "spraak.webm");
        const transcribeController = new AbortController();
        const transcribeTimeout = setTimeout(() => transcribeController.abort(), 30000);
        const HALLUCINATION_PHRASES = ["ja", "oké", "ok", "ja natuurlijk", "ja, natuurlijk", "nee", "hmm", "uhu", "dank je", "bedankt"];
        try {
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
            cache: "no-store",
            signal: transcribeController.signal,
          });
          clearTimeout(transcribeTimeout);
          const data = await res.json();
          if (res.ok && data.text) {
            const text = data.text.trim();
            if (!text) return;
            const lower = text.toLowerCase().replace(/[.,!?]+$/, "");
            const isLikelyHallucination = HALLUCINATION_PHRASES.includes(lower) || (text.length <= 15 && HALLUCINATION_PHRASES.some((p) => lower.includes(p)));
            if (conversationModeRef.current && text && !isLikelyHallucination) {
              await sendVoiceMessage(text);
            } else if (text) {
              setInput((prev) => (prev ? prev + " " + text : text).trim());
            }
          }
        } finally {
          clearTimeout(transcribeTimeout);
          stream.getTracks().forEach((track) => track.stop());
          setIsListening(false);
          setListeningMode(null);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setIsListening(true);
    } catch {
      setIsListening(false);
      setListeningMode(null);
    }
  }

  async function ensureConversation(): Promise<string> {
    const id = currentConvIdRef.current;
    if (id) return id;
    const r = await fetch("/api/conversations", { method: "POST", cache: "no-store" });
    const d = await r.json();
    if (!d.id) {
      throw new Error(d?.error ?? "Kon geen gesprek aanmaken");
    }
    currentConvIdRef.current = d.id;
    setConversations((prev) => [{ id: d.id, title: d.title, createdAt: d.createdAt }, ...prev]);
    setCurrentConversationId(d.id);
    return d.id;
  }

  async function streamAndSpeak(
    currentMessages: ChatMessage[],
    onStreamEnd?: () => void,
    withSpeech = false
  ): Promise<string> {
    const convId = await ensureConversation();
    let fullContent = "";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: currentMessages,
        conversationId: convId,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Fout bij chat");
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Geen stream");
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload);
          if (parsed?.error) throw new Error(parsed.error);
          if (parsed?.taskCreated) onTasksChanged?.();
          if (typeof parsed === "string") fullContent += parsed;
        } catch (e) {
          if (e instanceof Error && e.message !== "Unexpected end of JSON input") throw e;
        }
      }
      setMessages((prev) => {
        const next = [...prev];
        const last = next.length - 1;
        if (last >= 0 && next[last].role === "assistant")
          next[last] = { ...next[last], content: fullContent || "..." };
        else next.push({ role: "assistant", content: fullContent || "..." });
        return next;
      });
    }
    if (convId && currentMessages.length === 1) {
      const title =
        currentMessages[0].content.slice(0, 50).trim() +
        (currentMessages[0].content.length > 50 ? "…" : "");
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title } : c))
      );
    }
    if (withSpeech) speakText(fullContent, onStreamEnd);
    else onStreamEnd?.();
    return fullContent;
  }

  async function sendVoiceMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMessage: ChatMessage = { role: "user", content: text.trim() };
    const currentMessages = [...messagesRef.current, userMessage];
    setMessages(currentMessages);
    setInput("");
    setLoading(true);
    try {
      setMessages((prev) => [...prev, { role: "assistant", content: "..." }]);
      await streamAndSpeak(
        currentMessages,
        () => {
          if (conversationModeRef.current) {
            setTimeout(() => startListening(true), 400);
          }
        },
        true
      );
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "Verzoek duurde te lang. Probeer het opnieuw."
          : err instanceof Error
            ? err.message
            : "Onbekend";
      setMessages((prev) => {
        const next = [...prev];
        const last = next.length - 1;
        if (last >= 0 && next[last].role === "assistant" && next[last].content === "...")
          next[last] = { ...next[last], content: `Fout: ${msg}` };
        else next.push({ role: "assistant", content: `Fout: ${msg}` });
        return next;
      });
      conversationModeRef.current = false;
      setIsConversationModeActive(false);
    } finally {
      setLoading(false);
    }
  }

  function stopListening() {
    if (conversationModeRef.current) {
      exitConversationMode();
      return;
    }
    setListeningMode(null);
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function toggleVoice() {
    if (isListening) stopListening();
    else startListening();
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const currentMessages = [...messagesRef.current, userMessage];
    setMessages([...currentMessages, { role: "assistant", content: "..." }]);
    setInput("");
    setLoading(true);

    try {
      await streamAndSpeak(currentMessages);
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "Verzoek duurde te lang. Probeer het opnieuw."
          : err instanceof Error
            ? err.message
            : "Onbekend";
      setMessages((prev) => {
        const next = [...prev];
        const last = next.length - 1;
        if (last >= 0 && next[last].role === "assistant" && next[last].content === "...")
          next[last] = { ...next[last], content: `Fout: ${msg}` };
        else next.push({ role: "assistant", content: `Fout: ${msg}` });
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  function selectConversation(id: string) {
    setCurrentConversationId(id);
    setSidebarOpen(false);
  }

  return (
    <div className="chat-layout">
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title={sidebarOpen ? "Sidebar sluiten" : "Gesprekken tonen"}
        aria-label={sidebarOpen ? "Sidebar sluiten" : "Gesprekken tonen"}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <button
          type="button"
          className="new-chat-btn"
          onClick={createNewConversation}
        >
          + Nieuw gesprek
        </button>
        <ul className="conversation-list">
          {conversations.map((c) => (
            <li key={c.id} className="conv-row">
              {editingConversationId === c.id ? (
                <input
                  type="text"
                  className="conv-edit-input"
                  defaultValue={c.title === "Nieuw gesprek" ? "" : c.title}
                  placeholder="Titel"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      updateConversationTitle(c.id, (e.target as HTMLInputElement).value);
                    } else if (e.key === "Escape") {
                      setEditingConversationId(null);
                    }
                  }}
                  onBlur={(e) => {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) updateConversationTitle(c.id, v);
                    else setEditingConversationId(null);
                  }}
                />
              ) : (
                <>
                  <button
                    type="button"
                    className={`conv-item ${c.id === currentConversationId ? "active" : ""}`}
                    onClick={() => selectConversation(c.id)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      setEditingConversationId(c.id);
                    }}
                  >
                    {c.title === "Nieuw gesprek" ? "Leeg gesprek" : c.title}
                  </button>
                  <button
                    type="button"
                    className="conv-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(c.id);
                    }}
                    title="Verwijderen"
                    aria-label="Gesprek verwijderen"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </aside>
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          role="presentation"
        />
      )}
    <div className="chat">
      {messages.length === 0 && (
        <div className="welkom">
          <p>Hallo. Ik ben je persoonlijke AI-coach.</p>
          <p>
            Klik op het blauwe rondje om te spreken – het herkent zelf wanneer je
            stopt. Je kunt direct doorspreken na elk antwoord.
          </p>
          <p>Of typ in de chatbalk. Vul je profiel in voor betere adviezen.</p>
        </div>
      )}
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <span className="role">
              {m.role === "user" ? "Jij" : "Coach"}
              {m.role === "assistant" && (
                <button
                  type="button"
                  className="replay-btn"
                  onClick={() => speakText(m.content)}
                  title="Antwoord opnieuw afspelen"
                >
                  🔊
                </button>
              )}
            </span>
            <div className="content">{m.content}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="input-bar">
        <button type="button" className="plus-btn" title="Opties" aria-label="Opties">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <div className="input-wrap">
          {listeningMode === "dictation" ? (
            <div className="soundwave-visual">
              <span className="sw-bar" />
              <span className="sw-bar" />
              <span className="sw-bar" />
              <span className="sw-bar" />
              <span className="sw-bar" />
              <span className="sw-bar" />
              <span className="sw-bar" />
              <span className="sw-bar" />
              <span className="sw-bar" />
              <span className="sw-bar" />
            </div>
          ) : (
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Stel een vraag"
              disabled={loading}
              aria-label="Chatbericht invoeren"
            />
          )}
          {recordingSupported && (
            <button
              type="button"
              className={`mic-inline ${listeningMode === "dictation" ? "listening" : ""}`}
              onClick={toggleVoice}
              disabled={loading}
              title={listeningMode === "dictation" ? "Klaar met spreken" : "Spraak naar tekst"}
              aria-label={listeningMode === "dictation" ? "Stop" : "Spraak"}
            >
              {listeningMode === "dictation" ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
          )}
        </div>
        <button
          type={hasContent && !isConversationModeActive ? "submit" : "button"}
          className={`send-btn ${isConversationModeActive ? "listening" : ""}`}
          disabled={loading}
          aria-label={
            isConversationModeActive
              ? "Spraakmodus uitzetten"
              : hasContent
              ? "Verstuur bericht"
              : "Spreek tegen de coach"
          }
          title={
            isConversationModeActive
              ? "Spraakmodus uitzetten"
              : hasContent
              ? "Verstuur"
              : "Spreek tegen de coach"
          }
          onClick={
            isConversationModeActive
              ? exitConversationMode
              : !hasContent && !isListening
                ? () => startListening(true)
                : undefined
          }
        >
          {isConversationModeActive || !hasContent ? (
            <svg
              className={isConversationModeActive ? "waves-animate" : ""}
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="4" y="8" width="3" height="8" rx="1" />
              <rect x="10" y="5" width="3" height="14" rx="1" />
              <rect x="16" y="10" width="3" height="4" rx="1" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3L4 11h5v10h6V11h5L12 3z" />
            </svg>
          )}
        </button>
      </form>
      {ttsError && (
        <p className="tts-error" role="alert">{ttsError}</p>
      )}
    </div>
      <style jsx>{`
        .chat-layout {
          display: flex;
          position: relative;
          flex: 1;
          min-height: 0;
        }
        .sidebar-toggle {
          position: absolute;
          top: 0;
          left: 0;
          z-index: 20;
          padding: 0.5rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
          cursor: pointer;
        }
        .sidebar-toggle:hover {
          background: var(--surface-hover);
        }
        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          width: 260px;
          height: 100vh;
          background: var(--surface);
          border-right: 1px solid var(--border);
          padding: 3rem 0 1rem 1rem;
          transform: translateX(-100%);
          transition: transform 0.2s;
          z-index: 30;
          overflow-y: auto;
        }
        .sidebar.open {
          transform: translateX(0);
        }
        @media (min-width: 768px) {
          .sidebar {
            position: relative;
            transform: none;
            flex-shrink: 0;
            height: calc(100vh - 180px);
            min-height: 400px;
          }
          .sidebar.open {
            transform: none;
          }
          .sidebar-toggle {
            display: none;
          }
        }
        .sidebar-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.3);
          z-index: 25;
        }
        @media (min-width: 768px) {
          .sidebar-overlay {
            display: none !important;
          }
        }
        .new-chat-btn {
          width: 100%;
          padding: 0.6rem 1rem;
          margin-bottom: 1rem;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          text-align: left;
        }
        .new-chat-btn:hover {
          opacity: 0.9;
        }
        .conversation-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .conversation-list li {
          margin-bottom: 0.25rem;
        }
        .conv-row {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }
        .conv-item {
          flex: 1;
          min-width: 0;
          padding: 0.5rem 1rem;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: var(--text);
          font-size: 0.9rem;
          text-align: left;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .conv-item:hover {
          background: var(--surface-hover);
        }
        .conv-item.active {
          background: var(--accent-soft);
          color: var(--accent);
        }
        .conv-edit-input {
          flex: 1;
          padding: 0.5rem 1rem;
          background: var(--surface);
          border: 1px solid var(--accent);
          border-radius: 8px;
          color: var(--text);
          font-size: 0.9rem;
          min-width: 0;
        }
        .conv-edit-input:focus {
          outline: none;
        }
        .conv-delete {
          flex-shrink: 0;
          padding: 0.35rem;
          background: transparent;
          border: none;
          border-radius: 4px;
          color: var(--text-muted);
          cursor: pointer;
        }
        .conv-delete:hover {
          color: #f85149;
          background: rgba(248,81,73,0.1);
        }
        .chat {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: calc(100vh - 180px);
          min-height: 400px;
          padding-left: 0;
          min-width: 0;
        }
        @media (min-width: 768px) {
          .chat {
            padding-left: 1rem;
          }
        }
        .welkom {
          padding: 1rem;
          color: var(--text-muted);
          font-size: 0.95rem;
        }
        .welkom p {
          margin: 0 0 0.5rem 0;
        }
        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 0;
        }
        .msg {
          margin-bottom: 1rem;
          padding: 1rem 1.25rem;
          border-radius: 18px;
          max-width: 85%;
        }
        .msg.user {
          margin-left: auto;
          background: var(--accent);
          color: white;
        }
        .msg.assistant {
          background: var(--surface);
          border: 1px solid var(--border);
        }
        .role {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-bottom: 0.35rem;
        }
        .msg.user .role {
          color: rgba(255,255,255,0.8);
        }
        .replay-btn {
          padding: 0.15rem 0.35rem;
          font-size: 0.8rem;
          background: transparent;
          opacity: 0.7;
        }
        .replay-btn:hover {
          opacity: 1;
        }
        .tts-error {
          margin: 0.5rem 0 0;
          padding-left: 0.5rem;
          font-size: 0.85rem;
          color: #f85149;
        }
        .content {
          white-space: pre-wrap;
        }
        .input-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 24px;
          margin-top: 0.5rem;
        }
        .plus-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          color: var(--text-muted);
          border-radius: 50%;
          flex-shrink: 0;
        }
        .plus-btn:hover {
          background: var(--surface-hover);
          color: var(--text);
        }
        .input-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          min-width: 0;
        }
        .input-wrap input {
          flex: 1;
          border: none;
          background: transparent;
          color: var(--text);
          font-size: 1rem;
          padding: 0.5rem 0.75rem;
          min-width: 0;
        }
        .input-wrap input::placeholder {
          color: var(--text-muted);
        }
        .input-wrap input:focus {
          outline: none;
        }
        .soundwave-visual {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 0 0.5rem;
          min-height: 24px;
        }
        .soundwave-visual .sw-bar {
          width: 4px;
          height: 8px;
          background: var(--accent);
          border-radius: 2px;
          animation: swPulse 0.8s ease-in-out infinite;
        }
        .soundwave-visual .sw-bar:nth-child(1) { animation-delay: 0ms; height: 6px; }
        .soundwave-visual .sw-bar:nth-child(2) { animation-delay: 80ms; height: 12px; }
        .soundwave-visual .sw-bar:nth-child(3) { animation-delay: 160ms; height: 8px; }
        .soundwave-visual .sw-bar:nth-child(4) { animation-delay: 240ms; height: 14px; }
        .soundwave-visual .sw-bar:nth-child(5) { animation-delay: 320ms; height: 10px; }
        .soundwave-visual .sw-bar:nth-child(6) { animation-delay: 400ms; height: 14px; }
        .soundwave-visual .sw-bar:nth-child(7) { animation-delay: 320ms; height: 10px; }
        .soundwave-visual .sw-bar:nth-child(8) { animation-delay: 240ms; height: 14px; }
        .soundwave-visual .sw-bar:nth-child(9) { animation-delay: 160ms; height: 8px; }
        .soundwave-visual .sw-bar:nth-child(10) { animation-delay: 80ms; height: 12px; }
        @keyframes swPulse {
          0%, 100% { transform: scaleY(0.5); opacity: 0.7; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        .mic-inline {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          color: var(--text-muted);
          border-radius: 50%;
          transition: all 0.2s;
        }
        .mic-inline:hover {
          color: var(--text);
        }
        .mic-inline.listening {
          color: var(--accent);
          background: var(--accent-soft);
        }
        .mic-inline.listening .waves-animate {
          animation: waves 0.6s ease-in-out infinite;
        }
        .waves-animate {
          animation: waves 0.6s ease-in-out infinite;
        }
        @keyframes waves {
          0%, 100% { transform: scaleY(0.7); opacity: 0.8; }
          50% { transform: scaleY(1.1); opacity: 1; }
        }
        .send-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent);
          color: white;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .send-btn.listening {
          animation: pulse 1.2s ease-in-out infinite;
        }
        .send-btn.listening .waves-animate {
          animation: waves 0.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}
