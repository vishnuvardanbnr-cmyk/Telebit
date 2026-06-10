import { Router } from "express";
import { db, usersTable, withdrawalsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { getSettings } from "../lib/settings";
import { getProvider, sweepUsdt, sendBnbGas, getBnbBalance } from "../lib/wallet";
import { encrypt } from "../lib/crypto";
import { ethers } from "ethers";
import { logger } from "../lib/logger";

const router = Router();

router.get("/withdrawals", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const withdrawals = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, user.id))
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(withdrawals);
});

router.post("/withdrawals", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const { amount, destinationAddress } = req.body;

  if (!amount || !destinationAddress) {
    res.status(400).json({ error: "Amount and destination address are required" });
    return;
  }

  const settings = await getSettings();

  if (!settings.withdrawalEnabled) {
    res.status(400).json({ error: "Withdrawals are currently disabled" });
    return;
  }

  if (user.withdrawalBlocked) {
    res.status(400).json({ error: "Your account has a withdrawal block. Contact support." });
    return;
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  // Calculate fee
  const flatFee = parseFloat(settings.withdrawFeeFlat);
  const percentFee = parseFloat(settings.withdrawFeePercent) / 100 * amountNum;
  const totalFee = flatFee + percentFee;

  let netAmount: number;
  let deductFrom: number;

  if (settings.withdrawFeeMode === "deduct_from_amount") {
    netAmount = Math.max(0, amountNum - totalFee);
    deductFrom = amountNum;
  } else {
    netAmount = amountNum;
    deductFrom = amountNum + totalFee;
  }

  const walletBalance = parseFloat(user.walletBalance);
  if (walletBalance < deductFrom) {
    res.status(400).json({ error: `Insufficient balance. Required: ${deductFrom.toFixed(4)} USDT` });
    return;
  }

  // Deduct from balance
  await db.update(usersTable)
    .set({ walletBalance: String(walletBalance - deductFrom) })
    .where(eq(usersTable.id, user.id));

  const [withdrawal] = await db.insert(withdrawalsTable).values({
    userId: user.id,
    amount: String(amountNum),
    fee: String(totalFee),
    netAmount: String(netAmount),
    destinationAddress,
    status: "pending",
  }).returning();

  // Auto mode: execute on-chain immediately if configured
  if (settings.withdrawalMode === "auto" && settings.withdrawWalletPrivateKey) {
    try {
      const provider = getProvider(settings.bscRpcUrl);

      // Send BNB gas if needed
      if (settings.gasWalletPrivateKey) {
        const withdrawWallet = new ethers.Wallet(settings.withdrawWalletPrivateKey, provider);
        const bnbBalance = await getBnbBalance(withdrawWallet.address, provider);
        if (bnbBalance < ethers.parseEther("0.001")) {
          await sendBnbGas(withdrawWallet.address, ethers.parseEther("0.002"), settings.gasWalletPrivateKey, provider);
        }
      }

      // Wrap private key in encrypted format for sweepUsdt
      const encryptedKey = encrypt(settings.withdrawWalletPrivateKey);
      const txHash = await sweepUsdt(encryptedKey, destinationAddress, ethers.parseUnits(String(netAmount), 18), provider);

      await db.update(withdrawalsTable)
        .set({ status: "approved", txHash, processedAt: new Date() })
        .where(eq(withdrawalsTable.id, withdrawal.id));

      withdrawal.status = "approved";
      withdrawal.txHash = txHash;
    } catch (err) {
      logger.error({ err, withdrawalId: withdrawal.id }, "Auto withdrawal failed");
    }
  }

  res.status(201).json(withdrawal);
});

export default router;
