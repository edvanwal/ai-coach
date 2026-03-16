/**
 * TTS-providerlaag: wisselt tussen OpenAI en ElevenLabs via TTS_PROVIDER.
 * Retourneert altijd MP3-audio als ArrayBuffer.
 */

export type TTSProvider = "openai" | "elevenlabs";

export async function generateSpeech(text: string): Promise<ArrayBuffer> {
  const provider = (process.env.TTS_PROVIDER || "openai").toLowerCase() as TTSProvider;

  if (provider === "elevenlabs") {
    try {
      return await generateElevenLabsSpeech(text);
    } catch (e) {
      // Fallback naar OpenAI als ElevenLabs faalt (bijv. slechte key, quotum op)
      if (process.env.OPENAI_API_KEY) {
        return generateOpenAISpeech(text);
      }
      throw e;
    }
  }
  return generateOpenAISpeech(text);
}

async function generateOpenAISpeech(text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY niet geconfigureerd");

  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
  const voice = process.env.OPENAI_TTS_VOICE || "alloy";
  const speedEnv = process.env.OPENAI_TTS_SPEED;
  const speed = speedEnv ? Math.min(4, Math.max(0.25, parseFloat(speedEnv) || 1)) : 1;

  const body: Record<string, unknown> = {
    model,
    voice,
    input: text,
    format: "mp3",
  };
  if (speed !== 1) body.speed = speed;

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: { message?: string } })?.error?.message || "OpenAI TTS mislukt");
  }

  return res.arrayBuffer();
}

async function generateElevenLabsSpeech(text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY niet geconfigureerd");
  if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID niet geconfigureerd");

  const model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
  const speedEnv = process.env.ELEVENLABS_SPEED;
  const speed = speedEnv ? Math.min(2, Math.max(0.5, parseFloat(speedEnv) || 1)) : 1;

  const body: Record<string, unknown> = {
    text,
    model_id: model,
    voice_settings: {
      stability: 0.75,
      similarity_boost: 0.75,
      speed,
    },
  };

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { detail?: string | { message?: string }; message?: string };
    const detail = data.detail;
    const msg = typeof detail === "string" ? detail : detail?.message ?? data.message ?? "ElevenLabs TTS mislukt";
    throw new Error(msg);
  }

  return res.arrayBuffer();
}
