"use client";

import { useState, useEffect } from "react";
import type { Reminder } from "@/lib/types";

interface RemindersPanelProps {
  reminders: Reminder[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onRefresh: () => void;
  onChangePage: (page: number) => void;
  onDeleteIds: (ids: string[]) => Promise<void>;
}

function formatRemindAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RemindersPanel({
  reminders,
  page,
  pageSize,
  total,
  totalPages,
  onRefresh,
  onChangePage,
  onDeleteIds,
}: RemindersPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Selectie resetten bij pagina-wissel
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  const gepland = reminders.filter((r) => !r.sent);
  const uitgevoerd = reminders.filter((r) => r.sent);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(reminders.map((r) => r.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await onDeleteIds(ids);
    setSelectedIds(new Set());
  };

  const handleDeleteOne = async (id: string) => {
    await onDeleteIds([id]);
  };

  const renderRow = (r: Reminder) => (
    <li key={r.id}>
      <input
        type="checkbox"
        checked={selectedIds.has(r.id)}
        onChange={() => toggleSelect(r.id)}
        className="check"
        aria-label={`Selecteer ${r.message}`}
      />
      <span className="titel">
        {r.message}
        {r.taskTitle && <span className="sub">bij taak: {r.taskTitle}</span>}
      </span>
      <span className="deadline-tag">{formatRemindAt(r.remindAt)}</span>
      <span className={`status-tag ${r.sent ? "uitgevoerd" : "gepland"}`}>
        {r.sent ? "uitgevoerd" : "gepland"}
      </span>
      <button
        type="button"
        className="del"
        onClick={() => handleDeleteOne(r.id)}
        aria-label={`Verwijder: ${r.message}`}
        title="Verwijderen"
      >
        ×
      </button>
    </li>
  );

  if (reminders.length === 0 && total === 0) {
    return (
      <div className="panel">
        <p className="leeg" role="status">Geen herinneringen. Vraag de coach om een reminder in te stellen.</p>
        <button onClick={onRefresh} className="refresh">
          Ververs
        </button>
        <style jsx>{`
          .panel {
            max-width: 600px;
          }
          .leeg {
            color: var(--text-muted);
            margin-bottom: 1rem;
          }
        .refresh {
          padding: 0.6rem 1rem;
          background: var(--accent);
          color: white;
          border-radius: 8px;
        }
        `}</style>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="actie-row">
        <button type="button" onClick={selectAll}>
          Selecteer alles
        </button>
        <button type="button" onClick={deselectAll}>
          Deselecteer
        </button>
        <button
          type="button"
          className="del-btn"
          onClick={handleDeleteSelected}
          disabled={selectedIds.size === 0}
        >
          Verwijder geselecteerde {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
        </button>
        <button onClick={onRefresh} className="refresh">
          Ververs
        </button>
      </div>

      {reminders.length > 0 && (
        <>
          {gepland.length > 0 && (
            <div className="lijst">
              <h3>Gepland</h3>
              <ul>
                {gepland.map(renderRow)}
              </ul>
            </div>
          )}

          {uitgevoerd.length > 0 && (
            <div className="lijst">
              <h3>Uitgevoerd</h3>
              <ul>
                {uitgevoerd.map(renderRow)}
              </ul>
            </div>
          )}

          {totalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                onClick={() => onChangePage(page - 1)}
                disabled={page <= 1}
              >
                Vorige
              </button>
              <span className="page-info">Pagina {page} van {totalPages}</span>
              <button
                type="button"
                onClick={() => onChangePage(page + 1)}
                disabled={page >= totalPages}
              >
                Volgende
              </button>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .panel {
          max-width: 600px;
        }
        .actie-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          align-items: center;
        }
        .actie-row button {
          padding: 0.6rem 1rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
        }
        .actie-row button.refresh {
          margin-left: auto;
          background: var(--accent);
          color: white;
        }
        .actie-row button.del-btn:not(:disabled):hover {
          color: #f85149;
        }
        .actie-row button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .lijst {
          margin-bottom: 1.5rem;
        }
        .lijst h3 {
          font-size: 1rem;
          margin: 0 0 0.75rem 0;
        }
        ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        li {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border);
        }
        .check {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          cursor: pointer;
        }
        .titel {
          flex: 1;
        }
        .sub {
          display: block;
          margin-top: 0.15rem;
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .deadline-tag {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .status-tag {
          font-size: 0.75rem;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
        }
        .status-tag.gepland {
          background: var(--accent-soft);
          color: var(--accent);
        }
        .status-tag.uitgevoerd {
          background: rgba(63, 185, 80, 0.2);
          color: var(--success);
        }
        .del {
          width: 28px;
          height: 28px;
          padding: 0;
          background: transparent;
          color: var(--text-muted);
          font-size: 1.2rem;
          flex-shrink: 0;
        }
        .del:hover {
          color: #f85149;
        }
        .pagination {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-top: 1.5rem;
          padding-top: 1.25rem;
          border-top: 1px solid var(--border);
        }
        .pagination button {
          padding: 0.5rem 1rem;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 6px;
          font-size: 0.875rem;
          transition: background 0.15s, border-color 0.15s;
        }
        .pagination button:hover:not(:disabled) {
          background: var(--surface-hover);
          border-color: var(--accent);
        }
        .pagination button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .page-info {
          font-size: 0.85rem;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
