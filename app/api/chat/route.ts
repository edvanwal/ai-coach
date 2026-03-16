import { NextRequest } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { buildSystemPrompt, type HealthSummary } from "@/lib/coach-prompt";
import { prisma } from "@/lib/db";
import { getOrCreateProfileId } from "@/lib/profile";
import { checkBodySize } from "@/lib/security/body-limit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { computeHealthInsights } from "@/lib/health/insights";
import type { Profile } from "@/lib/types";
import type { Task } from "@/lib/types";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

const ChatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(100_000),
      })
    )
    .min(1)
    .max(200),
  conversationId: z.string().min(1, "conversationId is vereist").max(200),
  profile: z.any().optional(),
  tasks: z.any().optional(),
});

const CREATE_TASK_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_task",
    description:
      "Voeg een taak toe voor de gebruiker. Gebruik wanneer de gebruiker iets noemt dat hij moet doen en je voldoende informatie hebt (titel, optioneel deadline, prioriteit, vervelend).",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Korte omschrijving van de taak" },
        deadline: { type: "string", description: "Deadline YYYY-MM-DD, optioneel" },
        prioriteit: { type: "string", enum: ["laag", "normaal", "hoog"], description: "Prioriteit" },
        isVervelend: { type: "boolean", description: "Vervelende taak (tegenop zien)" },
      },
      required: ["title"],
    },
  },
};

const SET_REMINDER_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "set_reminder",
    description:
      "Plan een Pushover-herinnering voor de gebruiker. Gebruik wanneer de gebruiker een reminder wil op een specifiek tijdstip (bijv. na het toevoegen van een taak).",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "Tekst van de herinnering (bijv. taaknaam of actie)" },
        remindAt: { type: "string", description: "Datum en tijd in ISO 8601 formaat, bijv. 2025-03-12T18:00:00" },
        taskId: { type: "string", description: "ID van de bijbehorende taak, optioneel" },
      },
      required: ["message", "remindAt"],
    },
  },
};

function reduceDelta(acc: Record<string, unknown>, delta: Record<string, unknown>): Record<string, unknown> {
  for (const [key, value] of Object.entries(delta)) {
    if (value === undefined || value === null) continue;
    if (acc[key] === undefined || acc[key] === null) {
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0] as { index?: number } & Record<string, unknown>;
        if (typeof first === "object" && first !== null && typeof first.index === "number") {
          const arr: Record<string, unknown>[] = [];
          for (const item of value as Array<{ index?: number } & Record<string, unknown>>) {
            const { index, ...rest } = item;
            const idx = index ?? arr.length;
            arr[idx] = reduceDelta((arr[idx] as Record<string, unknown>) ?? {}, rest) as Record<string, unknown>;
          }
          acc[key] = arr;
        } else {
          acc[key] = value;
        }
      } else {
        acc[key] = value;
      }
    } else if (typeof acc[key] === "string" && typeof value === "string") {
      (acc[key] as string) += value;
    } else if (Array.isArray(value) && Array.isArray(acc[key])) {
      const accArr = acc[key] as Record<string, unknown>[];
      for (const item of value as Array<{ index?: number } & Record<string, unknown>>) {
        const { index, ...rest } = item;
        const idx = index ?? 0;
        if (!accArr[idx]) accArr[idx] = {};
        accArr[idx] = reduceDelta(accArr[idx] as Record<string, unknown>, rest) as Record<string, unknown>;
      }
    } else if (typeof acc[key] === "object" && typeof value === "object" && value !== null && !Array.isArray(value)) {
      acc[key] = reduceDelta(acc[key] as Record<string, unknown>, value as Record<string, unknown>) as Record<string, unknown>;
    }
  }
  return acc;
}

async function executeCreateTask(
  profileId: string,
  args: string
): Promise<string> {
  let parsed: { title?: string; deadline?: string; prioriteit?: string; isVervelend?: boolean };
  try {
    parsed = JSON.parse(args);
  } catch {
    return JSON.stringify({ ok: false, error: "Ongeldige parameters" });
  }
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  if (!title) return JSON.stringify({ ok: false, error: "Titel is verplicht" });
  const prioriteit = ["laag", "normaal", "hoog"].includes(parsed.prioriteit ?? "")
    ? parsed.prioriteit
    : "normaal";
  const row = await prisma.task.create({
    data: {
      title,
      deadline: parsed.deadline ?? null,
      prioriteit: prioriteit ?? "normaal",
      isVervelend: Boolean(parsed.isVervelend),
      afgerond: false,
      profileId,
    },
  });
  return JSON.stringify({ ok: true, task: { id: row.id, title: row.title } });
}

async function executeSetReminder(
  profileId: string,
  args: string
): Promise<string> {
  let parsed: { message?: string; remindAt?: string; taskId?: string };
  try {
    parsed = JSON.parse(args);
  } catch {
    return JSON.stringify({ ok: false, error: "Ongeldige parameters" });
  }
  const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
  const remindAtStr = typeof parsed.remindAt === "string" ? parsed.remindAt.trim() : "";
  if (!message || !remindAtStr) {
    return JSON.stringify({ ok: false, error: "message en remindAt zijn verplicht" });
  }
  // Interpret timezone-marked timestamps as local wall-clock time for reminders.
  const tzMarked = /[zZ]|[+-]\d{2}:\d{2}$/.test(remindAtStr);
  let remindAt = new Date(remindAtStr);
  if (tzMarked) {
    const m = remindAtStr.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?/
    );
    if (m) {
      const [, y, mo, d, h, mi, s = "0", ms = "0"] = m;
      remindAt = new Date(
        Number(y),
        Number(mo) - 1,
        Number(d),
        Number(h),
        Number(mi),
        Number(s),
        Number(ms.padEnd(3, "0"))
      );
    }
  }
  if (Number.isNaN(remindAt.getTime())) {
    return JSON.stringify({ ok: false, error: "Ongeldige datum/tijd voor remindAt" });
  }
  const now = Date.now();
  const minLeadMs = 15 * 1000; // kleine buffer tegen processing-jitter
  if (remindAt.getTime() <= now + minLeadMs) {
    remindAt = new Date(now + minLeadMs);
  }
  let taskId = typeof parsed.taskId === "string" && parsed.taskId.trim() ? parsed.taskId.trim() : null;
  if (taskId) {
    // Validatie: taak moet bestaan en bij dit profiel horen
    const exists = await prisma.task.findFirst({
      where: { id: taskId, profileId },
      select: { id: true },
    });
    if (!exists) taskId = null;
  }
  const recentCutoff = new Date(now - 3 * 60 * 1000);
  const existing = await prisma.reminder.findFirst({
    where: {
      profileId,
      message,
      sent: false,
      createdAt: { gte: recentCutoff },
    },
  });
  if (existing) {
    await prisma.reminder.update({
      where: { id: existing.id },
      data: { remindAt, taskId },
    });
  } else {
    await prisma.reminder.create({
      data: { profileId, taskId, remindAt, message },
    });
  }
  return JSON.stringify({
    ok: true,
    reminder: { remindAt: remindAt.toISOString(), message },
  });
}

export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit(req);
    if (!rate.ok) {
      return Response.json({ error: "Te veel requests. Probeer over een minuut opnieuw." }, { status: 429 });
    }
    if (!checkBodySize(req, 2 * 1024 * 1024)) {
      return Response.json({ error: "Request body te groot" }, { status: 413 });
    }
    const raw = await req.json();
    const parsed = ChatBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Ongeldige invoer";
      return Response.json({ error: msg }, { status: 400 });
    }
    const { messages, conversationId } = parsed.data;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY is niet geconfigureerd. Maak .env.local aan." },
        { status: 500 }
      );
    }

    const profileId = await getOrCreateProfileId();
    const [profileRow, taskRows, fileRows, healthMetrics, healthGoals] = await Promise.all([
      prisma.profile.findUnique({ where: { id: profileId } }),
      prisma.task.findMany({ where: { profileId } }),
      prisma.file.findMany({ where: { profileId } }),
      prisma.healthMetric.findMany({
        where: { profileId },
        orderBy: { date: "desc" },
        take: 100,
      }),
      prisma.healthGoal.findMany({ where: { profileId, active: true } }),
    ]);

    const profile: Profile | null = profileRow
      ? {
          adhdContext: profileRow.adhdContext,
          situatie: profileRow.situatie,
          doelen: profileRow.doelen,
          persoonlijkheid: profileRow.persoonlijkheid ?? undefined,
        }
      : null;

    const tasks: Task[] = taskRows.map((r) => ({
      id: r.id,
      title: r.title,
      deadline: r.deadline ?? undefined,
      prioriteit: r.prioriteit as Task["prioriteit"],
      isVervelend: r.isVervelend,
      afgerond: r.afgerond,
      createdAt: r.createdAt.toISOString(),
    }));

    const fileTexts = fileRows.map((f) => ({
      filename: f.filename,
      text: f.extractedText,
    }));

    const healthOverview = {
      entries: healthMetrics.map((m) => ({
        id: m.id,
        date: m.date.toISOString(),
        weightKg: m.weightKg ?? undefined,
        fatPct: m.fatPct ?? undefined,
        sleepHours: m.sleepHours ?? undefined,
        activityMinutes: m.activityMinutes ?? undefined,
        note: m.note ?? undefined,
        source: m.source,
        createdAt: m.createdAt.toISOString(),
      })),
      goals: healthGoals.map((g) => ({
        id: g.id,
        kind: g.kind as "weight" | "sleep" | "activity",
        targetValue: g.targetValue,
        targetDate: g.targetDate?.toISOString(),
        unit: g.unit,
        active: g.active,
      })),
      latestWeight: healthMetrics[0]?.weightKg ?? undefined,
      latestWeightDate: healthMetrics[0]?.date.toISOString(),
    };
    const healthInsights = computeHealthInsights(healthOverview);
    const healthSummary: HealthSummary | null =
      healthOverview.entries.length > 0 || healthOverview.goals.length > 0
        ? {
            latestWeight: healthOverview.latestWeight,
            latestWeightDate: healthOverview.latestWeightDate,
            goals: healthOverview.goals.map((g) => ({
              kind: g.kind,
              targetValue: g.targetValue,
              unit: g.unit,
            })),
            insights: healthInsights.map((i) => ({ title: i.title, detail: i.detail })),
          }
        : null;

    const systemContent = buildSystemPrompt(profile, tasks, fileTexts, healthSummary);

    const openai = new OpenAI({ apiKey });
    const primaryModel = process.env.OPENAI_CHAT_MODEL || "gpt-5";
    const fallbackModel = process.env.OPENAI_CHAT_FALLBACK_MODEL || "gpt-4.1";
    const promptMessages = [
      { role: "system" as const, content: systemContent },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const baseParams = {
      max_tokens: 800,
      temperature: 0.7,
      stream: true as const,
      tools: [CREATE_TASK_TOOL, SET_REMINDER_TOOL],
    };

    const lastUser = messages.length > 0 && messages[messages.length - 1]?.role === "user"
      ? messages[messages.length - 1]
      : null;

    const encoder = new TextEncoder();
    let fullContent = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          let currentMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [...promptMessages];
          let round = 0;

          while (true) {
            const reqParams = { ...baseParams, model: primaryModel, messages: currentMessages };
            let stream: AsyncIterable<ChatCompletionChunk>;
            try {
              stream = (await openai.chat.completions.create(reqParams)) as AsyncIterable<ChatCompletionChunk>;
            } catch {
              stream = (await openai.chat.completions.create({ ...reqParams, model: fallbackModel })) as AsyncIterable<ChatCompletionChunk>;
            }

            let message: Record<string, unknown> = {};
            let finishReason: string | null = null;
            for await (const chunk of stream) {
              const choice = chunk.choices[0];
              if (!choice) continue;
              if (choice.finish_reason) finishReason = choice.finish_reason;
              if (!choice.delta) continue;
              const delta = choice.delta as Record<string, unknown>;
              message = reduceDelta({ ...message }, delta);

              const content = choice.delta?.content;
              if (content) {
                fullContent += content;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(content)}\n\n`));
              }
            }

            const toolCalls = message.tool_calls as Array<{ id: string; type: string; function: { name: string; arguments: string } }> | undefined;
            if (finishReason !== "tool_calls" || !toolCalls?.length) {
              break;
            }

            const assistantMsg: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
              role: "assistant",
              content: (message.content as string) ?? "",
              tool_calls: toolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.function?.name ?? "", arguments: tc.function?.arguments ?? "" },
              })),
            };
            currentMessages.push(assistantMsg);

            let taskCreated = false;
            for (const tc of toolCalls) {
              let result: string;
              if (tc.function?.name === "create_task" && tc.function?.arguments) {
                result = await executeCreateTask(profileId, tc.function.arguments);
                if (result.includes('"ok":true')) taskCreated = true;
              } else if (tc.function?.name === "set_reminder" && tc.function?.arguments) {
                result = await executeSetReminder(profileId, tc.function.arguments);
              } else {
                result = JSON.stringify({ ok: false, error: "Onbekende tool" });
              }
              currentMessages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: result,
              });
            }

            if (taskCreated) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ taskCreated: true })}\n\n`));
            }
            round++;
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));

          if (lastUser && fullContent.trim()) {
            const conv = await prisma.conversation.findFirst({
              where: { id: conversationId, profileId },
              select: { title: true },
            });
            if (conv) {
              const newTitle =
                conv.title === "Nieuw gesprek" && lastUser.content
                  ? lastUser.content.slice(0, 50).trim() +
                    (lastUser.content.length > 50 ? "…" : "")
                  : undefined;
              await prisma.conversationMessage.createMany({
                data: [
                  {
                    profileId,
                    conversationId,
                    role: "user",
                    content: lastUser.content,
                  },
                  {
                    profileId,
                    conversationId,
                    role: "assistant",
                    content: fullContent.trim(),
                  },
                ],
              });
              if (newTitle) {
                await prisma.conversation.update({
                  where: { id: conversationId },
                  data: { title: newTitle },
                });
              }
            }
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : "Stream fout" })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    const msg = err instanceof Error ? err.message : "Onbekende fout";
    return Response.json(
      { error: `Chat mislukt: ${msg}` },
      { status: 500 }
    );
  }
}
