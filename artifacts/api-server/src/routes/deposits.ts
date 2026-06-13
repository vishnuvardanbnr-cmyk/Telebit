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

    // ── Fee & split calculation ───────────────────────────────────────────────
    const flatFee    = parseFloat(settings.depositFeeFlat);
    const percentFee = parseFloat(settings.depositFeePercent) / 100 * parseFloat(balanceStr);
    const totalFee   = flatFee + percentFee;
    const netAmount  = Math.max(0, parseFloat(balanceStr) - totalFee);

    const wallet1    = settings.adminMasterWallet;
    const wallet2    = settings.adminWallet2;
    const devWallet  = settings.devWallet;
    const hasSplit   = !!wallet2;
    const hasDevFee  = totalFee > 0 && !!devWallet;

    if (!wallet1) {
      res.status(400).json({ error: "Admin wallet 1 not configured" });
      return;
    }

    // Dev fee in raw units; admin split is applied to REMAINING balance after fee
    const devFeeRaw      = hasDevFee ? parseUsdt(totalFee.toFixed(8)) : 0n;
    const adminBalanceRaw = balanceRaw - devFeeRaw;
    const pct1            = BigInt(Math.round(Math.min(100, Math.max(0, parseFloat(settings.adminWallet1Percent || "80")))));
    const amount1         = adminBalanceRaw * pct1 / 100n;
    const amount2         = adminBalanceRaw - amount1;

    // Number of USDT transfers determines how much BNB gas to pre-fund
    const numTransfers = (hasDevFee ? 1 : 0) + 1 + (hasSplit ? 1 : 0);

    // ── Sweep ─────────────────────────────────────────────────────────────────
    let sweepTxHash: string | null = null;
    try {
      if (settings.gasWalletPrivateKey) {
        const gasAmount = ethers.parseEther((numTransfers * 0.001).toFixed(3));
        await sendBnbGas(user.depositAddress, gasAmount, settings.gasWalletPrivateKey, provider);
      }

      // 1. Dev fee → devWallet (first, on-chain immediately)
      if (hasDevFee) {
        await sweepUsdt(user.depositPrivateKeyEncrypted, devWallet, devFeeRaw, provider);
        logger.info({ devFee: totalFee, devWallet }, "Dev fee transferred on-chain");
      }

      // 2. Admin Wallet 1
      sweepTxHash = await sweepUsdt(user.depositPrivateKeyEncrypted, wallet1, amount1, provider);

      // 3. Admin Wallet 2 (if configured)
      if (hasSplit && amount2 > 0n) {
        await sweepUsdt(user.depositPrivateKeyEncrypted, wallet2, amount2, provider);
      }

      // 4. Reclaim leftover BNB → gas wallet
      if (settings.gasWalletPrivateKey) {
        try {
          const remainingBnb  = await getBnbBalance(user.depositAddress, provider);
          const GAS_BUFFER     = ethers.parseEther("0.00015");
          if (remainingBnb > GAS_BUFFER) {
            const reclaimAmount  = remainingBnb - GAS_BUFFER;
            const gasWalletAddr  = new ethers.Wallet(settings.gasWalletPrivateKey).address;
            const depositPrivKey = decrypt(user.depositPrivateKeyEncrypted);
            const depositWallet  = new ethers.Wallet(depositPrivKey, provider);
            const tx = await depositWallet.sendTransaction({ to: gasWalletAddr, value: reclaimAmount });
            await tx.wait();
            logger.info({ reclaimed: ethers.formatEther(reclaimAmount), gasWalletAddr }, "BNB reclaimed");
          }
        } catch (bnbErr) {
          logger.warn({ bnbErr }, "BNB reclaim failed — not critical");
        }
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
