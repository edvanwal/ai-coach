export type RunStatus =
  | "started"
  | "in_progress"
  | "waiting_confirm"
  | "done"
  | "blocked"
  | "stopped"
  | "failed";

export type CommandType = "new" | "status" | "stop" | "help" | "confirm";

export type ChannelType = "api" | "whatsapp" | "telegram" | "slack";

export interface ParsedCommand {
  type: CommandType;
  payload?: string;
  runId?: string;
  confirmCode?: string;
  projectAlias?: string;
  rawInput: string;
}

export interface ProjectAdapter {
  id: string;
  label: string;
  allowedCommands: CommandType[];
  sensitivityLevel: "normal" | "high";
  notificationProfile: "minimal" | "standard" | "verbose";
}

export interface CommandRequest {
  text: string;
  channel: ChannelType;
  sender?: string;
}

export interface RunEvent {
  at: string;
  status: RunStatus;
  message: string;
}

export interface CommandRun {
  id: string;
  projectAlias: string;
  commandText: string;
  sensitive: boolean;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  channel: ChannelType;
  sender?: string;
  events: RunEvent[];
  confirmCode?: string;
}

