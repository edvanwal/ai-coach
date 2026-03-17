import { randomUUID } from "crypto";
import type { ChannelType, CommandRun, RunEvent, RunStatus } from "@/lib/mobile-control/types";

type QueueItem = { runId: string };

const globalForControl = globalThis as unknown as {
  controlRuns?: Map<string, CommandRun>;
  controlQueue?: QueueItem[];
  controlWorking?: boolean;
  runCounter?: number;
};

const runs = globalForControl.controlRuns ?? new Map<string, CommandRun>();
const queue = globalForControl.controlQueue ?? [];
globalForControl.controlRuns = runs;
globalForControl.controlQueue = queue;

function nextRunId(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = `${now.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${now.getUTCDate()}`.padStart(2, "0");
  globalForControl.runCounter = (globalForControl.runCounter ?? 0) + 1;
  const n = `${globalForControl.runCounter}`.padStart(3, "0");
  return `RUN-${y}${mo}${d}-${n}`;
}

export function createRun(params: {
  projectAlias: string;
  commandText: string;
  channel: ChannelType;
  sender?: string;
  sensitive?: boolean;
  confirmCode?: string;
  initialStatus?: RunStatus;
}): CommandRun {
  const now = new Date().toISOString();
  const run: CommandRun = {
    id: nextRunId(),
    projectAlias: params.projectAlias,
    commandText: params.commandText,
    sensitive: Boolean(params.sensitive),
    status: params.initialStatus ?? "started",
    createdAt: now,
    updatedAt: now,
    channel: params.channel,
    sender: params.sender,
    confirmCode: params.confirmCode,
    events: [
      {
        at: now,
        status: params.initialStatus ?? "started",
        message: "Run is gestart.",
      },
    ],
  };
  runs.set(run.id, run);
  return run;
}

export function addRunEvent(runId: string, status: RunStatus, message: string): CommandRun | null {
  const run = runs.get(runId);
  if (!run) return null;
  const now = new Date().toISOString();
  const event: RunEvent = { at: now, status, message };
  run.status = status;
  run.updatedAt = now;
  run.events.push(event);
  runs.set(run.id, run);
  return run;
}

export function getRun(runId: string): CommandRun | null {
  return runs.get(runId) ?? null;
}

export function listRuns(limit = 20): CommandRun[] {
  return Array.from(runs.values())
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
    .slice(0, limit);
}

export function enqueueRun(runId: string): void {
  queue.push({ runId });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processRun(runId: string): Promise<void> {
  const run = getRun(runId);
  if (!run) return;
  if (run.status === "stopped" || run.status === "failed") return;

  const lowerText = run.commandText.toLowerCase();
  const isPlanFlow = lowerText.startsWith("plan_coach_flow");

  if (isPlanFlow) {
    const [, rawTitle] = run.commandText.split(":", 2);
    const title = (rawTitle ?? "").trim() || "nieuwe coach-flow";

    addRunEvent(runId, "in_progress", `Plan voor coach-flow: ${title}`);
    await sleep(200);
    addRunEvent(
      runId,
      "in_progress",
      "Stap 1 – Situatie & doelgroep helder maken."
    );
    await sleep(200);
    addRunEvent(
      runId,
      "in_progress",
      "Stap 2 – Sessies/gespreksstappen schetsen (beginnend, midden, afsluiting)."
    );
    await sleep(200);
    addRunEvent(
      runId,
      "in_progress",
      "Stap 3 – Concrete prompts / vragen per stap formuleren."
    );
    await sleep(200);
    addRunEvent(
      runId,
      "in_progress",
      "Stap 4 – Randvoorwaarden vastleggen (ethiek, grenzen, no‑go’s)."
    );
    await sleep(200);
    addRunEvent(runId, "done", "Plan-coach-flow run afgerond (conceptplan klaar).");
    return;
  }

  addRunEvent(runId, "in_progress", "Analyse gestart.");
  await sleep(400);
  addRunEvent(runId, "in_progress", "Uitvoering bezig.");
  await sleep(400);
  addRunEvent(runId, "done", "Run afgerond.");
}

export async function processQueue(): Promise<void> {
  if (globalForControl.controlWorking) return;
  globalForControl.controlWorking = true;
  try {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) continue;
      await processRun(item.runId);
    }
  } finally {
    globalForControl.controlWorking = false;
  }
}

export function createConfirmCode(): string {
  return randomUUID().split("-")[0].toUpperCase();
}

export function findRunByConfirmCode(confirmCode: string): CommandRun | null {
  const norm = confirmCode.toUpperCase();
  for (const run of runs.values()) {
    if (run.confirmCode?.toUpperCase() === norm && run.status === "waiting_confirm") {
      return run;
    }
  }
  return null;
}

