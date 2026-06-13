import { Router } from "express";
import { db, usersTable, depositsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getSettings, updateSettings } from "../lib/settings";
import { sendDepositCreditEmail } from "../lib/mailer";
import { getProvider, getUsdtBalance, formatUsdt, parseUsdt, sweepUsdt, sendBnbGas, getBnbBalance } from "../lib/wallet";
import { decrypt } from "../lib/crypto";
import { ethers } from "ethers";
import { logger } from "../lib/logger";

const router = Router();

router.get("/deposits", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const deposits = await db
    .select()
    .from(depositsTable)
    .where(eq(depositsTable.userId, user.id))
    .orderBy(desc(depositsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(deposits);
});

router.post("/deposits/check", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const settings = await getSettings();

  if (!settings.bscRpcUrl) {
    res.status(400).json({ error: "BSC RPC URL not configured" });
    return;
  }

  const provider = getProvider(settings.bscRpcUrl);

  try {
    const balanceRaw = await getUsdtBalance(user.depositAddress, provider);
    const balanceStr = formatUsdt(balanceRaw);
    const minDeposit = parseFloat(settings.minDepositUsdt);

    if (parseFloat(balanceStr) < minDeposit) {
      res.json({
        found: false,
        amount: balanceStr,
        credited: null,
        message: `Balance ${balanceStr} USDT is below minimum deposit of ${minDeposit} USDT`,
      });
      return;
    }

    // Calculate fees (collected for dev wallet)
    const flatFee = parseFloat(settings.depositFeeFlat);
    const percentFee = parseFloat(settings.depositFeePercent) / 100 * parseFloat(balanceStr);
    const totalFee = flatFee + percentFee;
    const netAmount = Math.max(0, parseFloat(balanceStr) - totalFee);

    const wallet1 = settings.adminMasterWallet;
    const wallet2 = settings.adminWallet2;
    const hasSplit = !!wallet2;

    if (!wallet1) {
      res.status(400).json({ error: "Admin wallet 1 not configured" });
      return;
    }

    // Compute on-chain split amounts (bigint math, no rounding drift)
    const pct1 = BigInt(Math.round(Math.min(100, Math.max(0, parseFloat(settings.adminWallet1Percent || "80")))));
    const amount1 = balanceRaw * pct1 / 100n;
    const amount2 = balanceRaw - amount1;

    // Sweep USDT — split between wallet1 and wallet2
    let sweepTxHash: string | null = null;
    try {
      if (settings.gasWalletPrivateKey) {
        // Fund enough BNB for 1 or 2 ERC-20 transfers
        const gasAmount = ethers.parseEther(hasSplit ? "0.002" : "0.001");
        await sendBnbGas(user.depositAddress, gasAmount, settings.gasWalletPrivateKey, provider);
      }
      sweepTxHash = await sweepUsdt(
        user.depositPrivateKeyEncrypted,
        wallet1,
        amount1,
        provider
      );
      if (hasSplit && amount2 > 0n) {
        await sweepUsdt(
          user.depositPrivateKeyEncrypted,
          wallet2,
          amount2,
          provider
        );
      }
    } catch (err) {
      logger.warn({ err }, "Sweep failed, crediting anyway");
    }

    // Credit user wallet + update NFT-related deposit tracking
    const currentBalance = parseFloat(user.walletBalance);
    const newBalance = currentBalance + netAmount;
    const newDepositedAmount = parseFloat(user.userDepositedAmount ?? "0") + netAmount;
    const newInvestedUsdt = parseFloat(user.investedUsdt ?? "0") + netAmount;

    await db.update(usersTable)
      .set({
        walletBalance: String(newBalance),
        userDepositedAmount: String(newDepositedAmount),
        investedUsdt: String(newInvestedUsdt),
      } as any)
      .where(eq(usersTable.id, user.id));

    const [deposit] = await db.insert(depositsTable).values({
      userId: user.id,
      amount: balanceStr,
      fee: String(totalFee),
      netAmount: String(netAmount),
      status: "credited",
      sweepTxHash,
      creditedAt: new Date(),
    }).returning();

    // Accumulate dev fees
    if (totalFee > 0) {
      const currentAccumulated = parseFloat(settings.devAccumulatedFees || "0");
      await updateSettings({ devAccumulatedFees: String(currentAccumulated + totalFee) });
    }

    // Send deposit credited email (fire-and-forget)
    sendDepositCreditEmail(user.email, user.fullName ?? user.email, String(netAmount)).catch(() => {});

    res.json({
      found: true,
      amount: balanceStr,
      credited: String(netAmount),
      message: `Successfully credited ${netAmount.toFixed(4)} USDT to your wallet`,
      deposit,
    });
  } catch (err) {
    req.log.error({ err }, "Deposit check failed");
    res.status(500).json({ error: "Failed to check deposit. Check BSC RPC configuration." });
  }
});

export default router;
