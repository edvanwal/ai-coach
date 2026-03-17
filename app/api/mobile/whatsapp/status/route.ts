import { NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/mobile-control/security";

export const runtime = "nodejs";

export async function GET() {
  const hasVerifyToken = Boolean(process.env.WHATSAPP_VERIFY_TOKEN);
  const hasAppSecret = Boolean(process.env.WHATSAPP_APP_SECRET);
  const hasAccessToken = Boolean(process.env.WHATSAPP_ACCESS_TOKEN);
  const hasPhoneNumberId = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID);

  return NextResponse.json(
    {
      ok: true,
      configured: hasVerifyToken && hasAppSecret && hasAccessToken && hasPhoneNumberId,
      checks: {
        verifyToken: hasVerifyToken,
        appSecret: hasAppSecret,
        accessToken: hasAccessToken,
        phoneNumberId: hasPhoneNumberId,
      },
      webhookUrlPath: "/api/mobile/whatsapp/webhook",
    },
    { headers: noStoreHeaders() }
  );
}

