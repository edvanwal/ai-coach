import { randomUUID } from "crypto";
import type { ChannelType, CommandRun, RunEvent, RunStatus } from "@/lib/mobile-control/types";
import { createMobileBuildPr } from "@/lib/mobile-control/github";

type QueueItem = { runId: string };
const RUN_TIMEOUT_MS = 3 * 60 * 1000;
const CONFIRM_TTL_MS = 10 * 60 * 1000;

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
  const isWaitingConfirm = params.initialStatus === "waiting_confirm";
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
    confirmExpiresAt: isWaitingConfirm
      ? new Date(Date.now() + CONFIRM_TTL_MS).toISOString()
      : undefined,
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

export function dequeueRun(runId: string): boolean {
  const idx = queue.findIndex((q) => q.runId === runId);
  if (idx === -1) return false;
  queue.splice(idx, 1);
  return true;
}

export function stopRun(runId: string, reason = "Run handmatig gestopt."): CommandRun | null {
  const run = getRun(runId);
  if (!run) return null;
  dequeueRun(runId);
  if (run.status === "done" || run.status === "failed" || run.status === "stopped") return run;
  return addRunEvent(runId, "stopped", reason);
}

export function enqueueRun(runId: string): void {
  queue.push({ runId });
  addRunEvent(runId, "queued", "In wachtrij gezet.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processRun(runId: string): Promise<void> {
  const run = getRun(runId);
  if (!run) return;
  if (run.status === "stopped" || run.status === "failed" || run.status === "done") return;

  addRunEvent(runId, "in_progress", "Uitvoering gestart.");

  const work = (async () => {
    // MVP: maak een voorstel-wijziging (PR) aan op GitHub, zodat "remote bouwen" echt output oplevert.
    addRunEvent(runId, "in_progress", "Voorstel-wijziging aanmaken...");
    const { prUrl } = await createMobileBuildPr({
      runId,
      commandText: run.commandText,
      sender: run.sender,
    });
    if (getRun(runId)?.status === "stopped") return;
    addRunEvent(runId, "done", `Klaar. PR: ${prUrl}`);
  })();

  const timeout = (async () => {
    await sleep(RUN_TIMEOUT_MS);
    throw new Error("timeout");
  })();

  try {
    await Promise.race([work, timeout]);
  } catch (err) {
    if (getRun(runId)?.status === "stopped") return;
    const message =
      err instanceof Error && err.message !== "timeout"
        ? `Run faalde: ${err.message}`
        : "Run faalde (timeout).";
    addRunEvent(runId, "failed", message);
  }
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
      if (run.confirmExpiresAt && Date.parse(run.confirmExpiresAt) < Date.now()) {
        addRunEvent(run.id, "failed", "Confirm-code verlopen.");
        return null;
      }
      return run;
    }
  }
  return null;
}

