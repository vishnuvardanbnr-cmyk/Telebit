import MTProto from "@mtproto/core";
import path from "node:path";
import os from "node:os";

const API_ID = Number(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH ?? "";

export function isConfigured(): boolean {
  return !!API_ID && !!API_HASH;
}

interface PendingEntry {
  mtproto: InstanceType<typeof MTProto>;
  phoneCodeHash: string;
  phone: string;
  expiresAt: number;
}

// One MTProto instance per phone number, holding the session state needed for sign-in
const pending = new Map<string, PendingEntry>();
const TTL_MS = 10 * 60 * 1000;

function makeMTProto(tag: string): InstanceType<typeof MTProto> {
  return new MTProto({
    api_id: API_ID,
    api_hash: API_HASH,
    storageOptions: {
      path: path.join(os.tmpdir(), `tg-session-${tag}.json`),
    },
  });
}

async function callWithDcRetry(
  mtproto: InstanceType<typeof MTProto>,
  method: string,
  params: Record<string, unknown>,
): Promise<any> {
  try {
    return await (mtproto as any).call(method, params);
  } catch (err: any) {
    if (err?.error_message?.startsWith("PHONE_MIGRATE_")) {
      const dc = Number(err.error_message.replace("PHONE_MIGRATE_", ""));
      await (mtproto as any).setDefaultDc(dc);
      return await (mtproto as any).call(method, params);
    }
    if (err?.error_message?.startsWith("NETWORK_MIGRATE_")) {
      const dc = Number(err.error_message.replace("NETWORK_MIGRATE_", ""));
      await (mtproto as any).setDefaultDc(dc);
      return await (mtproto as any).call(method, params);
    }
    throw err;
  }
}

export async function sendCode(phone: string): Promise<void> {
  // Replace any existing pending entry for this phone
  pending.delete(phone);

  const mtproto = makeMTProto(Buffer.from(phone).toString("hex"));

  const result = await callWithDcRetry(mtproto, "auth.sendCode", {
    phone_number: phone,
    settings: { _: "codeSettings" },
  });

  pending.set(phone, {
    mtproto,
    phoneCodeHash: result.phone_code_hash,
    phone,
    expiresAt: Date.now() + TTL_MS,
  });
}

export interface SignInResult {
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  phone: string;
  photoDataUrl?: string;
}

async function tryDownloadProfilePhoto(
  mtproto: InstanceType<typeof MTProto>,
): Promise<string | null> {
  try {
    const photosResult = await (mtproto as any).call("photos.getUserPhotos", {
      user_id: { _: "inputUserSelf" },
      offset: 0,
      max_id: "0",
      limit: 1,
    });

    const photo = photosResult?.photos?.[0];
    if (!photo) return null;

    // Prefer medium (x) or any available photoSize (not stripped)
    const size =
      photo.sizes?.find((s: any) => s._ === "photoSize" && s.type === "x") ??
      photo.sizes?.find((s: any) => s._ === "photoSize");
    if (!size) return null;

    const fileResult = await (mtproto as any).call("upload.getFile", {
      location: {
        _: "inputPhotoFileLocation",
        id: photo.id,
        access_hash: photo.access_hash,
        file_reference: photo.file_reference,
        thumb_size: size.type,
      },
      offset: 0,
      limit: 512 * 1024,
    });

    if (!fileResult?.bytes?.length) return null;
    const b64 = Buffer.from(fileResult.bytes).toString("base64");
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    return null;
  }
}

export async function signIn(phone: string, code: string): Promise<SignInResult> {
  const entry = pending.get(phone);
  if (!entry) throw new Error("No pending auth for this phone — please request a new code.");
  if (Date.now() > entry.expiresAt) {
    pending.delete(phone);
    throw new Error("Session expired — please request a new code.");
  }

  const { mtproto, phoneCodeHash } = entry;

  let result: any;
  try {
    result = await callWithDcRetry(mtproto, "auth.signIn", {
      phone_number: phone,
      phone_code_hash: phoneCodeHash,
      phone_code: code,
    });
  } catch (err: any) {
    if (err?.error_message === "SESSION_PASSWORD_NEEDED") {
      pending.delete(phone);
      throw new Error("Two-step verification (2FA) is enabled on this account. Please disable it temporarily to sign in.");
    }
    throw err;
  }

  // Download profile photo while session is still live (before deleting from pending)
  const photoDataUrl = await tryDownloadProfilePhoto(mtproto).catch(() => null);

  pending.delete(phone);

  const user = result.user ?? result;
  return {
    telegramId: String(user.id),
    firstName: user.first_name ?? "",
    lastName: user.last_name ?? undefined,
    username: user.username ?? undefined,
    phone,
    photoDataUrl: photoDataUrl ?? undefined,
  };
}

// Expire stale entries
setInterval(() => {
  const now = Date.now();
  for (const [phone, entry] of pending) {
    if (now > entry.expiresAt) pending.delete(phone);
  }
}, 60_000);
