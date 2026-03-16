"use client";

import { useEffect, useMemo, useState } from "react";
import type { FinanceOverviewResponse } from "@/lib/types";
import { computeFinanceInsights } from "@/lib/finance/insights";

function formatEuro(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = (abs / 100).toFixed(2).replace(".", ",");
  return `${sign}€ ${euros}`;
}

export function FinancePanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<FinanceOverviewResponse | null>(null);
  const provider = "mock";

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      // Sync (mock) en daarna overview ophalen
      const syncRes = await fetch("/api/finance/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
        cache: "no-store",
      });
      if (!syncRes.ok) throw new Error("Sync mislukt");

      const res = await fetch(`/api/finance/overview?provider=${provider}`, { cache: "no-store" });
      const json = (await res.json()) as FinanceOverviewResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Finance laden mislukt");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const total = (data?.accounts ?? []).reduce((acc, a) => acc + a.balanceCents, 0);
    return { total };
  }, [data]);

  const insights = useMemo(() => (data ? computeFinanceInsights(data) : []), [data]);

  return (
    <div className="panel">
      <div className="top-row">
        <div>
          <h3>Financiën</h3>
          <p className="sub">
            Demo-gegevens (mock). Later koppelen we dit aan een PSD2 provider voor ING/Knab.
          </p>
        </div>
        <button className="primary" onClick={refresh} disabled={loading}>
          {loading ? "Laden..." : "Ververs"}
        </button>
      </div>

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
            <div className="lijst">
              <h3>Signalen</h3>
              <ul className="insights">
                {insights.slice(0, 4).map((i, idx) => (
                  <li key={idx} className={`insight ${i.severity}`}>
                    <div className="ins-title">{i.title}</div>
                    <div className="ins-detail">{i.detail}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="summary">
            <div className="card">
              <div className="label">Totaal saldo</div>
              <div className="value">{formatEuro(totals.total)}</div>
            </div>
          </div>

          <div className="lijst">
            <h3>Rekeningen</h3>
            <ul>
              {data.accounts.map((a) => (
                <li key={a.id}>
                  <span className="titel">{a.name}</span>
                  <span className="meta">{a.ibanMasked ?? ""}</span>
                  <span className="amount">{formatEuro(a.balanceCents)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lijst">
            <h3>Laatste transacties</h3>
            <ul>
              {data.transactions.slice(0, 12).map((t) => (
                <li key={t.id}>
                  <span className="titel">{t.description}</span>
                  <span className="meta">
                    {t.category ? `${t.category} · ` : ""}
                    {new Date(t.bookedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                  </span>
                  <span className={`amount ${t.amountCents < 0 ? "neg" : "pos"}`}>
                    {formatEuro(t.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <style jsx>{`
        .top-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        h3 {
          margin: 0;
          font-size: 1.05rem;
        }
        .sub {
          margin: 0.35rem 0 0 0;
          color: var(--text-muted);
          font-size: 0.9rem;
          max-width: 55ch;
        }
        .primary {
          padding: 0.6rem 1rem;
          background: var(--accent);
          color: white;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(88, 166, 255, 0.35);
          white-space: nowrap;
        }
        .primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .error {
          color: #f85149;
          margin: 0 0 1rem 0;
        }
        .summary {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
          margin: 0.75rem 0 1.25rem 0;
        }
        .card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 0.9rem 1rem;
        }
        .label {
          color: var(--text-muted);
          font-size: 0.85rem;
        }
        .value {
          margin-top: 0.2rem;
          font-size: 1.25rem;
          font-weight: 650;
          letter-spacing: -0.2px;
        }
        .lijst {
          margin-bottom: 1.25rem;
        }
        .lijst h3 {
          margin: 0 0 0.75rem 0;
          font-size: 1rem;
        }
        ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        li {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.25rem 0.75rem;
          padding: 0.7rem 0;
          border-bottom: 1px solid var(--border);
        }
        .titel {
          font-weight: 550;
        }
        .meta {
          color: var(--text-muted);
          font-size: 0.85rem;
        }
        .amount {
          grid-row: 1 / span 2;
          align-self: center;
          justify-self: end;
          font-variant-numeric: tabular-nums;
        }
        .amount.neg {
          color: #f85149;
        }
        .amount.pos {
          color: var(--success);
        }

        .insights {
          display: grid;
          gap: 0.6rem;
        }
        .insight {
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 0.8rem 0.9rem;
          background: rgba(255, 255, 255, 0.02);
        }
        .insight.warn {
          border-color: rgba(210, 153, 34, 0.45);
          background: rgba(210, 153, 34, 0.06);
        }
        .insight.high {
          border-color: rgba(248, 81, 73, 0.45);
          background: rgba(248, 81, 73, 0.06);
        }
        .ins-title {
          font-weight: 650;
          margin-bottom: 0.25rem;
        }
        .ins-detail {
          color: var(--text-muted);
          font-size: 0.9rem;
          line-height: 1.45;
        }
        .leeg {
          color: var(--text-muted);
          margin: 0;
        }

        @media (max-width: 420px) {
          .top-row {
            flex-direction: column;
            align-items: stretch;
          }
          .primary {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

