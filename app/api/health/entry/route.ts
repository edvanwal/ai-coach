import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkBodySize } from "@/lib/security/body-limit";
import { checkRateLimit } from "@/lib/security/rate-limit";

const EntrySchema = z.object({
  date: z.string().optional(),
  weightKg: z.number().min(0.1).max(300).optional(),
  fatPct: z.number().min(0).max(100).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  activityMinutes: z.number().min(0).max(1440).optional(),
  note: z.string().max(500).optional(),
});
import { getOrCreateProfileId } from "@/lib/profile";

export const runtime = "nodejs";

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
    const parsed = EntrySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: "Ongeldige invoer", details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    const dateStr = body.date?.trim() ?? null;
    const date = dateStr ? new Date(dateStr) : new Date();
    if (Number.isNaN(date.getTime())) {
      return Response.json({ error: "Ongeldige datum" }, { status: 400 });
    }

    const weightKg = body.weightKg ?? null;
    const fatPct = body.fatPct ?? null;
    const sleepHours = body.sleepHours ?? null;
    const activityMinutes = body.activityMinutes ?? null;
    const note = body.note?.trim() || null;

    if (weightKg == null && fatPct == null && sleepHours == null && activityMinutes == null) {
      return Response.json({ error: "Geef minimaal gewicht, vet%, slaap of beweging op" }, { status: 400 });
    }

    const row = await prisma.healthMetric.create({
      data: {
        profileId,
        source: "manual",
        date,
        weightKg: weightKg ?? undefined,
        fatPct: fatPct ?? undefined,
        sleepHours: sleepHours ?? undefined,
        activityMinutes: activityMinutes ?? undefined,
        note: note ?? undefined,
      },
    });

    return Response.json({
      ok: true,
      entry: {
        id: row.id,
        date: row.date.toISOString(),
        weightKg: row.weightKg ?? undefined,
        fatPct: row.fatPct ?? undefined,
        sleepHours: row.sleepHours ?? undefined,
        activityMinutes: row.activityMinutes ?? undefined,
        note: row.note ?? undefined,
        source: row.source,
        createdAt: row.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Health entry error:", err);
    return Response.json({ error: "Opslaan mislukt" }, { status: 500 });
  }
}
