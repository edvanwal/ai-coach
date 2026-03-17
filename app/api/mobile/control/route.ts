import { NextRequest, NextResponse } from "next/server";
import { getControlOverview, handleCommand } from "@/lib/mobile-control/service";
import { isAllowedSender, noStoreHeaders } from "@/lib/mobile-control/security";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getControlOverview(), { headers: noStoreHeaders() });
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    let body: { text?: string; channel?: string; sender?: string };
    try {
      body = JSON.parse(raw) as { text?: string; channel?: string; sender?: string };
    } catch {
      return NextResponse.json(
        { ok: false, error: "Ongeldige JSON body" },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    const text = (body.text ?? "").trim();
    const sender = body.sender?.trim();
    const channel = (body.channel ?? "api").trim() as "api" | "whatsapp" | "telegram" | "slack";

    if (!text) {
      return NextResponse.json({ ok: false, error: "text is verplicht" }, { status: 400, headers: noStoreHeaders() });
    }
    if (!isAllowedSender(sender)) {
      return NextResponse.json({ ok: false, error: "Afzender niet geautoriseerd" }, { status: 403, headers: noStoreHeaders() });
    }

    const result = await handleCommand({ text, channel, sender });
    return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: noStoreHeaders() });
  } catch (err) {
    console.error("mobile control POST error:", err);
    return NextResponse.json({ ok: false, error: "Mobiele opdracht verwerken mislukt" }, { status: 500, headers: noStoreHeaders() });
  }
}

