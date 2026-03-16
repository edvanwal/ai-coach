import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Cron-endpoint: controleert verlopen reminders en stuurt ze via Pushover.
 * Roep aan via Windows Taakplanner of cron-job.org, bijv. elke minuut.
 * Optioneel: Authorization: Bearer <CRON_SECRET> of ?secret=<CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const token = process.env.PUSHOVER_TOKEN;
  const user = process.env.PUSHOVER_USER;
  if (!token || !user) {
    return Response.json(
      { error: "PUSHOVER_TOKEN of PUSHOVER_USER ontbreekt" },
      { status: 500 }
    );
  }

  const cronSecret = process.env.CRON_SECRET;
  // Vanaf nu: CRON_SECRET is verplicht. Geen query-param secrets meer.
  if (!cronSecret) {
    return Response.json(
      { error: "CRON_SECRET ontbreekt (beveiliging)" },
      { status: 500 }
    );
  }
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (bearer !== cronSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.reminder.findMany({
    where: { remindAt: { lte: now }, sent: false },
    take: 50,
  });

  let sent = 0;
  for (const r of due) {
    try {
      const res = await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token,
          user,
          message: r.message,
          title: "AI Coach – herinnering",
        }),
      });
      if (res.ok) {
        await prisma.reminder.update({
          where: { id: r.id },
          data: { sent: true },
        });
        sent++;
      }
    } catch {
      // Doorgaan met volgende reminder
    }
  }

  return Response.json({ checked: due.length, sent });
}
