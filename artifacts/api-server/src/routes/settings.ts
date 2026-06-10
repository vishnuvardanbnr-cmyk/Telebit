import { Router } from "express";
import { getSettings } from "../lib/settings";

const router = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await getSettings();
  res.json({
    minDepositUsdt: settings.minDepositUsdt,
    depositFeeFlat: settings.depositFeeFlat,
    depositFeePercent: settings.depositFeePercent,
    withdrawFeeFlat: settings.withdrawFeeFlat,
    withdrawFeePercent: settings.withdrawFeePercent,
    withdrawFeeMode: settings.withdrawFeeMode,
    withdrawalEnabled: settings.withdrawalEnabled,
    otpWithdrawalEnabled: settings.otpWithdrawalEnabled,
  });
});

router.get("/settings/telegram", async (_req, res): Promise<void> => {
  const settings = await getSettings();
  res.json({
    botUsername: settings.telegramBotUsername,
    configured: !!settings.telegramBotUsername && !!settings.telegramBotToken,
  });
});

export default router;
