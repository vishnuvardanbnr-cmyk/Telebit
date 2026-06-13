import { Router } from "express";
import { getSettings, updateSettings } from "../lib/settings";
import { getProvider, sweepUsdt, sendBnbGas, getBnbBalance } from "../lib/wallet";
import { encrypt } from "../lib/crypto";
import { ethers } from "ethers";
import { logger } from "../lib/logger";

const router = Router();

// ─── Dev panel auth middleware ─────────────────────────────────────────────────

async function requireDevSecret(req: any, res: any, next: any): Promise<void> {
  const secret = req.headers["x-dev-secret"] as string | undefined;
  if (!secret) {
    res.status(401).json({ error: "Dev secret required" });
    return;
  }
  const settings = await getSettings();
  if (secret !== settings.devPanelPassword) {
    res.status(403).json({ error: "Invalid dev secret" });
    return;
  }
  next();
}

// ─── GET /dev/settings ────────────────────────────────────────────────────────

router.get("/dev/settings", requireDevSecret, async (_req, res): Promise<void> => {
  const settings = await getSettings();
  res.json({
    depositFeeFlat: settings.depositFeeFlat,
    depositFeePercent: settings.depositFeePercent,
    withdrawFeeFlat: settings.withdrawFeeFlat,
    withdrawFeePercent: settings.withdrawFeePercent,
    devWallet: settings.devWallet,
    devAccumulatedFees: settings.devAccumulatedFees,
  });
});

// ─── PUT /dev/settings ────────────────────────────────────────────────────────

router.put("/dev/settings", requireDevSecret, async (req, res): Promise<void> => {
  const { depositFeeFlat, depositFeePercent, withdrawFeeFlat, withdrawFeePercent, devWallet, devPanelPassword } = req.body;

  const updates: Record<string, string> = {};
  if (depositFeeFlat   !== undefined) updates.depositFeeFlat   = String(depositFeeFlat);
  if (depositFeePercent !== undefined) updates.depositFeePercent = String(depositFeePercent);
  if (withdrawFeeFlat  !== undefined) updates.withdrawFeeFlat  = String(withdrawFeeFlat);
  if (withdrawFeePercent !== undefined) updates.withdrawFeePercent = String(withdrawFeePercent);
  if (devWallet        !== undefined) updates.devWallet        = String(devWallet);
  if (devPanelPassword !== undefined) updates.devPanelPassword = String(devPanelPassword);

  await updateSettings(updates as any);
  res.json({ ok: true });
});

// ─── POST /dev/transfer ───────────────────────────────────────────────────────
// Transfers accumulated dev fees to the configured devWallet on-chain

router.post("/dev/transfer", requireDevSecret, async (_req, res): Promise<void> => {
  const settings = await getSettings();

  const accumulated = parseFloat(settings.devAccumulatedFees || "0");
  if (accumulated <= 0) {
    res.status(400).json({ error: "No accumulated fees to transfer" });
    return;
  }

  if (!settings.devWallet) {
    res.status(400).json({ error: "Dev wallet address not configured" });
    return;
  }

  if (!settings.withdrawWalletPrivateKey) {
    res.status(400).json({ error: "Withdraw wallet private key not configured" });
    return;
  }

  if (!settings.bscRpcUrl) {
    res.status(400).json({ error: "BSC RPC URL not configured" });
    return;
  }

  try {
    const provider = getProvider(settings.bscRpcUrl);

    if (settings.gasWalletPrivateKey) {
      const withdrawWallet = new ethers.Wallet(settings.withdrawWalletPrivateKey, provider);
      const bnbBalance = await getBnbBalance(withdrawWallet.address, provider);
      if (bnbBalance < ethers.parseEther("0.001")) {
        await sendBnbGas(withdrawWallet.address, ethers.parseEther("0.002"), settings.gasWalletPrivateKey, provider);
      }
    }

    const encryptedKey = encrypt(settings.withdrawWalletPrivateKey);
    const amountUnits = ethers.parseUnits(accumulated.toFixed(8), 18);
    const txHash = await sweepUsdt(encryptedKey, settings.devWallet, amountUnits, provider);

    await updateSettings({ devAccumulatedFees: "0" });

    logger.info({ txHash, amount: accumulated, devWallet: settings.devWallet }, "Dev fees transferred");
    res.json({ ok: true, txHash, amount: accumulated });
  } catch (err) {
    logger.error({ err }, "Dev fee transfer failed");
    res.status(500).json({ error: "Transfer failed. Check wallet configuration and balance." });
  }
});

export default router;
