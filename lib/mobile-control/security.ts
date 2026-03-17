import crypto from "crypto";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export function noStoreHeaders(extra?: Record<string, string>): Record<string, string> {
  return { ...NO_STORE_HEADERS, ...(extra ?? {}) };
}

export function getAllowlist(): Set<string> {
  const raw = process.env.MOBILE_CONTROL_ALLOWLIST ?? "";
  const values = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(values);
}

export function isAllowedSender(sender?: string): boolean {
  const allowlist = getAllowlist();
  if (allowlist.size === 0) return true;
  if (!sender) return false;
  return allowlist.has(sender);
}

export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return true;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const got = signatureHeader.replace("sha256=", "");
  const a = Buffer.from(got, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyTelegramSecret(secretHeader: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true;
  if (!secretHeader) return false;
  return secretHeader === expected;
}

