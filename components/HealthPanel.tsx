"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { HealthOverviewResponse } from "@/lib/types";
import { computeHealthInsights } from "@/lib/health/insights";

export function HealthPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<HealthOverviewResponse | null>(null);
  const [weight, setWeight] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [activityMinutes, setActivityMinutes] = useState("");
  const [goalWeight, setGoalWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  const insights = useMemo(
    () => (data ? computeHealthInsights(data) : []),
    [data]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/health/overview?days=30", { cache: "no-store" });
      const json = (await res.json()) as HealthOverviewResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Laden mislukt");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const w = parseFloat(weight.replace(",", "."));
    const sleep = sleepHours ? parseFloat(sleepHours.replace(",", ".")) : null;
    const activity = activityMinutes ? parseFloat(activityMinutes.replace(",", ".")) : null;
    if (Number.isNaN(w) || w <= 0 || w > 300) return;
    if (sleep != null && (Number.isNaN(sleep) || sleep < 0 || sleep > 24)) return;
    if (activity != null && (Number.isNaN(activity) || activity < 0 || activity > 1440)) return;
    setSaving(true);
    setError("");
    try {
      const body: { weightKg?: number; sleepHours?: number; activityMinutes?: number } = { weightKg: w };
      if (sleep != null) body.sleepHours = sleep;
      if (activity != null) body.activityMinutes = activity;
      const res = await fetch("/api/health/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Opslaan mislukt");
      setWeight("");
      setSleepHours("");
      setActivityMinutes("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setSaving(false);
    }
  }

  async function handleGoalSubmit(e: React.FormEvent) {
    e.preventDefault();
    const target = parseFloat(goalWeight.replace(",", "."));
    if (Number.isNaN(target) || target <= 0 || target > 300) return;
    setSavingGoal(true);
    setError("");
    try {
      const res = await fetch("/api/health/goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "weight", targetValue: target }),
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Doel opslaan mislukt");
      setGoalWeight("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setSavingGoal(false);
    }
  }

  const progressText = (() => {
    if (!data?.goals?.length || !data.latestWeight || !data.latestWeightDate) return null;
    const goal = data.goals.find((g) => g.kind === "weight");
    if (!goal || goal.targetValue <= 0) return null;
    const diff = data.latestWeight - goal.targetValue;
    const date = new Date(data.latestWeightDate);
    const formatted = date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
    if (Math.abs(diff) < 0.1) return `Op schema: ${data.latestWeight} kg (${formatted})`;
    if (diff < 0) return `Je zit nu ${Math.abs(diff).toFixed(1)} kg onder je doel (laatste meting ${formatted})`;
    return `Nog ${diff.toFixed(1)} kg tot je doel (laatste meting ${formatted})`;
  })();

  return (
    <div className="panel">
      <div className="intro">
        <h3>Gezondheid</h3>
        <p>
          Dit helpt je zien hoe je lijf reageert op je week. Log je gewicht regelmatig – de coach gebruikt dit voor rustige, persoonlijke inzichten.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="entry-form">
        <div className="form-row main-row">
          <div>
            <label htmlFor="health-weight">Gewicht (kg)</label>
            <input
              id="health-weight"
              type="text"
              inputMode="decimal"
              placeholder="bijv. 72,5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              disabled={saving}
              className="main-input"
            />
          </div>
          <div>
            <label htmlFor="health-sleep">Slaap (uur)</label>
            <input
              id="health-sleep"
              type="text"
              inputMode="decimal"
              placeholder="optioneel"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              disabled={saving}
              className="opt-input"
            />
          </div>
          <div>
            <label htmlFor="health-activity">Beweging (min)</label>
            <input
              id="health-activity"
              type="text"
              inputMode="decimal"
              placeholder="optioneel"
              value={activityMinutes}
              onChange={(e) => setActivityMinutes(e.target.value)}
              disabled={saving}
              className="opt-input"
            />
          </div>
          <div className="submit-wrap">
            <button type="submit" className="primary" disabled={saving || !weight.trim()}>
              {saving ? "Opslaan…" : "Loggen"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading && !data && (
        <p className="leeg" role="status">Laden…</p>
      )}

      {data && (
        <>
          {insights.length > 0 && (
            <div className="insights-block">
              <h4>Signalen</h4>
              <ul className="insights">
                {insights.slice(0, 3).map((i, idx) => (
                  <li key={idx} className={`insight ${i.severity}`}>
                    <div className="ins-title">{i.title}</div>
                    <div className="ins-detail">{i.detail}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.goals?.length === 0 && (
            <form onSubmit={handleGoalSubmit} className="goal-form">
              <label htmlFor="health-goal">Streefgewicht (kg)</label>
              <input
                id="health-goal"
                type="text"
                inputMode="decimal"
                placeholder="bijv. 72"
                value={goalWeight}
                onChange={(e) => setGoalWeight(e.target.value)}
                disabled={savingGoal}
              />
              <button type="submit" disabled={savingGoal || !goalWeight.trim()}>
                Doel stellen
              </button>
            </form>
          )}

          {progressText && data.goals?.length > 0 && (
            <div className="progress-card">
              <div className="label">Voortgang</div>
              <div className="value">{progressText}</div>
            </div>
          )}

          <div className="lijst">
            <h4>Laatste metingen</h4>
            {data.entries.length === 0 ? (
              <p className="leeg">Nog geen metingen. Log je eerste gewicht hierboven.</p>
            ) : (
              <ul>
                {data.entries.slice(0, 14).map((e) => (
                  <li key={e.id}>
                    <span className="date">
                      {new Date(e.date).toLocaleDateString("nl-NL", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span className="vals">
                      {e.weightKg != null && <span>{e.weightKg} kg</span>}
                      {e.sleepHours != null && <span>{e.sleepHours}u slaap</span>}
                      {e.activityMinutes != null && <span>{e.activityMinutes} min beweging</span>}
                      {e.note && <span className="note">{e.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="button" className="secondary" onClick={refresh} disabled={loading}>
            Ververs
          </button>
        </>
      )}

      <style jsx>{`
        .intro {
          margin-bottom: 1.25rem;
        }
        h3 {
          margin: 0;
          font-size: 1.05rem;
        }
        .intro p {
          margin: 0.35rem 0 0 0;
          color: var(--text-muted);
          font-size: 0.9rem;
          line-height: 1.5;
          max-width: 55ch;
        }
        .entry-form {
          margin-bottom: 1rem;
        }
        .form-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem 1.25rem;
          align-items: flex-end;
        }
        .entry-form label {
          display: block;
          font-size: 0.9rem;
          font-weight: 500;
          margin-bottom: 0.25rem;
        }
        .main-input {
          width: 100%;
          max-width: 100px;
          padding: 0.75rem 1rem;
          font-size: 1.1rem;
          min-height: 48px;
        }
        .opt-input {
          width: 100%;
          max-width: 80px;
          padding: 0.6rem 0.75rem;
          font-size: 1rem;
          min-height: 44px;
        }
        .submit-wrap {
          align-self: flex-end;
        }
        .primary {
          padding: 0.75rem 1.25rem;
          background: var(--accent);
          color: white;
          font-weight: 550;
          min-height: 48px;
        }
        .primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .error {
          color: #f85149;
          margin: 0 0 1rem 0;
        }
        .leeg {
          color: var(--text-muted);
          margin: 0;
        }
        .progress-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 0.9rem 1rem;
          margin-bottom: 1.25rem;
        }
        .progress-card .label {
          color: var(--text-muted);
          font-size: 0.85rem;
        }
        .progress-card .value {
          margin-top: 0.2rem;
          font-weight: 550;
        }
        .lijst {
          margin-bottom: 1rem;
        }
        .lijst h4 {
          margin: 0 0 0.75rem 0;
          font-size: 1rem;
        }
        ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        li {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 1rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border);
        }
        .date {
          color: var(--text-muted);
          font-size: 0.9rem;
        }
        .vals {
          display: flex;
          flex-wrap: wrap;
          gap: 0 0.75rem;
          font-variant-numeric: tabular-nums;
        }
        .vals .note {
          color: var(--text-muted);
          font-style: italic;
        }
        .secondary {
          padding: 0.5rem 1rem;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
        }
        .insights-block {
          margin-bottom: 1rem;
        }
        .insights-block h4 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
        }
        .insights {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 0.5rem;
        }
        .insight {
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 0.65rem 0.9rem;
          background: rgba(255, 255, 255, 0.02);
        }
        .insight.warn {
          border-color: rgba(210, 153, 34, 0.45);
          background: rgba(210, 153, 34, 0.06);
        }
        .ins-title {
          font-weight: 600;
          margin-bottom: 0.2rem;
        }
        .ins-detail {
          color: var(--text-muted);
          font-size: 0.85rem;
          line-height: 1.4;
        }
        .goal-form {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem 1rem;
          align-items: flex-end;
          margin-bottom: 1rem;
        }
        .goal-form label {
          display: block;
          font-size: 0.9rem;
          margin-bottom: 0.25rem;
        }
        .goal-form input {
          max-width: 120px;
          padding: 0.5rem 0.75rem;
        }
        .goal-form button {
          padding: 0.5rem 1rem;
          background: var(--accent);
          color: white;
        }
        .goal-form button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
