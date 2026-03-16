"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { FinancePanel } from "@/components/FinancePanel";
import { HealthPanel } from "@/components/HealthPanel";
import { ProfilePanel } from "@/components/ProfilePanel";
import { RemindersPanel } from "@/components/RemindersPanel";
import { TasksPanel } from "@/components/TasksPanel";
import type { Profile, RemindersResponse, Task } from "@/lib/types";

const PROFILE_KEY = "ai-coach-profile";
const TASKS_KEY = "ai-coach-tasks";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"chat" | "taken" | "profiel" | "herinneringen" | "financien" | "gezondheid">("chat");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [remindersData, setRemindersData] = useState<RemindersResponse | null>(null);
  const [remindersPage, setRemindersPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Veiligheidsmaatregel: loading nooit langer dan 12 sec laten staan
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoading(false), 12000);
    return () => clearTimeout(t);
  }, [loading]);

  const loadFromApi = useCallback(async (remindersPageOverride?: number) => {
    const page = remindersPageOverride ?? remindersPage;
    const TIMEOUT_MS = 10000;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const [profileRes, tasksRes, remindersRes] = await Promise.allSettled([
        fetch("/api/profile", { cache: "no-store", signal: controller.signal }),
        fetch("/api/tasks", { cache: "no-store", signal: controller.signal }),
        fetch(`/api/reminders?page=${page}&pageSize=50`, { cache: "no-store", signal: controller.signal }),
      ]);
      clearTimeout(tid);
      const profileData = profileRes.status === "fulfilled" ? await profileRes.value.json().catch(() => ({})) : {};
      const tasksData = tasksRes.status === "fulfilled" ? await tasksRes.value.json().catch(() => ({})) : {};
      const remindersResData = remindersRes.status === "fulfilled" ? await remindersRes.value.json().catch(() => ({})) : {};
      if (profileData?.profile) setProfile(profileData.profile);
      if (Array.isArray(tasksData?.tasks)) setTasks(tasksData.tasks);
      if (remindersResData?.reminders && Array.isArray(remindersResData.reminders)) {
        setRemindersData({
          reminders: remindersResData.reminders,
          page: remindersResData.page ?? page,
          pageSize: remindersResData.pageSize ?? 50,
          total: remindersResData.total ?? 0,
          totalPages: remindersResData.totalPages ?? 1,
        });
        setRemindersPage(remindersResData.page ?? page);
      }

      const hasApiProfile = !!profileData.profile;
      const hasApiTasks = Array.isArray(tasksData.tasks) && tasksData.tasks.length > 0;
      if (!hasApiProfile || !hasApiTasks) {
        const localProfile = typeof window !== "undefined" ? localStorage.getItem(PROFILE_KEY) : null;
        const localTasks = typeof window !== "undefined" ? localStorage.getItem(TASKS_KEY) : null;
        if (localProfile && !hasApiProfile) {
          try {
            const p = JSON.parse(localProfile) as Profile;
            await fetch("/api/profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(p),
              cache: "no-store",
            });
            setProfile(p);
            localStorage.removeItem(PROFILE_KEY);
          } catch {
            /* negeer */
          }
        }
        if (localTasks && !hasApiTasks) {
          try {
            const t = JSON.parse(localTasks) as Task[];
            for (const task of t) {
              await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(task),
                cache: "no-store",
              });
            }
            localStorage.removeItem(TASKS_KEY);
            const tr = await fetch("/api/tasks", { cache: "no-store" });
            const td = await tr.json();
            if (td.tasks) setTasks(td.tasks);
          } catch {
            /* negeer */
          }
        }
      }
    } catch (e) {
      console.error("Laden mislukt:", e);
      clearTimeout(tid);
    } finally {
      setLoading(false);
    }
  }, [remindersPage]);

  const handleChangeRemindersPage = useCallback((page: number) => {
    setRemindersPage(page);
    loadFromApi(page);
  }, [loadFromApi]);

  const handleDeleteReminders = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const res = await fetch("/api/reminders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Verwijderen mislukt");
    const data = (await res.json()) as { deletedCount?: number };
    const deletedCount = data.deletedCount ?? 0;
    const currentCount = remindersData?.reminders.length ?? 0;
    // Als huidige pagina leeg wordt en we niet op pagina 1 staan: ga naar vorige pagina
    const nextPage = currentCount <= deletedCount && remindersPage > 1
      ? remindersPage - 1
      : remindersPage;
    setRemindersPage(nextPage);
    await loadFromApi(nextPage);
  }, [remindersData?.reminders.length, remindersPage, loadFromApi]);

  useEffect(() => {
    loadFromApi();
  }, [loadFromApi]);

  useEffect(() => {
    if (activeTab === "herinneringen") loadFromApi();
  }, [activeTab, loadFromApi]);

  useEffect(() => {
    fetch("/api/cron/check-reminders", { cache: "no-store" }).catch(() => {});
    const t = setInterval(() => {
      fetch("/api/cron/check-reminders", { cache: "no-store" }).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="app">
      {loading && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <p>Laden...</p>
        </div>
      )}
      <header className="header">
        <h1>AI Persoonlijke Coach</h1>
        <nav className="tabs" role="tablist" aria-label="Hoofdnavigatie">
          <button
            role="tab"
            aria-selected={activeTab === "chat"}
            aria-controls="panel-chat"
            id="tab-chat"
            className={activeTab === "chat" ? "active" : ""}
            onClick={() => setActiveTab("chat")}
          >
            Chat
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "taken"}
            aria-controls="panel-taken"
            id="tab-taken"
            className={activeTab === "taken" ? "active" : ""}
            onClick={() => setActiveTab("taken")}
          >
            Taken
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "profiel"}
            aria-controls="panel-profiel"
            id="tab-profiel"
            className={activeTab === "profiel" ? "active" : ""}
            onClick={() => setActiveTab("profiel")}
          >
            Profiel
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "herinneringen"}
            aria-controls="panel-herinneringen"
            id="tab-herinneringen"
            className={activeTab === "herinneringen" ? "active" : ""}
            onClick={() => setActiveTab("herinneringen")}
          >
            Herinneringen
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "financien"}
            aria-controls="panel-financien"
            id="tab-financien"
            className={activeTab === "financien" ? "active" : ""}
            onClick={() => setActiveTab("financien")}
          >
            Financiën
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "gezondheid"}
            aria-controls="panel-gezondheid"
            id="tab-gezondheid"
            className={activeTab === "gezondheid" ? "active" : ""}
            onClick={() => setActiveTab("gezondheid")}
          >
            Gezondheid
          </button>
        </nav>
      </header>

      <section
        className="content"
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "chat" && (
          <ChatInterface profile={profile} tasks={tasks} onTasksChanged={loadFromApi} />
        )}
        {activeTab === "taken" && (
          <TasksPanel tasks={tasks} setTasks={setTasks} />
        )}
        {activeTab === "profiel" && (
          <ProfilePanel profile={profile} setProfile={setProfile} />
        )}
        {activeTab === "herinneringen" && (
          <RemindersPanel
            reminders={remindersData?.reminders ?? []}
            page={remindersData?.page ?? 1}
            pageSize={remindersData?.pageSize ?? 50}
            total={remindersData?.total ?? 0}
            totalPages={remindersData?.totalPages ?? 1}
            onRefresh={() => loadFromApi(remindersPage)}
            onChangePage={handleChangeRemindersPage}
            onDeleteIds={handleDeleteReminders}
          />
        )}
        {activeTab === "financien" && <FinancePanel />}
        {activeTab === "gezondheid" && <HealthPanel />}
      </section>

      <style jsx>{`
        .app {
          max-width: 900px;
          margin: 0 auto;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 1rem;
        }
        .header {
          margin-bottom: 1.5rem;
          border-bottom: 1px solid var(--border);
          padding-bottom: 1rem;
        }
        .header h1 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0 0 1rem 0;
        }
        .tabs {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .tabs button {
          padding: 0.5rem 1rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text);
          font-size: 0.9rem;
          transition: background 0.15s, border-color 0.15s;
        }
        .tabs button:hover {
          background: var(--surface-hover);
          border-color: var(--accent);
        }
        .tabs button.active {
          background: var(--accent-soft);
          color: var(--accent);
          border-color: rgba(88, 166, 255, 0.45);
        }
        .content {
          flex: 1;
        }
        .loading-overlay {
          position: fixed;
          inset: 0;
          background: var(--bg);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .loading-overlay p {
          color: var(--text-muted);
        }

        @media (max-width: 520px) {
          .tabs {
            flex-wrap: nowrap;
            overflow-x: auto;
            padding-bottom: 0.25rem;
            scrollbar-width: none;
          }
          .tabs::-webkit-scrollbar {
            display: none;
          }
          .tabs button {
            flex: 0 0 auto;
          }
        }
      `}</style>
    </main>
  );
}
