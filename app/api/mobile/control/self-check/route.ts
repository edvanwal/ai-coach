import { NextResponse } from "next/server";
import { handleCommand } from "@/lib/mobile-control/service";
import { noStoreHeaders } from "@/lib/mobile-control/security";

export const runtime = "nodejs";

export async function POST() {
  try {
    // Simuleer 2 projecten zodat we kunnen controleren dat flows naast elkaar werken.
    const runA = await handleCommand({
      text: "project ai-coach: new maak een korte statusupdate",
      channel: "api",
      sender: "self-check",
    });
    const runB = await handleCommand({
      text: "project template: new check of multi-project routering werkt",
      channel: "api",
      sender: "self-check",
    });

    return NextResponse.json(
      {
        ok: true,
        checks: {
          projectA: { ok: runA.ok, runId: runA.run?.id, projectAlias: runA.run?.projectAlias },
          projectB: { ok: runB.ok, runId: runB.run?.id, projectAlias: runB.run?.projectAlias },
          isolated: Boolean(runA.run?.id && runB.run?.id && runA.run.id !== runB.run.id),
        },
      },
      { headers: noStoreHeaders() }
    );
  } catch (err) {
    console.error("mobile self-check error:", err);
    return NextResponse.json(
      { ok: false, error: "Self-check mislukt" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}

