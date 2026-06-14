const BASE =
  typeof process !== "undefined"
    ? (process.env.EXPO_PUBLIC_API_URL ?? "https://telebit-1.replit.app")
    : "https://telebit-1.replit.app";

let tokenGetter: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  tokenGetter = fn;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenGetter ? await tokenGetter() : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  walletBalance: string;
  earningsBalance: string;
  depositAddress: string;
  referralCode: string;
  isAdmin: boolean;
  withdrawalBlocked: boolean;
  totalIncomeEarned?: string;
  createdAt: string;
}

export interface Dashboard {
  walletBalance: string;
  earningsBalance: string;
  totalIncomeEarned: string;
  activePackages?: number;
  referralCount?: number;
  teamSize?: number;
  rank?: string;
}

export interface Deposit {
  id: string;
  amount: string;
  txHash: string | null;
  status: string;
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  amount: string;
  toAddress: string;
  status: string;
  createdAt: string;
}

export interface Package {
  id: string;
  name: string;
  price: string;
  roiPercent: string;
  durationDays: number;
  description: string | null;
  isActive: boolean;
}

export interface UserPackage {
  id: string;
  packageId: string;
  packageName: string | null;
  purchasePrice: string;
  dailyRoiAmount: string | null;
  status: string;
  purchasedAt: string;
  expiresAt: string | null;
}

export interface IncomeEntry {
  id: string;
  type: "roi" | "referral" | "royalty" | "rank_reward";
  amount: string;
  description: string | null;
  fromUserId: string | null;
  createdAt: string;
}

export interface IncomeSummary {
  roi: string;
  referral: string;
  royalty: string;
  rankReward?: string;
}

export const api = {
  auth: {
    login: (email: string, password: string, otpCode?: string) =>
      req<{ token: string; user: User; otpRequired?: boolean }>("POST", "/api/auth/login", {
        email,
        password,
        otpCode,
      }),
    register: (data: {
      email: string;
      password: string;
      fullName: string;
      referralCode?: string;
      otpCode?: string;
    }) => req<{ token: string; user: User }>("POST", "/api/auth/register", data),
    sendEmailOtp: (email: string, purpose: string) =>
      req<{ success: boolean }>("POST", "/api/auth/send-email-otp", { email, purpose }),
    checkReferral: (code: string) =>
      req<{ valid: boolean }>("GET", `/api/auth/check-referral?code=${encodeURIComponent(code)}`),
    logout: () => req<{ success: boolean }>("POST", "/api/auth/logout"),
  },
  me: {
    get: () => req<User>("GET", "/api/users/me"),
    dashboard: () => req<Dashboard>("GET", "/api/users/me/dashboard"),
  },
  deposits: {
    list: () => req<Deposit[]>("GET", "/api/deposits"),
    check: () => req<{ found: boolean; amount?: string }>("POST", "/api/deposits/check"),
  },
  withdrawals: {
    list: () => req<Withdrawal[]>("GET", "/api/withdrawals"),
    create: (data: { amount: string; toAddress: string }) =>
      req<Withdrawal>("POST", "/api/withdrawals", data),
  },
  packages: {
    list: () => req<Package[]>("GET", "/api/packages"),
    my: () => req<UserPackage[]>("GET", "/api/packages/my"),
    purchase: (packageId: string) =>
      req<{ success: boolean }>("POST", "/api/packages/purchase", { packageId }),
  },
  income: {
    list: (type?: string) =>
      req<IncomeEntry[]>("GET", `/api/income${type ? `?type=${type}` : ""}`),
    summary: () => req<IncomeSummary>("GET", "/api/income/summary"),
  },
};
