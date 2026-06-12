import { db, platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface Settings {
  minDepositUsdt: string;
  depositFeeFlat: string;
  depositFeePercent: string;
  withdrawFeeFlat: string;
  withdrawFeePercent: string;
  withdrawFeeMode: "deduct_from_amount" | "deduct_from_balance";
  withdrawalMode: "manual" | "auto";
  withdrawalEnabled: boolean;
  otpWithdrawalEnabled: boolean;
  adminMasterWallet: string;
  gasWalletPrivateKey: string;
  withdrawWalletPrivateKey: string;
  bscRpcUrl: string;
  telegramBotToken: string;
  telegramBotUsername: string;
  emailVerificationEnabled: boolean;
  loginOtpEnabled: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFromEmail: string;
  smtpFromName: string;
}

const DEFAULTS: Settings = {
  minDepositUsdt: "1",
  depositFeeFlat: "0",
  depositFeePercent: "0",
  withdrawFeeFlat: "1",
  withdrawFeePercent: "1",
  withdrawFeeMode: "deduct_from_amount",
  withdrawalMode: "manual",
  withdrawalEnabled: true,
  otpWithdrawalEnabled: false,
  adminMasterWallet: "",
  gasWalletPrivateKey: "",
  withdrawWalletPrivateKey: "",
  bscRpcUrl: "https://bsc-dataseed.binance.org/",
  telegramBotToken: "",
  telegramBotUsername: "",
  emailVerificationEnabled: false,
  loginOtpEnabled: false,
  smtpHost: "",
  smtpPort: "587",
  smtpUser: "",
  smtpPass: "",
  smtpFromEmail: "",
  smtpFromName: "Telebit Shop",
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(platformSettingsTable);
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }

  return {
    minDepositUsdt: map.minDepositUsdt ?? DEFAULTS.minDepositUsdt,
    depositFeeFlat: map.depositFeeFlat ?? DEFAULTS.depositFeeFlat,
    depositFeePercent: map.depositFeePercent ?? DEFAULTS.depositFeePercent,
    withdrawFeeFlat: map.withdrawFeeFlat ?? DEFAULTS.withdrawFeeFlat,
    withdrawFeePercent: map.withdrawFeePercent ?? DEFAULTS.withdrawFeePercent,
    withdrawFeeMode: (map.withdrawFeeMode as Settings["withdrawFeeMode"]) ?? DEFAULTS.withdrawFeeMode,
    withdrawalMode: (map.withdrawalMode as Settings["withdrawalMode"]) ?? DEFAULTS.withdrawalMode,
    withdrawalEnabled: map.withdrawalEnabled === undefined ? DEFAULTS.withdrawalEnabled : map.withdrawalEnabled === "true",
    otpWithdrawalEnabled: map.otpWithdrawalEnabled === "true",
    adminMasterWallet: map.adminMasterWallet ?? DEFAULTS.adminMasterWallet,
    gasWalletPrivateKey: map.gasWalletPrivateKey ?? DEFAULTS.gasWalletPrivateKey,
    withdrawWalletPrivateKey: map.withdrawWalletPrivateKey ?? DEFAULTS.withdrawWalletPrivateKey,
    bscRpcUrl: map.bscRpcUrl ?? DEFAULTS.bscRpcUrl,
    telegramBotToken: map.telegramBotToken ?? DEFAULTS.telegramBotToken,
    telegramBotUsername: map.telegramBotUsername ?? DEFAULTS.telegramBotUsername,
    emailVerificationEnabled: map.emailVerificationEnabled === "true",
    loginOtpEnabled: map.loginOtpEnabled === "true",
    smtpHost: map.smtpHost ?? DEFAULTS.smtpHost,
    smtpPort: map.smtpPort ?? DEFAULTS.smtpPort,
    smtpUser: map.smtpUser ?? DEFAULTS.smtpUser,
    smtpPass: map.smtpPass ?? DEFAULTS.smtpPass,
    smtpFromEmail: map.smtpFromEmail ?? DEFAULTS.smtpFromEmail,
    smtpFromName: map.smtpFromName ?? DEFAULTS.smtpFromName,
  };
}

export async function updateSettings(updates: Partial<Settings>): Promise<void> {
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    const strValue = typeof value === "boolean" ? String(value) : String(value);
    const existing = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key));
    if (existing.length > 0) {
      await db.update(platformSettingsTable).set({ value: strValue }).where(eq(platformSettingsTable.key, key));
    } else {
      await db.insert(platformSettingsTable).values({ key, value: strValue });
    }
  }
}
