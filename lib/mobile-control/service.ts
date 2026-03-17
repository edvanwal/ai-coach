import { getProjectAdapter, getProjectAdapters } from "@/lib/mobile-control/project-adapters";
import { isSensitiveCommand, parseCommand } from "@/lib/mobile-control/parser";
import {
  addRunEvent,
  createConfirmCode,
  createRun,
  enqueueRun,
  findRunByConfirmCode,
  getRun,
  listRuns,
  processQueue,
} from "@/lib/mobile-control/store";
import type { CommandRequest, CommandRun } from "@/lib/mobile-control/types";

function helpText(): string {
  return [
    "Beschikbare commando's:",
    "- new <opdracht>",
    "- status <run-id>",
    "- stop <run-id>",
    "- confirm <code>",
    "- help",
    "Optioneel met projectroutering: project ai-coach: new ...",
  ].join("\n");
}

function buildTemplate() {
  return {
    title: "Mobiele opdracht-template (Cloud Agents)",
    statuses: ["started", "in_progress", "done", "blocked"],
    template: [
      "Project: <alias>",
      "Doel: <een zin>",
      "Beperkingen: <max 3 bullets>",
      "Output: <wat moet klaar zijn>",
    ],
  };
}

export function getControlOverview() {
  return {
    template: buildTemplate(),
    adapters: getProjectAdapters(),
    latestRuns: listRuns(15),
  };
}

export async function handleCommand(input: CommandRequest): Promise<{
  ok: boolean;
  message: string;
  run?: CommandRun;
}> {
  const parsed = parseCommand(input.text);
  const adapter = getProjectAdapter(parsed.projectAlias);

  if (!adapter.allowedCommands.includes(parsed.type)) {
    return { ok: false, message: "Commando is niet toegestaan voor dit project." };
  }

  if (parsed.type === "help") {
    return { ok: true, message: helpText() };
  }

  if (parsed.type === "status") {
    if (!parsed.runId) return { ok: false, message: "Gebruik: status <run-id>" };
    const run = getRun(parsed.runId);
    if (!run) return { ok: false, message: "Run niet gevonden." };
    return { ok: true, message: `${run.id} is ${run.status}.`, run };
  }

  if (parsed.type === "stop") {
    if (!parsed.runId) return { ok: false, message: "Gebruik: stop <run-id>" };
    const run = addRunEvent(parsed.runId, "stopped", "Run handmatig gestopt.");
    if (!run) return { ok: false, message: "Run niet gevonden." };
    return { ok: true, message: `${run.id} is gestopt.`, run };
  }

  if (parsed.type === "confirm") {
    if (!parsed.confirmCode) return { ok: false, message: "Gebruik: confirm <code>" };
    const run = findRunByConfirmCode(parsed.confirmCode);
    if (!run) return { ok: false, message: "Confirm-code ongeldig of verlopen." };
    addRunEvent(run.id, "started", "Bevestiging ontvangen. Run wordt uitgevoerd.");
    enqueueRun(run.id);
    void processQueue();
    return { ok: true, message: `${run.id} bevestigd en gestart.`, run: getRun(run.id) ?? run };
  }

  const payload = parsed.payload?.trim();
  if (!payload) {
    return { ok: false, message: "Gebruik: new <opdracht>" };
  }

  const sensitive = adapter.sensitivityLevel === "high" && isSensitiveCommand(payload);
  if (sensitive) {
    const confirmCode = createConfirmCode();
    const run = createRun({
      projectAlias: adapter.id,
      commandText: payload,
      channel: input.channel,
      sender: input.sender,
      sensitive: true,
      confirmCode,
      initialStatus: "waiting_confirm",
    });
    addRunEvent(
      run.id,
      "waiting_confirm",
      `Bevestiging nodig. Antwoord met: confirm ${confirmCode}`
    );
    return {
      ok: true,
      message: `Run ${run.id} wacht op bevestiging. Antwoord met: confirm ${confirmCode}`,
      run: getRun(run.id) ?? run,
    };
  }

  const run = createRun({
    projectAlias: adapter.id,
    commandText: payload,
    channel: input.channel,
    sender: input.sender,
  });
  enqueueRun(run.id);
  void processQueue();
  return {
    ok: true,
    message: `Run ${run.id} gestart.`,
    run,
  };
}

