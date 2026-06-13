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
  adminWallet2: string;
  adminWallet1Percent: string;
  gasWalletPrivateKey: string;
  withdrawWalletPrivateKey: string;
  bscRpcUrl: string;
  telegramBotToken: string;
  telegramBotUsername: string;
  smtpEnabled: boolean;
  emailVerificationEnabled: boolean;
  loginOtpEnabled: boolean;
  welcomeEmailEnabled: boolean;
  orderConfirmEmailEnabled: boolean;
  depositCreditEmailEnabled: boolean;
  withdrawalStatusEmailEnabled: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFromEmail: string;
  smtpFromName: string;
  adminExcessWallet: string;
  shareValueUsdt: string;
  sharesPerPackage: string;
  // Dev panel
  devWallet: string;
  devAccumulatedFees: string;
  devPanelPassword: string;
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
  adminWallet2: "",
  adminWallet1Percent: "80",
  gasWalletPrivateKey: "",
  withdrawWalletPrivateKey: "",
  bscRpcUrl: "https://bsc-dataseed.binance.org/",
  telegramBotToken: "",
  telegramBotUsername: "",
  smtpEnabled: false,
  emailVerificationEnabled: false,
  loginOtpEnabled: false,
  welcomeEmailEnabled: false,
  orderConfirmEmailEnabled: false,
  depositCreditEmailEnabled: false,
  withdrawalStatusEmailEnabled: false,
  smtpHost: "",
  smtpPort: "587",
  smtpUser: "",
  smtpPass: "",
  smtpFromEmail: "",
  smtpFromName: "Telebit Shop",
  adminExcessWallet: "0",
  shareValueUsdt: "0",
  sharesPerPackage: "50",
  devWallet: "",
  devAccumulatedFees: "0",
  devPanelPassword: "telebit-dev-2024",
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
    adminWallet2: map.adminWallet2 ?? DEFAULTS.adminWallet2,
    adminWallet1Percent: map.adminWallet1Percent ?? DEFAULTS.adminWallet1Percent,
    gasWalletPrivateKey: map.gasWalletPrivateKey ?? DEFAULTS.gasWalletPrivateKey,
    withdrawWalletPrivateKey: map.withdrawWalletPrivateKey ?? DEFAULTS.withdrawWalletPrivateKey,
    bscRpcUrl: map.bscRpcUrl ?? DEFAULTS.bscRpcUrl,
    telegramBotToken: map.telegramBotToken ?? DEFAULTS.telegramBotToken,
    telegramBotUsername: map.telegramBotUsername ?? DEFAULTS.telegramBotUsername,
    smtpEnabled: map.smtpEnabled === "true",
    emailVerificationEnabled: map.emailVerificationEnabled === "true",
    loginOtpEnabled: map.loginOtpEnabled === "true",
    welcomeEmailEnabled: map.welcomeEmailEnabled === "true",
    orderConfirmEmailEnabled: map.orderConfirmEmailEnabled === "true",
    depositCreditEmailEnabled: map.depositCreditEmailEnabled === "true",
    withdrawalStatusEmailEnabled: map.withdrawalStatusEmailEnabled === "true",
    smtpHost: map.smtpHost ?? DEFAULTS.smtpHost,
    smtpPort: map.smtpPort ?? DEFAULTS.smtpPort,
    smtpUser: map.smtpUser ?? DEFAULTS.smtpUser,
    smtpPass: map.smtpPass ?? DEFAULTS.smtpPass,
    smtpFromEmail: map.smtpFromEmail ?? DEFAULTS.smtpFromEmail,
    smtpFromName: map.smtpFromName ?? DEFAULTS.smtpFromName,
    adminExcessWallet: map.adminExcessWallet ?? DEFAULTS.adminExcessWallet,
    shareValueUsdt: map.shareValueUsdt ?? DEFAULTS.shareValueUsdt,
    sharesPerPackage: map.sharesPerPackage ?? DEFAULTS.sharesPerPackage,
    devWallet: map.devWallet ?? DEFAULTS.devWallet,
    devAccumulatedFees: map.devAccumulatedFees ?? DEFAULTS.devAccumulatedFees,
    devPanelPassword: map.devPanelPassword ?? DEFAULTS.devPanelPassword,
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
