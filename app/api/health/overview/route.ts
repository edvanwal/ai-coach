import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateProfileId } from "@/lib/profile";
import type { HealthOverviewResponse } from "@/lib/types";

export const runtime = "nodejs";

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const profileId = await getOrCreateProfileId();
    const days = Math.min(90, Math.max(7, parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10)));
    const since = daysAgo(days);

    const [entries, goals] = await Promise.all([
      prisma.healthMetric.findMany({
        where: { profileId, date: { gte: since } },
        orderBy: { date: "desc" },
        take: 200,
      }),
      prisma.healthGoal.findMany({
        where: { profileId, active: true },
      }),
    ]);

    const withWeight = entries.filter((e) => e.weightKg != null);
    const latestWeightRow = withWeight[0];

    const out: HealthOverviewResponse = {
      entries: entries.map((e) => ({
        id: e.id,
        date: e.date.toISOString(),
        weightKg: e.weightKg ?? undefined,
        fatPct: e.fatPct ?? undefined,
        sleepHours: e.sleepHours ?? undefined,
        activityMinutes: e.activityMinutes ?? undefined,
        note: e.note ?? undefined,
        source: e.source,
        createdAt: e.createdAt.toISOString(),
      })),
      goals: goals.map((g) => ({
        id: g.id,
        kind: g.kind as "weight" | "sleep" | "activity",
        targetValue: g.targetValue,
        targetDate: g.targetDate?.toISOString(),
        unit: g.unit,
        active: g.active,
      })),
      latestWeight: latestWeightRow?.weightKg ?? undefined,
      latestWeightDate: latestWeightRow?.date.toISOString(),
    };

    return Response.json(out);
  } catch (err) {
    console.error("Health overview error:", err);
    return Response.json({ error: "Gezondheidsdata laden mislukt" }, { status: 500 });
  }
}
