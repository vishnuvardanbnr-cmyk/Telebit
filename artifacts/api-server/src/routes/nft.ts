import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  globalAmountsV2Table,
  nftsTable,
  nftPoolsTable,
  nftPoolContributedUsersTable,
  nftHoldingsTable,
  nftIncomeQueuesTable,
  nftPurchaseTransactionsTable,
} from "@workspace/db";
import { eq, and, gte, sql, lt } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import type { GlobalAmountV2 } from "@workspace/db";

const router = Router();

const NFT_LEVEL_RATES = [0.05, 0.01, 0.005, 0.005, 0.005, 0.005, 0.005, 0.005, 0.005, 0.005];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getGlobal(): Promise<GlobalAmountV2 | null> {
  const [g] = await db.select().from(globalAmountsV2Table).limit(1);
  return g ?? null;
}

async function upsertHoldingAdd(
  userId: string,
  inc: { pool?: number; referral?: number; level?: number }
) {
  const [existing] = await db
    .select()
    .from(nftHoldingsTable)
    .where(eq(nftHoldingsTable.userId, userId));

  if (existing) {
    const updates: Record<string, string> = {};
    if (inc.pool !== undefined && inc.pool !== 0) {
      updates.poolRewardAvailable = String(parseFloat(existing.poolRewardAvailable) + inc.pool);
    }
    if (inc.referral !== undefined && inc.referral !== 0) {
      updates.referralRewardAvailable = String(
        parseFloat(existing.referralRewardAvailable) + inc.referral
      );
    }
    if (inc.level !== undefined && inc.level !== 0) {
      updates.levelRewardAvailable = String(
        parseFloat(existing.levelRewardAvailable) + inc.level
      );
    }
    if (Object.keys(updates).length > 0) {
      await db
        .update(nftHoldingsTable)
        .set(updates as any)
        .where(eq(nftHoldingsTable.userId, userId));
    }
  } else {
    await db.insert(nftHoldingsTable).values({
      userId,
      poolRewardAvailable: String(inc.pool ?? 0),
      referralRewardAvailable: String(inc.referral ?? 0),
      levelRewardAvailable: String(inc.level ?? 0),
    });
  }
}

async function distributeNftPool(
  global: GlobalAmountV2,
  userId: string,
  amount: number
): Promise<{ userTokens: number; newBuyPrice: number }> {
  const buyPrice = parseFloat(global.buyPrice);
  const liquidity = parseFloat(global.liquidity);
  const expenses = parseFloat(global.expenses);
  const udp = parseFloat(global.userDistributionPercent);
  const rdp = parseFloat(global.reserveFundDistributionPercent);

  const userTokens = (amount * udp) / buyPrice;
  const reserveTokens = (amount * rdp) / buyPrice;
  const totalNewTokens = userTokens + reserveTokens;

  const newLiquidity = liquidity + amount;
  const newExpenses = expenses + totalNewTokens;
  const newBuyPrice = newExpenses > 0 ? newLiquidity / newExpenses : buyPrice;
  const newSellPrice = newBuyPrice * 0.9;

  await db
    .update(globalAmountsV2Table)
    .set({
      liquidity: String(newLiquidity),
      expenses: String(newExpenses),
      buyPrice: String(newBuyPrice),
      sellPrice: String(newSellPrice),
      nftPool: String(parseFloat(global.nftPool) + amount),
      totalPurchase: String(parseFloat(global.totalPurchase) + amount),
      reserveFund: String(parseFloat(global.reserveFund) + reserveTokens),
    } as any)
    .where(eq(globalAmountsV2Table.id, global.id));

  await upsertHoldingAdd(userId, { pool: userTokens });
  return { userTokens, newBuyPrice };
}

// ─── Income helpers ───────────────────────────────────────────────────────────

async function getDirectReferralCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<string>`COUNT(*)::text` })
    .from(usersTable)
    .where(eq(usersTable.uplineId, userId));
  return parseInt(row?.c ?? "0", 10);
}

async function getIncomeCap(user: typeof usersTable.$inferSelect): Promise<number> {
  const invested = parseFloat(user.investedUsdt);
  if (invested <= 0) return 0;
  const refs = await db
    .select({ investedUsdt: usersTable.investedUsdt })
    .from(usersTable)
    .where(eq(usersTable.uplineId, user.id));
  const qualified = refs.filter(r => parseFloat(r.investedUsdt) >= invested * 0.5).length;
  return invested * (qualified >= 3 ? 5 : 2);
}

async function giveUplinesIncome(global: GlobalAmountV2, userId: string, amount: number) {
  const buyPrice = parseFloat(global.buyPrice);
  let currentUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .then((r) => r[0]);
  const visited = new Set<string>([userId]);

  for (let i = 0; i < NFT_LEVEL_RATES.length; i++) {
    if (!currentUser?.uplineId) break;
    const uplineId = currentUser.uplineId;
    if (visited.has(uplineId)) break;
    visited.add(uplineId);

    const [upline] = await db.select().from(usersTable).where(eq(usersTable.id, uplineId));
    if (!upline) break;

    if (parseFloat(upline.investedUsdt) > 0) {
      // Gate: upline needs ≥ (i+1) direct referrals to earn level income
      const directCount = await getDirectReferralCount(uplineId);
      if (directCount >= i + 1) {
        const cap = await getIncomeCap(upline);
        const earned = parseFloat(upline.totalIncomeEarned);
        if (earned < cap) {
          const usdtEquiv = NFT_LEVEL_RATES[i] * amount;
          const actual = Math.min(usdtEquiv, cap - earned);
          const tokens = actual / buyPrice;
          await upsertHoldingAdd(upline.id, { referral: tokens });
          await db
            .update(usersTable)
            .set({ totalIncomeEarned: String(earned + actual) } as any)
            .where(eq(usersTable.id, upline.id));
        }
      }
    }

    currentUser = upline;
  }
}

const BIDDING_LEVEL_RATE = 0.002; // 0.2% per level

async function giveBiddingLevelIncome(userId: string, bidAmount: number) {
  let currentUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .then((r) => r[0]);
  const visited = new Set<string>([userId]);

  for (let i = 0; i < 10; i++) {
    if (!currentUser?.uplineId) break;
    const uplineId = currentUser.uplineId;
    if (visited.has(uplineId)) break;
    visited.add(uplineId);

    const [upline] = await db.select().from(usersTable).where(eq(usersTable.id, uplineId));
    if (!upline) break;

    if (parseFloat(upline.investedUsdt) > 0) {
      const directCount = await getDirectReferralCount(uplineId);
      if (directCount >= i + 1) {
        const cap = await getIncomeCap(upline);
        const earned = parseFloat(upline.totalIncomeEarned);
        if (earned < cap) {
          const income = Math.min(bidAmount * BIDDING_LEVEL_RATE, cap - earned);
          if (income > 0) {
            await db
              .update(usersTable)
              .set({
                walletBalance: String(parseFloat(upline.walletBalance) + income),
                totalIncomeEarned: String(earned + income),
              } as any)
              .where(eq(usersTable.id, upline.id));
          }
        }
      }
    }

    currentUser = upline;
  }
}

// ─── Public / User routes ─────────────────────────────────────────────────────

router.get("/nft/global", requireAuth, async (req, res): Promise<void> => {
  const global = await getGlobal();
  if (!global) {
    res.status(404).json({ error: "NFT system not initialized" });
    return;
  }
  res.json(global);
});

router.post("/nft/buy", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const amount = parseFloat(req.body.amount);

  if (!amount || isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }
  if (amount % 10 !== 0) {
    res.status(400).json({ error: "Amount must be a multiple of 10 USDT" });
    return;
  }
  if (amount > 1000) {
    res.status(400).json({ error: "Maximum investment is $1,000 per transaction" });
    return;
  }

  const global = await getGlobal();
  if (!global) {
    res.status(400).json({ error: "NFT system not initialized" });
    return;
  }
  if (!global.canInvest) {
    res.status(400).json({ error: "V2 token purchases are currently disabled" });
    return;
  }

  if (parseFloat(user.investedUsdt) <= 0) {
    res.status(400).json({ error: "Your investment account is not yet activated" });
    return;
  }

  if (parseFloat(user.walletBalance) < amount) {
    res.status(400).json({ error: "Insufficient wallet balance" });
    return;
  }

  if (parseFloat(user.userDepositedAmount) < amount) {
    res.status(400).json({ error: "Insufficient deposited amount for investment" });
    return;
  }

  const [holding] = await db
    .select()
    .from(nftHoldingsTable)
    .where(eq(nftHoldingsTable.userId, user.id));

  const lifetimePurchased = parseFloat(holding?.lifetimePurchased ?? "0");
  if (lifetimePurchased + amount > 10000) {
    res.status(400).json({
      error: `Lifetime V2 purchase cap is $10,000. You have $${lifetimePurchased.toFixed(2)} invested.`,
    });
    return;
  }

  await distributeNftPool(global, user.id, amount);
  await giveUplinesIncome(global, user.id, amount);

  const newWallet = parseFloat(user.walletBalance) - amount;
  const newDeposited = parseFloat(user.userDepositedAmount) - amount;
  const newInvested = parseFloat(user.investedUsdt) + amount;

  await db
    .update(usersTable)
    .set({
      walletBalance: String(newWallet),
      userDepositedAmount: String(Math.max(0, newDeposited)),
      investedUsdt: String(newInvested),
    } as any)
    .where(eq(usersTable.id, user.id));

  const newLifetime = lifetimePurchased + amount;
  if (holding) {
    await db
      .update(nftHoldingsTable)
      .set({ lifetimePurchased: String(newLifetime) } as any)
      .where(eq(nftHoldingsTable.userId, user.id));
  } else {
    await db
      .update(nftHoldingsTable)
      .set({ lifetimePurchased: String(newLifetime) } as any)
      .where(eq(nftHoldingsTable.userId, user.id));
  }

  const tokensReceived = (amount * 0.88) / parseFloat(global.buyPrice);
  await db.insert(nftPurchaseTransactionsTable).values({
    userId: user.id,
    amount: String(amount),
    tokensReceived: String(tokensReceived),
    buyPrice: global.buyPrice,
  });

  const updatedGlobal = await getGlobal();
  res.json({
    success: true,
    message: `Successfully purchased V2 tokens worth $${amount}`,
    newWalletBalance: String(newWallet),
    global: updatedGlobal,
  });
});

router.get("/nft/purchases", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const { desc } = await import("drizzle-orm");
  const txs = await db
    .select()
    .from(nftPurchaseTransactionsTable)
    .where(eq(nftPurchaseTransactionsTable.userId, user.id))
    .orderBy(desc(nftPurchaseTransactionsTable.createdAt))
    .limit(50);
  res.json(txs);
});

router.get("/nft/nfts", requireAuth, async (_req, res): Promise<void> => {
  const nfts = await db
    .select()
    .from(nftsTable)
    .where(eq(nftsTable.status, "active"));

  const result = await Promise.all(
    nfts.map(async (nft) => {
      const pools = await db
        .select()
        .from(nftPoolsTable)
        .where(and(eq(nftPoolsTable.nftId, nft.id), eq(nftPoolsTable.status, "active")));
      return { ...nft, pools };
    })
  );

  res.json(result);
});

router.get("/nft/pools", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const pools = await db
    .select({
      pool: nftPoolsTable,
      nft: nftsTable,
    })
    .from(nftPoolsTable)
    .innerJoin(nftsTable, eq(nftPoolsTable.nftId, nftsTable.id))
    .where(eq(nftsTable.status, "active"))
    .orderBy(nftPoolsTable.level);

  const poolIds = pools.map((r) => r.pool.id);
  const userBids =
    poolIds.length > 0
      ? await db
          .select({
            poolId: nftPoolContributedUsersTable.poolId,
            total: sql<string>`COALESCE(SUM(${nftPoolContributedUsersTable.amount}::numeric), 0)::text`,
          })
          .from(nftPoolContributedUsersTable)
          .where(
            and(
              eq(nftPoolContributedUsersTable.userId, user.id),
              sql`${nftPoolContributedUsersTable.poolId} = ANY(${sql.raw(`ARRAY[${poolIds.map((id) => `'${id}'`).join(",")}]::text[]`)})`
            )
          )
          .groupBy(nftPoolContributedUsersTable.poolId)
      : [];

  const bidMap = new Map(userBids.map((b) => [b.poolId, b.total]));

  res.json(pools.map((r) => ({ ...r.pool, nft: r.nft, userBidAmount: bidMap.get(r.pool.id) ?? "0" })));
});

router.post("/nft/pools/:poolId/bid", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const poolId = req.params.poolId as string;
  const amount = parseFloat(req.body.amount);

  if (!amount || isNaN(amount) || amount <= 0 || !Number.isInteger(amount)) {
    res.status(400).json({ error: "Amount must be a positive whole number" });
    return;
  }

  const global = await getGlobal();
  if (!global) {
    res.status(400).json({ error: "NFT system not initialized" });
    return;
  }

  const [pool] = await db
    .select({ pool: nftPoolsTable, nft: nftsTable })
    .from(nftPoolsTable)
    .innerJoin(nftsTable, eq(nftPoolsTable.nftId, nftsTable.id))
    .where(eq(nftPoolsTable.id, poolId));

  if (!pool) {
    res.status(404).json({ error: "Pool not found" });
    return;
  }
  if (pool.pool.status !== "active") {
    res.status(400).json({ error: "This pool is not active" });
    return;
  }
  if (pool.nft.status !== "active") {
    res.status(400).json({ error: "This NFT is not active" });
    return;
  }

  const poolLimit = parseFloat(pool.pool.poolLimit);
  if (poolLimit <= 0) {
    res.status(400).json({ error: "This pool is full" });
    return;
  }

  const [holding] = await db
    .select()
    .from(nftHoldingsTable)
    .where(eq(nftHoldingsTable.userId, user.id));

  const poolTokens = parseFloat(holding?.poolRewardAvailable ?? "0");
  const buyPrice = parseFloat(global.buyPrice);
  const nftHoldingUsdt = poolTokens * buyPrice;

  if (!user.isAdmin) {
    if (nftHoldingUsdt < 4) {
      res.status(400).json({
        error: `Minimum NFT holding of $4 required to bid. Current holding: $${nftHoldingUsdt.toFixed(4)}`,
      });
      return;
    }

    const lifetimeInvested = poolTokens * buyPrice * 4;

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [todayBids] = await db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(nftPoolContributedUsersTable)
      .where(
        and(
          eq(nftPoolContributedUsersTable.userId, user.id),
          gte(nftPoolContributedUsersTable.createdAt, todayStart)
        )
      );
    const todayTotal = parseFloat(todayBids?.total ?? "0");

    if (todayTotal + amount > lifetimeInvested) {
      res.status(400).json({
        error: `Daily bid limit is $${lifetimeInvested.toFixed(2)} (4× your NFT holding). Today's total: $${todayTotal.toFixed(2)}`,
      });
      return;
    }

    const poolSize = parseFloat(pool.pool.poolSize);
    const [userPoolTotal] = await db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(nftPoolContributedUsersTable)
      .where(
        and(
          eq(nftPoolContributedUsersTable.userId, user.id),
          eq(nftPoolContributedUsersTable.poolId, poolId)
        )
      );
    const userPoolContrib = parseFloat(userPoolTotal?.total ?? "0");
    if (userPoolContrib + amount > poolSize * 0.5) {
      res.status(400).json({
        error: `You cannot exceed 50% of the pool size ($${(poolSize * 0.5).toFixed(2)}) in a single pool`,
      });
      return;
    }

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentBid] = await db
      .select()
      .from(nftPoolContributedUsersTable)
      .where(
        and(
          eq(nftPoolContributedUsersTable.userId, user.id),
          eq(nftPoolContributedUsersTable.poolId, poolId),
          gte(nftPoolContributedUsersTable.createdAt, last24h)
        )
      );
    if (recentBid) {
      res.status(400).json({ error: "You have already bid in this pool within the last 24 hours" });
      return;
    }
  }

  const invAmount = Math.min(amount, poolLimit);

  if (parseFloat(user.walletBalance) < invAmount) {
    res.status(400).json({ error: "Insufficient wallet balance" });
    return;
  }

  const newWallet = parseFloat(user.walletBalance) - invAmount;
  await db
    .update(usersTable)
    .set({ walletBalance: String(newWallet) } as any)
    .where(eq(usersTable.id, user.id));

  const newPoolAmount = parseFloat(pool.pool.poolAmount) + invAmount;
  const newPoolLimit = poolLimit - invAmount;

  await db
    .update(nftPoolsTable)
    .set({
      poolAmount: String(newPoolAmount),
      poolLimit: String(newPoolLimit),
      ...(newPoolLimit <= 0 ? { status: "completed" } : {}),
    } as any)
    .where(eq(nftPoolsTable.id, poolId));

  // Auto-unlock the next level pool when this one fills
  if (isPoolFull) {
    await db
      .update(nftPoolsTable)
      .set({ status: "active" } as any)
      .where(
        and(
          eq(nftPoolsTable.nftId, pool.pool.nftId),
          eq(nftPoolsTable.level, pool.pool.level + 1),
          eq(nftPoolsTable.status, "inactive")
        )
      );
  }

  await db.insert(nftPoolContributedUsersTable).values({
    poolId,
    userId: user.id,
    amount: String(invAmount),
  });

  const poolSize = parseFloat(pool.pool.poolSize);
  const isPoolFull = newPoolLimit <= 0;
  const prev10k = Math.floor(parseFloat(pool.pool.poolAmount) / 10000);
  const new10k = Math.floor(newPoolAmount / 10000);
  const crossed10k = new10k > prev10k;

  if ((isPoolFull || crossed10k) && pool.pool.level > 1) {
    const [targetPool] = await db
      .select()
      .from(nftPoolsTable)
      .where(
        and(
          eq(nftPoolsTable.nftId, pool.pool.nftId),
          eq(nftPoolsTable.level, pool.pool.level - 1),
          eq(nftPoolsTable.status, "active")
        )
      );

    if (targetPool) {
      const dist = invAmount * 0.1;
      const [existingQueue] = await db
        .select()
        .from(nftIncomeQueuesTable)
        .where(eq(nftIncomeQueuesTable.poolId, targetPool.id));

      if (existingQueue) {
        await db
          .update(nftIncomeQueuesTable)
          .set({
            distributionAmount: String(parseFloat(existingQueue.distributionAmount) + dist),
          } as any)
          .where(eq(nftIncomeQueuesTable.id, existingQueue.id));
      } else {
        await db.insert(nftIncomeQueuesTable).values({
          poolId: targetPool.id,
          distributionAmount: String(dist),
          status: "pending",
        });
      }
    }
  }

  // ─── Bidding reward (1% → 0.5% → cap at 2×) ──────────────────────────────
  const investedUsdt = parseFloat(user.investedUsdt);
  if (investedUsdt > 0) {
    const biddingRewardEarned = parseFloat(user.biddingRewardEarned);
    const totalIncomeEarned = parseFloat(user.totalIncomeEarned);
    const cap1 = investedUsdt;
    const cap2 = investedUsdt * 2;

    // Promoter check for overall income cap
    const directRefs = await db
      .select({ investedUsdt: usersTable.investedUsdt })
      .from(usersTable)
      .where(eq(usersTable.uplineId, user.id));
    const qualifiedRefs = directRefs.filter(r => parseFloat(r.investedUsdt) >= investedUsdt * 0.5);
    const incomeCap = investedUsdt * (qualifiedRefs.length >= 3 ? 5 : 2);

    if (biddingRewardEarned < cap2 && totalIncomeEarned < incomeCap) {
      let reward = 0;
      if (biddingRewardEarned < cap1) {
        const at1pct = Math.min(invAmount, cap1 - biddingRewardEarned);
        reward += at1pct * 0.01;
        const at05pct = Math.min(
          Math.max(invAmount - at1pct, 0),
          cap2 - Math.min(biddingRewardEarned + at1pct, cap2),
        );
        reward += at05pct * 0.005;
      } else {
        reward = Math.min(invAmount, cap2 - biddingRewardEarned) * 0.005;
      }
      reward = Math.min(reward, incomeCap - totalIncomeEarned);

      if (reward > 0) {
        const newBiddingProfit = parseFloat(user.biddingProfitBalance) + reward;
        const newBiddingReward = biddingRewardEarned + reward;
        const newTotalIncome = totalIncomeEarned + reward;
        await db.update(usersTable).set({
          biddingProfitBalance: String(newBiddingProfit),
          biddingRewardEarned: String(newBiddingReward),
          totalIncomeEarned: String(newTotalIncome),
        } as any).where(eq(usersTable.id, user.id));

        // Auto-transfer holdings when 2× bidding reward cap is reached
        if (newBiddingReward >= cap2) {
          const [h] = await db.select().from(nftHoldingsTable).where(eq(nftHoldingsTable.userId, user.id));
          if (h) {
            const sp = parseFloat(global.sellPrice);
            const pa = parseFloat(h.poolRewardAvailable);
            const ra = parseFloat(h.referralRewardAvailable);
            const la = parseFloat(h.levelRewardAvailable);
            const totalHeld = pa + ra + la;
            if (totalHeld > 0) {
              const usdtVal = totalHeld * sp;
              await db.update(nftHoldingsTable).set({
                poolRewardAvailable: "0",
                poolRewardClaimed: String(parseFloat(h.poolRewardClaimed) + pa),
                poolRewardClaimedUsdt: String(parseFloat(h.poolRewardClaimedUsdt) + pa * sp),
                referralRewardAvailable: "0",
                referralRewardClaimed: String(parseFloat(h.referralRewardClaimed) + ra),
                referralRewardClaimedUsdt: String(parseFloat(h.referralRewardClaimedUsdt) + ra * sp),
                levelRewardAvailable: "0",
                levelRewardClaimed: String(parseFloat(h.levelRewardClaimed) + la),
                levelRewardClaimedUsdt: String(parseFloat(h.levelRewardClaimedUsdt) + la * sp),
              } as any).where(eq(nftHoldingsTable.userId, user.id));
              await db.update(usersTable).set({
                walletBalance: sql`${usersTable.walletBalance} + ${String(usdtVal)}`,
              } as any).where(eq(usersTable.id, user.id));
              // Adjust global
              const ne = Math.max(0, parseFloat(global.expenses) - totalHeld);
              const nl = Math.max(0, parseFloat(global.liquidity) - usdtVal);
              const nb = ne > 0 ? nl / ne : parseFloat(global.buyPrice);
              await db.update(globalAmountsV2Table).set({
                expenses: String(ne),
                liquidity: String(nl),
                buyPrice: String(nb),
                sellPrice: String(nb * 0.9),
              } as any).where(eq(globalAmountsV2Table.id, global.id));
            }
          }
        }
      }
    }
    // Bidding level income to uplines (0.2% per level, 10 levels)
    await giveBiddingLevelIncome(user.id, invAmount);
  }

  res.json({
    success: true,
    message: `Successfully bid $${invAmount} in pool`,
    newWalletBalance: String(newWallet),
    contribution: invAmount,
  });
});

router.get("/nft/holdings", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;

  const [holding] = await db
    .select()
    .from(nftHoldingsTable)
    .where(eq(nftHoldingsTable.userId, user.id));

  const global = await getGlobal();
  const buyPrice = parseFloat(global?.buyPrice ?? "1");
  const sellPrice = parseFloat(global?.sellPrice ?? "0.9");

  if (!holding) {
    res.json({
      poolRewardAvailable: "0",
      poolRewardClaimed: "0",
      poolRewardClaimedUsdt: "0",
      referralRewardAvailable: "0",
      referralRewardClaimed: "0",
      referralRewardClaimedUsdt: "0",
      levelRewardAvailable: "0",
      levelRewardClaimed: "0",
      levelRewardClaimedUsdt: "0",
      lifetimePurchased: "0",
      holdingValueUsdt: "0",
      sellPrice: String(sellPrice),
      buyPrice: String(buyPrice),
    });
    return;
  }

  const totalTokens =
    parseFloat(holding.poolRewardAvailable) +
    parseFloat(holding.referralRewardAvailable) +
    parseFloat(holding.levelRewardAvailable);

  // 2× appreciation auto-transfer: if total token value ≥ 2× investedUsdt
  const investedUsdtForHolding = parseFloat(user.investedUsdt);
  if (investedUsdtForHolding > 0 && totalTokens * buyPrice >= investedUsdtForHolding * 2) {
    const usdtVal = totalTokens * sellPrice;
    if (totalTokens > 0) {
      const h = holding;
      const pa = parseFloat(h.poolRewardAvailable);
      const ra = parseFloat(h.referralRewardAvailable);
      const la = parseFloat(h.levelRewardAvailable);
      await db.update(nftHoldingsTable).set({
        poolRewardAvailable: "0",
        poolRewardClaimed: String(parseFloat(h.poolRewardClaimed) + pa),
        poolRewardClaimedUsdt: String(parseFloat(h.poolRewardClaimedUsdt) + pa * sellPrice),
        referralRewardAvailable: "0",
        referralRewardClaimed: String(parseFloat(h.referralRewardClaimed) + ra),
        referralRewardClaimedUsdt: String(parseFloat(h.referralRewardClaimedUsdt) + ra * sellPrice),
        levelRewardAvailable: "0",
        levelRewardClaimed: String(parseFloat(h.levelRewardClaimed) + la),
        levelRewardClaimedUsdt: String(parseFloat(h.levelRewardClaimedUsdt) + la * sellPrice),
      } as any).where(eq(nftHoldingsTable.userId, user.id));
      await db.update(usersTable).set({
        walletBalance: sql`${usersTable.walletBalance} + ${String(usdtVal)}`,
      } as any).where(eq(usersTable.id, user.id));
      const ne = Math.max(0, parseFloat(global!.expenses) - totalTokens);
      const nl = Math.max(0, parseFloat(global!.liquidity) - usdtVal);
      const nb = ne > 0 ? nl / ne : buyPrice;
      await db.update(globalAmountsV2Table).set({
        expenses: String(ne),
        liquidity: String(nl),
        buyPrice: String(nb),
        sellPrice: String(nb * 0.9),
      } as any).where(eq(globalAmountsV2Table.id, global!.id));
      res.json({
        ...holding,
        poolRewardAvailable: "0",
        referralRewardAvailable: "0",
        levelRewardAvailable: "0",
        holdingValueUsdt: "0",
        autoTransferred: true,
        autoTransferredUsdt: String(usdtVal),
        sellPrice: String(sellPrice),
        buyPrice: String(buyPrice),
      });
      return;
    }
  }

  const incomeCap = await getIncomeCap(user);
  const totalIncomeEarned = parseFloat(user.totalIncomeEarned);

  res.json({
    ...holding,
    holdingValueUsdt: String(totalTokens * sellPrice),
    sellPrice: String(sellPrice),
    buyPrice: String(buyPrice),
    incomeCap: String(incomeCap),
    totalIncomeEarned: String(totalIncomeEarned),
    isCapped: incomeCap > 0 && totalIncomeEarned >= incomeCap,
  });
});

router.post("/nft/holdings/claim", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const { type } = req.body as {
    type: "pool" | "referral" | "level";
  };

  if (!["pool", "referral", "level"].includes(type)) {
    res.status(400).json({ error: "Invalid claim type. Use: pool, referral, level" });
    return;
  }

  const [holding] = await db
    .select()
    .from(nftHoldingsTable)
    .where(eq(nftHoldingsTable.userId, user.id));

  if (!holding) {
    res.status(400).json({ error: "No holdings found" });
    return;
  }

  const global = await getGlobal();
  if (!global) {
    res.status(400).json({ error: "NFT system not initialized" });
    return;
  }

  const sellPrice = parseFloat(global.sellPrice);

  const fieldMap = {
    pool: {
      available: "poolRewardAvailable",
      claimed: "poolRewardClaimed",
      claimedUsdt: "poolRewardClaimedUsdt",
    },
    referral: {
      available: "referralRewardAvailable",
      claimed: "referralRewardClaimed",
      claimedUsdt: "referralRewardClaimedUsdt",
    },
    level: {
      available: "levelRewardAvailable",
      claimed: "levelRewardClaimed",
      claimedUsdt: "levelRewardClaimedUsdt",
    },
  } as const;

  const fields = fieldMap[type];
  const availableTokens = parseFloat((holding as any)[fields.available]);

  if (availableTokens <= 0) {
    res.status(400).json({ error: "No tokens available to claim" });
    return;
  }

  const usdtValue = availableTokens * sellPrice;

  const prevClaimed = parseFloat((holding as any)[fields.claimed]);
  const prevClaimedUsdt = parseFloat((holding as any)[fields.claimedUsdt]);

  await db
    .update(nftHoldingsTable)
    .set({
      [fields.available]: "0",
      [fields.claimed]: String(prevClaimed + availableTokens),
      [fields.claimedUsdt]: String(prevClaimedUsdt + usdtValue),
    } as any)
    .where(eq(nftHoldingsTable.userId, user.id));

  const newWallet = parseFloat(user.walletBalance) + usdtValue;
  await db
    .update(usersTable)
    .set({ walletBalance: String(newWallet) } as any)
    .where(eq(usersTable.id, user.id));

  const newExpenses = Math.max(0, parseFloat(global.expenses) - availableTokens);
  const newLiquidity = Math.max(0, parseFloat(global.liquidity) - usdtValue);
  const newBuyPrice = newExpenses > 0 ? newLiquidity / newExpenses : parseFloat(global.buyPrice);
  const newSellPrice = newBuyPrice * 0.9;

  await db
    .update(globalAmountsV2Table)
    .set({
      expenses: String(newExpenses),
      liquidity: String(newLiquidity),
      buyPrice: String(newBuyPrice),
      sellPrice: String(newSellPrice),
    } as any)
    .where(eq(globalAmountsV2Table.id, global.id));

  res.json({
    success: true,
    message: `Claimed ${availableTokens.toFixed(6)} tokens for $${usdtValue.toFixed(4)} USDT`,
    claimed: availableTokens,
    usdtCredited: usdtValue,
    newWalletBalance: String(newWallet),
  });
});

// ─── Admin routes ──────────────────────────────────────────────────────────────

router.get("/admin/nft/global", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const global = await getGlobal();
  res.json(global ?? null);
});

router.put("/admin/nft/global", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const {
    canInvest,
    userDistributionPercent,
    reserveFundDistributionPercent,
    buyPrice,
    sellPrice,
    liquidity,
    expenses,
  } = req.body;

  const existing = await getGlobal();
  if (!existing) {
    const [created] = await db.insert(globalAmountsV2Table).values({
      canInvest: canInvest ?? false,
      userDistributionPercent: userDistributionPercent ?? "0.88",
      reserveFundDistributionPercent: reserveFundDistributionPercent ?? "0.12",
      buyPrice: buyPrice ?? "1",
      sellPrice: sellPrice ?? "0.9",
      liquidity: liquidity ?? "0",
      expenses: expenses ?? "0",
    }).returning();
    res.json(created);
    return;
  }

  const updates: Record<string, unknown> = {};
  if (canInvest !== undefined) updates.canInvest = canInvest;
  if (userDistributionPercent !== undefined) updates.userDistributionPercent = String(userDistributionPercent);
  if (reserveFundDistributionPercent !== undefined) updates.reserveFundDistributionPercent = String(reserveFundDistributionPercent);
  if (buyPrice !== undefined) updates.buyPrice = String(buyPrice);
  if (sellPrice !== undefined) updates.sellPrice = String(sellPrice);
  if (liquidity !== undefined) updates.liquidity = String(liquidity);
  if (expenses !== undefined) updates.expenses = String(expenses);

  const [updated] = await db
    .update(globalAmountsV2Table)
    .set(updates as any)
    .where(eq(globalAmountsV2Table.id, existing.id))
    .returning();

  res.json(updated);
});

router.get("/admin/nft/nfts", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const nfts = await db.select().from(nftsTable);
  const result = await Promise.all(
    nfts.map(async (nft) => {
      const pools = await db
        .select()
        .from(nftPoolsTable)
        .where(eq(nftPoolsTable.nftId, nft.id));
      return { ...nft, pools };
    })
  );
  res.json(result);
});

router.post("/admin/nft/nfts", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { title, image, price } = req.body;
  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }
  const [nft] = await db
    .insert(nftsTable)
    .values({
      title: String(title),
      image: String(image ?? ""),
      price: String(price ?? "100"),
    })
    .returning();
  res.json(nft);
});

router.patch("/admin/nft/nfts/:nftId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const nftId = req.params.nftId as string;
  const { title, image, price, status } = req.body;

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = String(title);
  if (image !== undefined) updates.image = String(image);
  if (price !== undefined) updates.price = String(price);
  if (status !== undefined) updates.status = status;

  const [updated] = await db
    .update(nftsTable)
    .set(updates as any)
    .where(eq(nftsTable.id, nftId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "NFT not found" });
    return;
  }
  res.json(updated);
});

router.get("/admin/nft/pools", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const pools = await db
    .select({ pool: nftPoolsTable, nft: nftsTable })
    .from(nftPoolsTable)
    .innerJoin(nftsTable, eq(nftPoolsTable.nftId, nftsTable.id));

  res.json(pools.map((r) => ({ ...r.pool, nft: r.nft })));
});

router.post("/admin/nft/pools", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { nftId, level, poolSize, poolLimit, dailyYield } = req.body;
  if (!nftId || !poolSize) {
    res.status(400).json({ error: "nftId and poolSize are required" });
    return;
  }

  const [nft] = await db.select().from(nftsTable).where(eq(nftsTable.id, String(nftId)));
  if (!nft) {
    res.status(404).json({ error: "NFT not found" });
    return;
  }

  const sz = parseFloat(String(poolSize));
  const [pool] = await db
    .insert(nftPoolsTable)
    .values({
      nftId: String(nftId),
      level: parseInt(String(level ?? 1)),
      poolSize: String(sz),
      poolLimit: String(parseFloat(String(poolLimit ?? poolSize))),
      dailyYield: String(parseFloat(String(dailyYield ?? 0))),
    })
    .returning();

  res.json(pool);
});

router.patch("/admin/nft/pools/:poolId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const poolId = req.params.poolId as string;
  const { status, poolLimit, dailyYield } = req.body;

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (poolLimit !== undefined) updates.poolLimit = String(poolLimit);
  if (dailyYield !== undefined) updates.dailyYield = String(parseFloat(String(dailyYield)));

  const [updated] = await db
    .update(nftPoolsTable)
    .set(updates as any)
    .where(eq(nftPoolsTable.id, poolId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Pool not found" });
    return;
  }
  res.json(updated);
});

router.patch("/admin/users/:id/nft", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.id as string;
  const { investedUsdt } = req.body;

  if (investedUsdt === undefined) {
    res.status(400).json({ error: "investedUsdt is required" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ investedUsdt: String(investedUsdt) } as any)
    .where(eq(usersTable.id, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ success: true, investedUsdt: updated.investedUsdt });
});

export default router;
