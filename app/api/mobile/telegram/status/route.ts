import { NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/mobile-control/security";

export const runtime = "nodejs";

export async function GET() {
  const hasBotToken = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const hasWebhookSecret = Boolean(process.env.TELEGRAM_WEBHOOK_SECRET);

  return NextResponse.json(
    {
      ok: true,
      configured: hasBotToken,
      checks: {
        botToken: hasBotToken,
        webhookSecret: hasWebhookSecret,
      },
      webhookUrlPath: "/api/mobile/telegram/webhook",
    },
    { headers: noStoreHeaders() }
  );
}

