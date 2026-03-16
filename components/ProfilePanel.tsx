"use client";

import { useState, useEffect } from "react";
import { FileUpload } from "./FileUpload";
import type { Profile } from "@/lib/types";

interface ProfilePanelProps {
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
}

export function ProfilePanel({ profile, setProfile }: ProfilePanelProps) {
  const [saved, setSaved] = useState<"ok" | "error" | null>(null);
  const [saveError, setSaveError] = useState<string>("");
  const [adhdContext, setAdhdContext] = useState(profile?.adhdContext ?? "");
  const [situatie, setSituatie] = useState(profile?.situatie ?? "");
  const [doelen, setDoelen] = useState(profile?.doelen ?? "");
  const [persoonlijkheid, setPersoonlijkheid] = useState(
    profile?.persoonlijkheid ?? ""
  );

  // Sync form met profiel uit parent (bijv. na laden uit localStorage)
  useEffect(() => {
    if (profile) {
      setAdhdContext(profile.adhdContext ?? "");
      setSituatie(profile.situatie ?? "");
      setDoelen(profile.doelen ?? "");
      setPersoonlijkheid(profile.persoonlijkheid ?? "");
    }
  }, [profile?.adhdContext, profile?.situatie, profile?.doelen, profile?.persoonlijkheid]);

  async function handleSave() {
        setSaved(null);
        setSaveError("");
    const p: Profile = {
      adhdContext: adhdContext.trim(),
      situatie: situatie.trim(),
      doelen: doelen.trim(),
      persoonlijkheid: persoonlijkheid.trim() || undefined,
    };
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
      cache: "no-store",
    });
    if (res.ok) {
      setProfile(p);
      setSaved("ok");
      setTimeout(() => setSaved(null), 2000);
    } else {
      const json = await res.json().catch(() => ({}));
      setSaved("error");
      setSaveError(json.error ?? "Onbekende fout");
    }
  }

  return (
    <div className="panel">
      <p className="intro">
        Vul je context in. De coach gebruikt dit voor gerichte adviezen.
      </p>
      <div className="field">
        <label>ADHD / ADD context</label>
        <textarea
          value={adhdContext}
          onChange={(e) => setAdhdContext(e.target.value)}
          placeholder="Bijv: uitstelgedrag bij vervelende taken, hyperfocus bij leuke taken, pas op vijftigste ontdekt..."
          rows={3}
        />
      </div>
      <div className="field">
        <label>Levenssituatie</label>
        <textarea
          value={situatie}
          onChange={(e) => setSituatie(e.target.value)}
          placeholder="Bijv: gescheiden, verbouwing, financiële zorgen, nieuw huis..."
          rows={3}
        />
      </div>
      <div className="field">
        <label>Doelen</label>
        <textarea
          value={doelen}
          onChange={(e) => setDoelen(e.target.value)}
          placeholder="Kort en lang termijn doelen..."
          rows={3}
        />
      </div>
      <div className="field">
        <label>Persoonlijkheidsprofiel (optioneel)</label>
        <textarea
          value={persoonlijkheid}
          onChange={(e) => setPersoonlijkheid(e.target.value)}
          placeholder="Plak hier resultaten van tests (Big Five, MBTI, etc.)"
          rows={4}
        />
      </div>
      <div className="save-row">
        <button className="save" onClick={handleSave}>
          Opslaan
        </button>
        {saved === "ok" && <span className="feedback ok">Opgeslagen</span>}
        {saved === "error" && (
          <span className="feedback error" title={saveError}>
            Opslaan mislukt{saveError ? `: ${saveError}` : ""}
          </span>
        )}
      </div>
      <FileUpload />
      <style jsx>{`
        .panel {
          max-width: 600px;
        }
        .intro {
          color: var(--text-muted);
          margin-bottom: 1.5rem;
        }
        .field {
          margin-bottom: 1rem;
        }
        .field label {
          display: block;
          font-size: 0.9rem;
          font-weight: 500;
          margin-bottom: 0.35rem;
        }
        .field textarea {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-sm);
          resize: vertical;
        }
        .save-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-top: 0.5rem;
        }
        .save {
          padding: 0.75rem 1.5rem;
          background: var(--accent);
          color: white;
          font-weight: 500;
        }
        .feedback {
          font-size: 0.9rem;
        }
        .feedback.ok {
          color: var(--success, #22c55e);
        }
        .feedback.error {
          color: #f85149;
        }
      `}</style>
    </div>
  );
}
