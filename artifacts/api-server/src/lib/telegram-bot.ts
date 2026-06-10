export async function sendTelegramMessage(
  botToken: string,
  chatId: bigint | number,
  text: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: Number(chatId), text }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { description?: string };
    throw new Error(`Telegram API error: ${body.description ?? res.statusText}`);
  }
}

export async function setTelegramWebhook(
  botToken: string,
  webhookUrl: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { description?: string };
    throw new Error(`setWebhook error: ${body.description ?? res.statusText}`);
  }
}

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}
