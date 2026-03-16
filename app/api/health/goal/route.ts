import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkBodySize } from "@/lib/security/body-limit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getOrCreateProfileId } from "@/lib/profile";

export const runtime = "nodejs";

const GoalSchema = z.object({
  kind: z.enum(["weight", "sleep", "activity"]).optional().default("weight"),
  targetValue: z.number().positive(),
  targetDate: z.string().optional(),
  unit: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit(req);
    if (!rate.ok) {
      return Response.json({ error: "Te veel requests. Probeer over een minuut opnieuw." }, { status: 429 });
    }
    if (!checkBodySize(req, 4 * 1024)) {
      return Response.json({ error: "Request te groot" }, { status: 413 });
    }
    const profileId = await getOrCreateProfileId();
    const raw = await req.json();
    const parsed = GoalSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: "Ongeldige invoer", details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    const kind = body.kind;
    const targetValue = body.targetValue;
    const targetDate = body.targetDate?.trim()
      ? new Date(body.targetDate.trim())
      : null;
    const VALID_UNITS: Record<string, string> = {
      weight: "kg",
      sleep: "hours",
      activity: "minutes_per_week",
    };
    const unit = body.unit ?? VALID_UNITS[kind] ?? "kg";

    const row = await prisma.healthGoal.create({
      data: {
        profileId,
        kind,
        targetValue,
        targetDate: targetDate && !Number.isNaN(targetDate.getTime()) ? targetDate : undefined,
        unit,
        active: true,
      },
    });

    return Response.json({
      ok: true,
      goal: {
        id: row.id,
        kind: row.kind,
        targetValue: row.targetValue,
        targetDate: row.targetDate?.toISOString(),
        unit: row.unit,
        active: row.active,
      },
    });
  } catch (err) {
    console.error("Health goal error:", err);
    return Response.json({ error: "Doel opslaan mislukt" }, { status: 500 });
  }
}
