import type { ParsedCommand } from "@/lib/mobile-control/types";

const PROJECT_PREFIX = /^project\s+([a-z0-9-_]+)\s*:\s*(.+)$/i;

export function parseCommand(inputRaw: string | undefined | null): ParsedCommand {
  const safeRaw = typeof inputRaw === "string" ? inputRaw : "";
  const input = safeRaw.trim();
  if (!input) {
    return { type: "help", rawInput: safeRaw };
  }

  let projectAlias: string | undefined;
  let commandText = input;
  const mProject = input.match(PROJECT_PREFIX);
  if (mProject) {
    projectAlias = mProject[1].toLowerCase();
    commandText = mProject[2].trim();
  }

  const lower = commandText.toLowerCase();
  if (lower === "help") {
    return { type: "help", projectAlias, rawInput: safeRaw };
  }

  const mStatus = commandText.match(/^status\s+(\S+)$/i);
  if (mStatus) {
    return { type: "status", runId: mStatus[1], projectAlias, rawInput: safeRaw };
  }

  const mStop = commandText.match(/^stop\s+(\S+)$/i);
  if (mStop) {
    return { type: "stop", runId: mStop[1], projectAlias, rawInput: safeRaw };
  }

  const mConfirm = commandText.match(/^confirm\s+([a-z0-9-]+)$/i);
  if (mConfirm) {
    return {
      type: "confirm",
      confirmCode: mConfirm[1].toUpperCase(),
      projectAlias,
      rawInput: safeRaw,
    };
  }

  const mNew = commandText.match(/^new\s+(.+)$/i);
  if (mNew) {
    return { type: "new", payload: mNew[1].trim(), projectAlias, rawInput: safeRaw };
  }

  return { type: "help", projectAlias, rawInput: safeRaw };
}

export function isSensitiveCommand(text: string): boolean {
  const lower = text.toLowerCase();
  return ["deploy", "prod", "production", "env", "secret", "database", "migration"].some((k) =>
    lower.includes(k)
  );
}

