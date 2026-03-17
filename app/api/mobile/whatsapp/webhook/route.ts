import { NextRequest, NextResponse } from "next/server";
import { handleCommand } from "@/lib/mobile-control/service";
import {
  isAllowedSender,
  noStoreHeaders,
  verifyWhatsAppSignature,
} from "@/lib/mobile-control/security";
import { extractWhatsAppText, sendWhatsAppText } from "@/lib/mobile-control/whatsapp";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Meta webhook verify
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && token && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200, headers: noStoreHeaders() });
  }
  return NextResponse.json({ ok: false, error: "Webhook verify mislukt" }, { status: 403, headers: noStoreHeaders() });
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    if (!verifyWhatsAppSignature(raw, signature)) {
      return NextResponse.json({ ok: false, error: "Ongeldige signature" }, { status: 401, headers: noStoreHeaders() });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, error: "Ongeldige JSON payload" }, { status: 400, headers: noStoreHeaders() });
    }

    const { sender, text } = extractWhatsAppText(payload);
    if (!sender || !text) {
      return NextResponse.json({ ok: true, ignored: true }, { headers: noStoreHeaders() });
    }

    if (!isAllowedSender(sender)) {
      await sendWhatsAppText(sender, "Niet geautoriseerd voor mobiele agent-control.");
      return NextResponse.json({ ok: false, error: "Afzender niet geautoriseerd" }, { status: 403, headers: noStoreHeaders() });
    }

    const result = await handleCommand({ text, sender, channel: "whatsapp" });
    await sendWhatsAppText(sender, result.message);
    return NextResponse.json({ ok: true, result }, { headers: noStoreHeaders() });
  } catch (err) {
    console.error("whatsapp webhook error:", err);
    return NextResponse.json({ ok: false, error: "Webhook verwerken mislukt" }, { status: 500, headers: noStoreHeaders() });
  }
}

