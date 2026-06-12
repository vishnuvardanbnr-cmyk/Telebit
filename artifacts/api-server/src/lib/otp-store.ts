interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

const store = new Map<string, OtpEntry>();

const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function storeOtp(phone: string, code: string): void {
  store.set(phone, {
    code,
    expiresAt: Date.now() + TTL_MS,
    attempts: 0,
  });
}

export type VerifyResult = "ok" | "expired" | "invalid" | "too_many_attempts";

export function verifyOtp(phone: string, code: string): VerifyResult {
  const entry = store.get(phone);
  if (!entry) return "expired";
  if (Date.now() > entry.expiresAt) {
    store.delete(phone);
    return "expired";
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(phone);
    return "too_many_attempts";
  }
  entry.attempts += 1;
  if (entry.code !== code) return "invalid";
  store.delete(phone);
  return "ok";
}

export function hasRecentOtp(phone: string): boolean {
  const entry = store.get(phone);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(phone);
    return false;
  }
  return true;
}

// ─── Tg-code flow (code → chatId, for bot OTP sign-in) ──────────────────────

interface TgCodeEntry {
  chatId: string;
  expiresAt: number;
}

const tgCodeStore = new Map<string, TgCodeEntry>();
const tgCodeByChatId = new Map<string, string>();

export function generateAndStoreTgCode(chatId: string): string {
  const existing = tgCodeByChatId.get(chatId);
  if (existing) tgCodeStore.delete(existing);

  const code = generateOtp();
  tgCodeStore.set(code, { chatId, expiresAt: Date.now() + TTL_MS });
  tgCodeByChatId.set(chatId, code);
  return code;
}

export type TgCodeVerifyResult =
  | { ok: true; chatId: string }
  | { ok: false; reason: "invalid" | "expired" };

export function verifyTgCode(code: string): TgCodeVerifyResult {
  const entry = tgCodeStore.get(code);
  if (!entry) return { ok: false, reason: "invalid" };
  if (Date.now() > entry.expiresAt) {
    tgCodeStore.delete(code);
    tgCodeByChatId.delete(entry.chatId);
    return { ok: false, reason: "expired" };
  }
  tgCodeStore.delete(code);
  tgCodeByChatId.delete(entry.chatId);
  return { ok: true, chatId: entry.chatId };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key);
  }
  for (const [code, entry] of tgCodeStore.entries()) {
    if (now > entry.expiresAt) {
      tgCodeByChatId.delete(entry.chatId);
      tgCodeStore.delete(code);
    }
  }
}, 60_000);
