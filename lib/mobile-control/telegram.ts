export async function sendTelegramText(chatId: string, message: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    cache: "no-store",
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
    }),
  });
  return res.ok;
}

export function extractTelegramText(payload: unknown): { sender?: string; chatId?: string; text?: string } {
  const obj = payload as {
    message?: {
      from?: { id?: number | string };
      chat?: { id?: number | string };
      text?: unknown;
    };
  };
  const msg = obj.message;
  if (typeof msg?.text !== "string" || !msg.text.trim()) return {};

  const sender = msg.from?.id != null ? String(msg.from.id) : undefined;
  const chatId = msg.chat?.id != null ? String(msg.chat.id) : undefined;
  return {
    sender,
    chatId,
    text: msg.text.trim(),
  };
}

