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
): Promise<{ description: string }> {
  const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
      signal: ac.signal,
    });
  } catch (err: any) {
    clearTimeout(timer);
    throw new Error(err.name === "AbortError" ? "Request timed out after 10s" : err.message);
  }
  clearTimeout(timer);
  const body = await res.json().catch(() => ({})) as { ok?: boolean; description?: string; result?: unknown };
  if (!res.ok || body.ok === false) {
    throw new Error(`Telegram: ${body.description ?? res.statusText}`);
  }
  return { description: String(body.description ?? "Webhook was set") };
}

export async function fetchTelegramPhotoUrl(
  botToken: string,
  chatId: bigint | number,
): Promise<string | null> {
  try {
    const photosRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${Number(chatId)}&limit=1`,
    );
    if (!photosRes.ok) return null;
    const photosBody = await photosRes.json() as { ok: boolean; result?: { photos?: { file_id: string }[][] } };
    const fileId = photosBody.result?.photos?.[0]?.[0]?.file_id;
    if (!fileId) return null;

    const fileRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
    );
    if (!fileRes.ok) return null;
    const fileBody = await fileRes.json() as { ok: boolean; result?: { file_path?: string } };
    const filePath = fileBody.result?.file_path;
    if (!filePath) return null;

    return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  } catch {
    return null;
  }
}

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}
