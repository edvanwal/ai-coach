import type { CommandType, ProjectAdapter } from "@/lib/mobile-control/types";

const BASE_ALLOWED: CommandType[] = ["new", "status", "stop", "help", "confirm"];

const ADAPTERS: ProjectAdapter[] = [
  {
    id: "ai-coach",
    label: "AI Coach",
    allowedCommands: BASE_ALLOWED,
    sensitivityLevel: "high",
    notificationProfile: "standard",
  },
  {
    id: "template",
    label: "Template Project",
    allowedCommands: BASE_ALLOWED,
    sensitivityLevel: "normal",
    notificationProfile: "minimal",
  },
];

export function getProjectAdapters(): ProjectAdapter[] {
  return ADAPTERS;
}

export function getProjectAdapter(projectAlias?: string): ProjectAdapter {
  if (!projectAlias) return ADAPTERS[0];
  return ADAPTERS.find((a) => a.id === projectAlias) ?? ADAPTERS[0];
}

