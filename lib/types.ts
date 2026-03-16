export interface Profile {
  adhdContext: string;
  situatie: string;
  doelen: string;
  persoonlijkheid?: string;
}

export interface Task {
  id: string;
  title: string;
  deadline?: string;
  prioriteit: "hoog" | "normaal" | "laag";
  isVervelend: boolean; // "vervelende taak" waar je geen zin in hebt
  afgerond: boolean;
  createdAt: string;
}

export interface Reminder {
  id: string;
  message: string;
  remindAt: string;
  sent: boolean;
  createdAt: string;
  taskId?: string;
  taskTitle?: string;
}

export interface RemindersResponse {
  reminders: Reminder[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ----------------------------
// Finance (read-only MVP)
// ----------------------------

export interface FinanceAccount {
  id: string;
  name: string;
  ibanMasked?: string;
  currency: string;
  balanceCents: number;
  updatedAt: string;
}

export interface FinanceTransaction {
  id: string;
  bookedAt: string;
  description: string;
  amountCents: number;
  currency: string;
  merchant?: string;
  category?: string;
  isRecurring: boolean;
}

export interface FinanceOverviewResponse {
  provider: string;
  accounts: FinanceAccount[];
  transactions: Array<FinanceTransaction & { accountId: string }>;
}

// ----------------------------
// Health
// ----------------------------

export interface HealthMetricEntry {
  id: string;
  date: string;
  weightKg?: number;
  fatPct?: number;
  sleepHours?: number;
  activityMinutes?: number;
  note?: string;
  source: string;
  createdAt: string;
}

export interface HealthGoalEntry {
  id: string;
  kind: "weight" | "sleep" | "activity";
  targetValue: number;
  targetDate?: string;
  unit: string;
  active: boolean;
}

export interface HealthOverviewResponse {
  entries: HealthMetricEntry[];
  goals: HealthGoalEntry[];
  latestWeight?: number;
  latestWeightDate?: string;
}
