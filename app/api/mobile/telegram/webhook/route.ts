import { NextRequest, NextResponse } from "next/server";
import { handleCommand } from "@/lib/mobile-control/service";
import {
  isAllowedSender,
  noStoreHeaders,
  verifyTelegramSecret,
} from "@/lib/mobile-control/security";
import { extractTelegramText, sendTelegramText } from "@/lib/mobile-control/telegram";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { ok: true, message: "Telegram webhook endpoint actief" },
    { headers: noStoreHeaders() }
  );
}

export async function POST(req: NextRequest) {
  try {
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    if (!verifyTelegramSecret(secretHeader)) {
      return NextResponse.json(
        { ok: false, error: "Ongeldige Telegram webhook secret" },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const payload = (await req.json()) as unknown;
    const { sender, chatId, text } = extractTelegramText(payload);
    if (!sender || !chatId || !text) {
      return NextResponse.json({ ok: true, ignored: true }, { headers: noStoreHeaders() });
    }

    if (!isAllowedSender(sender)) {
      await sendTelegramText(chatId, "Niet geautoriseerd voor mobiele agent-control.");
      return NextResponse.json(
        { ok: false, error: "Afzender niet geautoriseerd" },
        { status: 403, headers: noStoreHeaders() }
      );
    }

    const result = await handleCommand({ text, sender, channel: "telegram" });
    await sendTelegramText(chatId, result.message);
    return NextResponse.json({ ok: true, result }, { headers: noStoreHeaders() });
  } catch (err) {
    console.error("telegram webhook error:", err);
    return NextResponse.json(
      { ok: false, error: "Telegram webhook verwerken mislukt" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}

