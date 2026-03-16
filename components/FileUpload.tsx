"use client";

import { useState, useEffect } from "react";

interface FileItem {
  id: string;
  filename: string;
  uploadedAt: string;
}

export function FileUpload() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/files", { cache: "no-store" });
      const data = await res.json();
      if (data.files) setFiles(data.files);
    } catch {
      /* negeer */
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().slice(-4);
    if (ext !== ".pdf" && ext !== ".txt" && !file.name.toLowerCase().endsWith(".txt")) {
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/files", {
        method: "POST",
        body: form,
        cache: "no-store",
      });
      const data = await res.json();
      if (data.file) setFiles((prev) => [data.file, ...prev]);
    } catch {
      /* negeer */
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/files/${id}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (res.ok) setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="files">
      <h3>Documenten (PDF/TXT)</h3>
      <p className="hint">
        Upload documenten. De coach leest de tekst en gebruikt die in het gesprek.
      </p>
      <label className="upload-btn">
        <input
          type="file"
          accept=".pdf,.txt"
          onChange={handleUpload}
          disabled={uploading}
          style={{ display: "none" }}
        />
        {uploading ? "Bezig..." : "Bestand kiezen"}
      </label>
      {files.length > 0 && (
        <ul>
          {files.map((f) => (
            <li key={f.id}>
              <span>{f.filename}</span>
              <button
                type="button"
                className="del"
                onClick={() => remove(f.id)}
                title="Verwijderen"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <style jsx>{`
        .files {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border);
        }
        .files h3 {
          font-size: 1rem;
          margin: 0 0 0.5rem 0;
        }
        .hint {
          font-size: 0.9rem;
          color: var(--text-muted);
          margin: 0 0 1rem 0;
        }
        .upload-btn {
          display: inline-block;
          padding: 0.6rem 1rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
          cursor: pointer;
          font-size: 0.9rem;
        }
        .upload-btn:hover {
          background: var(--surface-hover);
        }
        .upload-btn:has(input:disabled) {
          opacity: 0.6;
          cursor: not-allowed;
        }
        ul {
          list-style: none;
          padding: 0;
          margin: 1rem 0 0 0;
        }
        li {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border);
        }
        li span {
          flex: 1;
          font-size: 0.9rem;
        }
        .del {
          width: 28px;
          height: 28px;
          padding: 0;
          background: transparent;
          color: var(--text-muted);
          font-size: 1.2rem;
          cursor: pointer;
        }
        .del:hover {
          color: #f85149;
        }
      `}</style>
    </div>
  );
}
