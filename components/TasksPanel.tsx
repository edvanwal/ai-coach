"use client";

import { useState, useRef, useEffect } from "react";
import type { Task } from "@/lib/types";

interface TaskEditRowProps {
  task: Task;
  onSave: (data: { title: string; deadline: string; prioriteit: Task["prioriteit"]; isVervelend: boolean }) => void;
  onCancel: () => void;
}

function TaskEditRow({ task, onSave, onCancel }: TaskEditRowProps) {
  const [title, setTitle] = useState(task.title);
  const [deadline, setDeadline] = useState(task.deadline ?? "");
  const [prioriteit, setPrioriteit] = useState<Task["prioriteit"]>(task.prioriteit);
  const [isVervelend, setIsVervelend] = useState(task.isVervelend);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim()) onSave({ title: title.trim(), deadline, prioriteit, isVervelend });
  }

  return (
    <li className="edit-row">
      <form onSubmit={handleSubmit} className="edit-form">
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
        />
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="deadline"
        />
        <select
          value={prioriteit}
          onChange={(e) => setPrioriteit(e.target.value as Task["prioriteit"])}
        >
          <option value="laag">Laag</option>
          <option value="normaal">Normaal</option>
          <option value="hoog">Hoog</option>
        </select>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={isVervelend}
            onChange={(e) => setIsVervelend(e.target.checked)}
          />
          vervelend
        </label>
        <button type="submit">Opslaan</button>
        <button type="button" onClick={onCancel}>
          Annuleren
        </button>
      </form>
    </li>
  );
}

interface TasksPanelProps {
  tasks: Task[];
  setTasks: (t: Task[]) => void;
}

export function TasksPanel({ tasks, setTasks }: TasksPanelProps) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [prioriteit, setPrioriteit] = useState<Task["prioriteit"]>("normaal");
  const [isVervelend, setIsVervelend] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        deadline: deadline || undefined,
        prioriteit,
        isVervelend,
        afgerond: false,
      }),
      cache: "no-store",
    });
    const data = await res.json();
    if (data.task) setTasks([...tasks, data.task]);
    setTitle("");
    setDeadline("");
    setPrioriteit("normaal");
    setIsVervelend(false);
  }

  async function toggleAfgerond(task: Task) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ afgerond: !task.afgerond }),
      cache: "no-store",
    });
    const data = await res.json();
    if (data.task) {
      setTasks(tasks.map((t) => (t.id === task.id ? data.task : t)));
    }
  }

  async function verwijder(id: string) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (res.ok) setTasks(tasks.filter((t) => t.id !== id));
  }

  async function bewaarTaak(
    task: Task,
    data: { title: string; deadline: string; prioriteit: Task["prioriteit"]; isVervelend: boolean }
  ) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.title.trim(),
        deadline: data.deadline || undefined,
        prioriteit: data.prioriteit,
        isVervelend: data.isVervelend,
      }),
      cache: "no-store",
    });
    const d = await res.json();
    if (d.task) setTasks(tasks.map((t) => (t.id === task.id ? d.task : t)));
    setEditingTaskId(null);
  }

  const openTasks = tasks.filter((t) => !t.afgerond);
  const vervelendeTaken = openTasks.filter((t) => t.isVervelend);

  return (
    <div className="panel">
      <form onSubmit={handleAdd} className="add-form">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nieuwe taak..."
          required
        />
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="deadline"
        />
        <select
          value={prioriteit}
          onChange={(e) => setPrioriteit(e.target.value as Task["prioriteit"])}
        >
          <option value="laag">Laag</option>
          <option value="normaal">Normaal</option>
          <option value="hoog">Hoog</option>
        </select>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={isVervelend}
            onChange={(e) => setIsVervelend(e.target.checked)}
          />
          Vervelende taak
        </label>
        <button type="submit">Toevoegen</button>
      </form>

      {vervelendeTaken.length > 0 && (
        <div className="vervelend-blok">
          <h3>Vervelende taak van vandaag</h3>
          <p>
            Taken die je als &quot;vervelend&quot; hebt gemarkeerd – die waar je tegenop ziet.
            Ze staan hier bovenaan om je te helpen erop te focussen. Dezelfde taken staan ook in de lijst hieronder.
          </p>
          <ul>
            {vervelendeTaken.slice(0, 3).map((t) =>
              editingTaskId === t.id ? (
                <TaskEditRow
                  key={t.id}
                  task={t}
                  onSave={(data) => bewaarTaak(t, data)}
                  onCancel={() => setEditingTaskId(null)}
                />
              ) : (
                <li key={t.id}>
                  <button
                    className="done"
                    onClick={() => toggleAfgerond(t)}
                    title="Afvinken"
                  >
                    ✓
                  </button>
                  <span
                    className="titel"
                    onDoubleClick={() => setEditingTaskId(t.id)}
                  >
                    {t.title}
                  </span>
                  {t.deadline && (
                    <span className="deadline-tag">{t.deadline}</span>
                  )}
                  <button
                    className="edit"
                    onClick={() => setEditingTaskId(t.id)}
                    title="Bewerken"
                  >
                    ✎
                  </button>
                  <button
                    className="del"
                    onClick={() => verwijder(t.id)}
                    title="Verwijderen"
                  >
                    ×
                  </button>
                </li>
              )
            )}
          </ul>
        </div>
      )}

      <div className="lijst">
        <h3>Alle taken</h3>
        {openTasks.length === 0 ? (
          <p className="leeg" role="status">Geen openstaande taken.</p>
        ) : (
          <ul>
            {openTasks.map((t) =>
              editingTaskId === t.id ? (
                <TaskEditRow
                  key={t.id}
                  task={t}
                  onSave={(data) => bewaarTaak(t, data)}
                  onCancel={() => setEditingTaskId(null)}
                />
              ) : (
                <li key={t.id} className={t.afgerond ? "afgerond" : ""}>
                  <button
                    className="done"
                    onClick={() => toggleAfgerond(t)}
                    title="Afvinken"
                  >
                    {t.afgerond ? "✓" : "○"}
                  </button>
                  <span
                    className="titel"
                    onDoubleClick={() => setEditingTaskId(t.id)}
                  >
                    {t.title}
                  </span>
                  {t.deadline && (
                    <span className="deadline-tag">{t.deadline}</span>
                  )}
                  {t.isVervelend && (
                    <span className="vervelend-tag">vervelend</span>
                  )}
                  <button
                    className="edit"
                    onClick={() => setEditingTaskId(t.id)}
                    title="Bewerken"
                  >
                    ✎
                  </button>
                  <button
                    className="del"
                    onClick={() => verwijder(t.id)}
                    title="Verwijderen"
                  >
                    ×
                  </button>
                </li>
              )
            )}
          </ul>
        )}
      </div>

      {tasks.filter((t) => t.afgerond).length > 0 && (
        <details className="afgerond-details">
          <summary>Afgeronde taken ({tasks.filter((t) => t.afgerond).length})</summary>
          <ul>
            {tasks
              .filter((t) => t.afgerond)
              .map((t) =>
                editingTaskId === t.id ? (
                  <TaskEditRow
                    key={t.id}
                    task={t}
                    onSave={(data) => bewaarTaak(t, data)}
                    onCancel={() => setEditingTaskId(null)}
                  />
                ) : (
                  <li key={t.id}>
                    <button
                      className="done"
                      onClick={() => toggleAfgerond(t)}
                      title="Terugzetten"
                    >
                      ✓
                    </button>
                    <span
                      className="titel"
                      onDoubleClick={() => setEditingTaskId(t.id)}
                    >
                      {t.title}
                    </span>
                    <button
                      className="edit"
                      onClick={() => setEditingTaskId(t.id)}
                      title="Bewerken"
                    >
                      ✎
                    </button>
                    <button className="del" onClick={() => verwijder(t.id)}>
                      ×
                    </button>
                  </li>
                )
              )}
          </ul>
        </details>
      )}

      <style jsx>{`
        .panel {
          max-width: 600px;
        }
        .add-form {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          align-items: center;
        }
        .add-form input[type="text"] {
          flex: 1;
          min-width: 150px;
          padding: 0.6rem 0.8rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
        }
        .add-form .deadline {
          padding: 0.6rem 0.8rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
        }
        .add-form select {
          padding: 0.6rem 0.8rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
        }
        .add-form .checkbox {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        .add-form button {
          padding: 0.6rem 1rem;
          background: var(--accent);
          color: white;
        }
        .vervelend-blok {
          background: var(--accent-soft);
          border: 1px solid var(--accent);
          border-radius: 10px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }
        .vervelend-blok h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
        }
        .vervelend-blok p {
          margin: 0 0 0.5rem 0;
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        .vervelend-blok ul {
          margin: 0;
          padding-left: 1.5rem;
        }
        .vervelend-blok li {
          margin-bottom: 0.25rem;
        }
        .lijst h3,
        .afgerond-details summary {
          font-size: 1rem;
          margin: 0 0 0.75rem 0;
        }
        .leeg {
          color: var(--text-muted);
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
        li.afgerond {
          text-decoration: line-through;
          color: var(--text-muted);
        }
        .done {
          width: 28px;
          height: 28px;
          padding: 0;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--success);
          font-size: 1rem;
          flex-shrink: 0;
        }
        .titel {
          flex: 1;
        }
        .deadline-tag {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .vervelend-tag {
          font-size: 0.75rem;
          background: var(--warning);
          color: var(--bg);
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
        }
        .edit-row .edit-form {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
          width: 100%;
        }
        .edit-row .edit-form input[type="text"] {
          flex: 1;
          min-width: 120px;
          padding: 0.4rem 0.6rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text);
        }
        .edit-row .edit-form .deadline {
          padding: 0.4rem 0.6rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text);
        }
        .edit-row .edit-form select {
          padding: 0.4rem 0.6rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text);
        }
        .edit-row .edit-form .checkbox {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .edit-row .edit-form button[type="submit"] {
          padding: 0.4rem 0.8rem;
          background: var(--accent);
          color: white;
          font-size: 0.9rem;
        }
        .edit-row .edit-form button[type="button"] {
          padding: 0.4rem 0.8rem;
          background: var(--surface);
          color: var(--text-muted);
          font-size: 0.9rem;
        }
        .edit {
          width: 28px;
          height: 28px;
          padding: 0;
          background: transparent;
          color: var(--text-muted);
          font-size: 1rem;
          flex-shrink: 0;
        }
        .edit:hover {
          color: var(--accent);
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
        .afgerond-details {
          margin-top: 1.5rem;
          color: var(--text-muted);
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
