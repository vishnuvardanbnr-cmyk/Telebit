import { Router } from "express";
import { db, usersTable, shopP2pAdsTable, shopP2pOrdersTable, shopP2pMessagesTable } from "@workspace/db";
import { eq, and, or, desc, sql, count } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validate<S extends z.ZodTypeAny>(
  schema: S,
  body: unknown,
): { ok: true; data: z.infer<S> } | { ok: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i: z.core.$ZodIssue) => i.message).join(", ") };
  }
  return { ok: true, data: result.data as z.infer<S> };
}

/** Extract a string param safely (Express 5 types params as string | string[]). */
function param(req: { params: Record<string, string | string[]> }, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

async function getUserDisplayName(userId: string): Promise<string> {
  const [user] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return "Unknown";
  return user.email?.split("@")[0] ?? "User";
}

async function enrichAds(ads: (typeof shopP2pAdsTable.$inferSelect)[]) {
  if (ads.length === 0) return [];
  const userIds = [...new Set(ads.map(a => a.userId))];
  const users = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}`), sql`, `)}]::text[])`);
  const userMap = new Map(users.map(u => [u.id, u.email?.split("@")[0] ?? "User"]));
  return ads.map(ad => ({ ...ad, displayName: userMap.get(ad.userId) ?? ad.displayName ?? "User" }));
}

// ─── Ads ──────────────────────────────────────────────────────────────────────

router.get("/shop/p2p/ads", async (req, res): Promise<void> => {
  const { side, search } = req.query as { side?: string; search?: string };
  const offset = Math.max(0, Number(req.query["offset"] ?? 0));
  const limit = 10;
  try {
    const conditions = [
      eq(shopP2pAdsTable.status, "active"),
      ...(side === "buy" || side === "sell" ? [eq(shopP2pAdsTable.side, side)] : []),
    ];
    const where = and(...conditions);
    let ads = await db.select().from(shopP2pAdsTable).where(where).orderBy(desc(shopP2pAdsTable.createdAt));
    const enriched = await enrichAds(ads);
    // Filter by username search after enriching
    const filtered = search
      ? enriched.filter(a => a.displayName.toLowerCase().includes(search.toLowerCase()))
      : enriched;
    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);
    res.json({ ads: paged, total, limit, offset });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch ads" });
  }
});

router.get("/shop/p2p/my-ads", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const offset = Math.max(0, Number(req.query["offset"] ?? 0));
  const where = eq(shopP2pAdsTable.userId, user.id as string);
  const ads = await db.select().from(shopP2pAdsTable).where(where).orderBy(desc(shopP2pAdsTable.createdAt)).limit(50).offset(offset);
  res.json({ ads });
});

const createAdSchema = z.object({
  side: z.enum(["buy", "sell"]),
  price: z.string().regex(/^\d+(\.\d+)?$/, "Invalid price"),
  minAmount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid min amount"),
  maxAmount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid max amount"),
  availableAmount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid available amount"),
  paymentMethods: z.array(z.string()).min(1, "At least one payment method required"),
  paymentWindow: z.number().int().min(5).max(120).default(15),
  terms: z.string().max(500).optional(),
});

router.post("/shop/p2p/ads", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const v = validate(createAdSchema, req.body);
  if (!v.ok) { res.status(400).json({ error: v.error }); return; }
  const body = v.data;

  const available = parseFloat(body.availableAmount);
  const min = parseFloat(body.minAmount);
  const max = parseFloat(body.maxAmount);
  if (min > max) { res.status(400).json({ error: "minAmount must be ≤ maxAmount" }); return; }
  if (available < min) { res.status(400).json({ error: "availableAmount must be ≥ minAmount" }); return; }

  if (body.side === "sell") {
    // Enforce $10 min / $200 max for sell ads
    if (available < 10) { res.status(400).json({ error: "Minimum sell ad amount is $10 USDT" }); return; }
    if (available > 200) { res.status(400).json({ error: "Maximum sell ad amount is $200 USDT" }); return; }
    if (max > 200) { res.status(400).json({ error: "Maximum order amount for sell ads is $200 USDT" }); return; }
    if (min < 10) { res.status(400).json({ error: "Minimum order amount for sell ads is $10 USDT" }); return; }
    const walletBalance = parseFloat(String(user.walletBalance));
    if (walletBalance < available) {
      res.status(400).json({ error: `Insufficient balance. Need ${available.toFixed(2)} USDT, have ${walletBalance.toFixed(2)} USDT` });
      return;
    }
    await db.update(usersTable).set({ walletBalance: String(walletBalance - available) }).where(eq(usersTable.id, user.id as string));
  }

  const displayName = await getUserDisplayName(user.id as string);
  const [ad] = await db.insert(shopP2pAdsTable).values({
    userId: user.id as string,
    displayName,
    side: body.side,
    price: body.price,
    minAmount: body.minAmount,
    maxAmount: body.maxAmount,
    availableAmount: body.availableAmount,
    paymentMethods: body.paymentMethods,
    paymentWindow: body.paymentWindow,
    terms: body.terms ?? null,
  }).returning();

  res.status(201).json(ad);
});

router.patch("/shop/p2p/ads/:id/status", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const id = param(req, "id");
  const { status } = req.body as { status?: string };

  if (!["active", "paused", "cancelled"].includes(status ?? "")) {
    res.status(400).json({ error: "Invalid status. Must be active, paused, or cancelled" }); return;
  }

  const [ad] = await db.select().from(shopP2pAdsTable).where(eq(shopP2pAdsTable.id, id)).limit(1);
  if (!ad) { res.status(404).json({ error: "Ad not found" }); return; }
  if (ad.userId !== user.id) { res.status(403).json({ error: "Not your ad" }); return; }
  if (ad.status === "cancelled") { res.status(409).json({ error: "Ad already cancelled" }); return; }

  if (status === "cancelled" && ad.side === "sell") {
    const activeOrders = await db
      .select({ id: shopP2pOrdersTable.id })
      .from(shopP2pOrdersTable)
      .where(and(eq(shopP2pOrdersTable.adId, id), sql`${shopP2pOrdersTable.status} IN ('pending', 'paid', 'disputed')`))
      .limit(1);
    if (activeOrders.length > 0) {
      res.status(409).json({ error: "Cannot cancel — there is an active order in progress" }); return;
    }
    const remaining = parseFloat(String(ad.availableAmount));
    if (remaining > 0) {
      await db.update(usersTable)
        .set({ walletBalance: sql`${usersTable.walletBalance} + ${String(remaining)}` })
        .where(eq(usersTable.id, user.id as string));
    }
  }

  const [updated] = await db.update(shopP2pAdsTable)
    .set({ status: status as "active" | "paused" | "cancelled", updatedAt: new Date() })
    .where(eq(shopP2pAdsTable.id, id))
    .returning();

  res.json(updated);
});

// ─── Orders ───────────────────────────────────────────────────────────────────

router.get("/shop/p2p/my-orders", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const offset = Math.max(0, Number(req.query["offset"] ?? 0));
  const limit = 20;

  const where = or(eq(shopP2pOrdersTable.buyerUserId, user.id as string), eq(shopP2pOrdersTable.sellerUserId, user.id as string));
  const orders = await db.select().from(shopP2pOrdersTable).where(where).orderBy(desc(shopP2pOrdersTable.createdAt)).limit(limit).offset(offset);
  const [totalRow] = await db.select({ count: count() }).from(shopP2pOrdersTable).where(where);

  const enriched = await Promise.all(orders.map(async (o) => {
    const [ad] = await db.select({ side: shopP2pAdsTable.side }).from(shopP2pAdsTable).where(eq(shopP2pAdsTable.id, o.adId)).limit(1);
    const [buyer] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, o.buyerUserId)).limit(1);
    const [seller] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, o.sellerUserId)).limit(1);
    return {
      ...o,
      adSide: ad?.side,
      buyerName: buyer?.email?.split("@")[0] ?? "Unknown",
      sellerName: seller?.email?.split("@")[0] ?? "Unknown",
    };
  }));

  res.json({ orders: enriched, total: Number(totalRow?.count ?? 0), limit, offset });
});

router.get("/shop/p2p/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const id = param(req, "id");

  const [order] = await db.select().from(shopP2pOrdersTable).where(eq(shopP2pOrdersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.buyerUserId !== user.id && order.sellerUserId !== user.id) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  const [ad] = await db.select().from(shopP2pAdsTable).where(eq(shopP2pAdsTable.id, order.adId)).limit(1);
  const [buyer] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, order.buyerUserId)).limit(1);
  const [seller] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, order.sellerUserId)).limit(1);
  const messages = await db.select().from(shopP2pMessagesTable).where(eq(shopP2pMessagesTable.orderId, id)).orderBy(shopP2pMessagesTable.createdAt);

  res.json({
    ...order, ad, messages,
    buyerName: buyer?.email?.split("@")[0] ?? "Unknown",
    sellerName: seller?.email?.split("@")[0] ?? "Unknown",
  });
});

const createOrderSchema = z.object({
  adId: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount"),
  paymentMethod: z.string().min(1, "Payment method required"),
  paymentNote: z.string().max(500).optional(),
});

router.post("/shop/p2p/orders", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const v = validate(createOrderSchema, req.body);
  if (!v.ok) { res.status(400).json({ error: v.error }); return; }
  const body = v.data;

  const [ad] = await db.select().from(shopP2pAdsTable).where(eq(shopP2pAdsTable.id, body.adId)).limit(1);
  if (!ad) { res.status(404).json({ error: "Ad not found" }); return; }
  if (ad.status !== "active") { res.status(409).json({ error: "Ad is no longer active" }); return; }
  if (ad.userId === user.id) { res.status(400).json({ error: "Cannot place an order on your own ad" }); return; }

  const amount = parseFloat(body.amount);
  const minAmount = parseFloat(String(ad.minAmount));
  const maxAmount = parseFloat(String(ad.maxAmount));
  const available = parseFloat(String(ad.availableAmount));

  if (amount < minAmount || amount > maxAmount) {
    res.status(400).json({ error: `Amount must be between ${minAmount} and ${maxAmount} USDT` }); return;
  }
  if (amount > available) {
    res.status(400).json({ error: `Only ${available.toFixed(2)} USDT available` }); return;
  }

  if (ad.side === "buy") {
    const walletBalance = parseFloat(String(user.walletBalance));
    if (walletBalance < amount) {
      res.status(400).json({ error: `Insufficient balance. Need ${amount.toFixed(2)} USDT, have ${walletBalance.toFixed(2)} USDT` }); return;
    }
    await db.update(usersTable).set({ walletBalance: String(walletBalance - amount) }).where(eq(usersTable.id, user.id as string));
  }

  const deadlineMs = ad.paymentWindow * 60 * 1000;
  const paymentDeadline = new Date(Date.now() + deadlineMs);

  const buyerUserId: string = ad.side === "sell" ? (user.id as string) : ad.userId;
  const sellerUserId: string = ad.side === "sell" ? ad.userId : (user.id as string);

  await db.update(shopP2pAdsTable)
    .set({ availableAmount: String(available - amount), updatedAt: new Date() })
    .where(eq(shopP2pAdsTable.id, ad.id));

  const [order] = await db.insert(shopP2pOrdersTable).values({
    adId: ad.id,
    buyerUserId,
    sellerUserId,
    amount: body.amount,
    price: ad.price,
    paymentMethod: body.paymentMethod,
    paymentNote: body.paymentNote ?? null,
    paymentDeadline,
  }).returning();

  const senderName = await getUserDisplayName(user.id as string);
  const orderId = order.id;
  await db.insert(shopP2pMessagesTable).values({
    orderId,
    senderUserId: "system",
    senderName: "System",
    content: `Order created for ${amount.toFixed(2)} USDT. Payment method: ${body.paymentMethod.replace(/_/g, " ")}. Payment window: ${ad.paymentWindow} minutes.`,
    isSystem: true,
  });

  res.status(201).json({ ...order, buyerName: senderName });
});

router.post("/shop/p2p/orders/:id/pay", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const id = param(req, "id");

  const [order] = await db.select().from(shopP2pOrdersTable).where(eq(shopP2pOrdersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.buyerUserId !== user.id) { res.status(403).json({ error: "Only the buyer can mark as paid" }); return; }
  if (order.status !== "pending") { res.status(409).json({ error: `Order is already ${order.status}` }); return; }

  const [updated] = await db.update(shopP2pOrdersTable)
    .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
    .where(eq(shopP2pOrdersTable.id, id))
    .returning();

  const buyerName = await getUserDisplayName(user.id as string);
  await db.insert(shopP2pMessagesTable).values({
    orderId: id,
    senderUserId: "system",
    senderName: "System",
    content: `${buyerName} has marked the payment as sent. Please verify and release the USDT once confirmed.`,
    isSystem: true,
  });

  res.json(updated);
});

router.post("/shop/p2p/orders/:id/release", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const id = param(req, "id");

  const [order] = await db.select().from(shopP2pOrdersTable).where(eq(shopP2pOrdersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.sellerUserId !== user.id) { res.status(403).json({ error: "Only the seller can release" }); return; }
  if (!["paid", "disputed"].includes(order.status)) {
    res.status(409).json({ error: "Order must be in paid or disputed state to release" }); return;
  }

  const amount = parseFloat(String(order.amount));

  await db.update(usersTable)
    .set({ walletBalance: sql`${usersTable.walletBalance} + ${String(amount)}` })
    .where(eq(usersTable.id, order.buyerUserId));

  const [updated] = await db.update(shopP2pOrdersTable)
    .set({ status: "released", releasedAt: new Date(), updatedAt: new Date() })
    .where(eq(shopP2pOrdersTable.id, id))
    .returning();

  const [ad] = await db.select().from(shopP2pAdsTable).where(eq(shopP2pAdsTable.id, order.adId)).limit(1);
  if (ad) {
    const newPrice = (parseFloat(String(ad.price)) + 0.1).toFixed(2);
    await db.update(shopP2pAdsTable)
      .set({
        completedOrders: (ad.completedOrders ?? 0) + 1,
        price: newPrice,
        updatedAt: new Date(),
      })
      .where(eq(shopP2pAdsTable.id, ad.id));
  }

  const sellerName = await getUserDisplayName(user.id as string);
  await db.insert(shopP2pMessagesTable).values({
    orderId: id,
    senderUserId: "system",
    senderName: "System",
    content: `${sellerName} has confirmed payment and released ${amount.toFixed(2)} USDT. Trade completed successfully.`,
    isSystem: true,
  });

  res.json(updated);
});

const cancelOrderSchema = z.object({
  reason: z.string().max(300).optional(),
});

router.post("/shop/p2p/orders/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const id = param(req, "id");
  const v = validate(cancelOrderSchema, req.body);
  if (!v.ok) { res.status(400).json({ error: v.error }); return; }

  const [order] = await db.select().from(shopP2pOrdersTable).where(eq(shopP2pOrdersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.buyerUserId !== user.id && order.sellerUserId !== user.id) {
    res.status(403).json({ error: "Access denied" }); return;
  }
  if (!["pending", "paid"].includes(order.status)) {
    res.status(409).json({ error: `Cannot cancel order in ${order.status} state` }); return;
  }
  if (order.status === "paid" && order.buyerUserId === user.id) {
    res.status(409).json({ error: "Cannot cancel after marking payment sent. Contact seller or open a dispute." }); return;
  }

  const amount = parseFloat(String(order.amount));
  const [ad] = await db.select({ id: shopP2pAdsTable.id, side: shopP2pAdsTable.side }).from(shopP2pAdsTable).where(eq(shopP2pAdsTable.id, order.adId)).limit(1);

  if (ad) {
    await db.update(shopP2pAdsTable)
      .set({ availableAmount: sql`${shopP2pAdsTable.availableAmount} + ${String(amount)}`, updatedAt: new Date() })
      .where(eq(shopP2pAdsTable.id, ad.id));
  }

  if (ad?.side === "buy") {
    await db.update(usersTable)
      .set({ walletBalance: sql`${usersTable.walletBalance} + ${String(amount)}` })
      .where(eq(usersTable.id, order.sellerUserId));
  }

  const cancelReason: string | null = v.data.reason ?? null;

  const [updated] = await db.update(shopP2pOrdersTable)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelReason, updatedAt: new Date() })
    .where(eq(shopP2pOrdersTable.id, id))
    .returning();

  const cancellerName = await getUserDisplayName(user.id as string);
  await db.insert(shopP2pMessagesTable).values({
    orderId: id,
    senderUserId: "system",
    senderName: "System",
    content: `Order cancelled by ${cancellerName}.${cancelReason ? ` Reason: ${cancelReason}` : ""}`,
    isSystem: true,
  });

  res.json(updated);
});

const disputeSchema = z.object({
  reason: z.string().min(1).max(1000),
});

router.post("/shop/p2p/orders/:id/dispute", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const id = param(req, "id");
  const v = validate(disputeSchema, req.body);
  if (!v.ok) { res.status(400).json({ error: v.error }); return; }

  const [order] = await db.select().from(shopP2pOrdersTable).where(eq(shopP2pOrdersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.buyerUserId !== user.id && order.sellerUserId !== user.id) {
    res.status(403).json({ error: "Access denied" }); return;
  }
  if (order.status !== "paid") { res.status(400).json({ error: "Can only dispute paid orders" }); return; }

  const disputeDescription: string = v.data.reason;

  const [updated] = await db.update(shopP2pOrdersTable)
    .set({ status: "disputed", disputeDescription, updatedAt: new Date() })
    .where(eq(shopP2pOrdersTable.id, id))
    .returning();

  const userName = await getUserDisplayName(user.id as string);
  await db.insert(shopP2pMessagesTable).values({
    orderId: id,
    senderUserId: "system",
    senderName: "System",
    content: `A dispute has been opened by ${userName}. Our team will review and resolve within 24 hours.`,
    isSystem: true,
  });

  res.json(updated);
});

// ─── Messages ─────────────────────────────────────────────────────────────────

router.get("/shop/p2p/orders/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const id = param(req, "id");

  const [order] = await db
    .select({ buyerUserId: shopP2pOrdersTable.buyerUserId, sellerUserId: shopP2pOrdersTable.sellerUserId })
    .from(shopP2pOrdersTable)
    .where(eq(shopP2pOrdersTable.id, id))
    .limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.buyerUserId !== user.id && order.sellerUserId !== user.id) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  const messages = await db.select().from(shopP2pMessagesTable).where(eq(shopP2pMessagesTable.orderId, id)).orderBy(shopP2pMessagesTable.createdAt);
  res.json(messages);
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

router.post("/shop/p2p/orders/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const id = param(req, "id");
  const v = validate(sendMessageSchema, req.body);
  if (!v.ok) { res.status(400).json({ error: v.error }); return; }

  const [order] = await db
    .select({ buyerUserId: shopP2pOrdersTable.buyerUserId, sellerUserId: shopP2pOrdersTable.sellerUserId, status: shopP2pOrdersTable.status })
    .from(shopP2pOrdersTable)
    .where(eq(shopP2pOrdersTable.id, id))
    .limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.buyerUserId !== user.id && order.sellerUserId !== user.id) {
    res.status(403).json({ error: "Access denied" }); return;
  }
  if (["released", "cancelled"].includes(order.status)) {
    res.status(400).json({ error: "Cannot message on a closed order" }); return;
  }

  const senderName = await getUserDisplayName(user.id as string);
  const content: string = v.data.content;
  const [msg] = await db.insert(shopP2pMessagesTable).values({
    orderId: id,
    senderUserId: user.id as string,
    senderName,
    content,
    isSystem: false,
  }).returning();

  res.status(201).json(msg);
});

// ─── Report ───────────────────────────────────────────────────────────────────

router.get("/shop/p2p/report", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const offset = Math.max(0, Number(req.query["offset"] ?? 0));
  const limit = 20;
  try {
    const where = and(
      or(eq(shopP2pOrdersTable.buyerUserId, user.id as string), eq(shopP2pOrdersTable.sellerUserId, user.id as string)),
      sql`${shopP2pOrdersTable.status} IN ('released', 'resolved')`,
    );
    const orders = await db.select().from(shopP2pOrdersTable).where(where).orderBy(desc(shopP2pOrdersTable.createdAt)).limit(limit).offset(offset);
    const [totalRow] = await db.select({ count: count() }).from(shopP2pOrdersTable).where(where);
    const userIds = [...new Set([...orders.map(o => o.buyerUserId), ...orders.map(o => o.sellerUserId)])];
    const users = userIds.length > 0
      ? await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable)
          .where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}`), sql`, `)}]::text[])`)
      : [];
    const userMap = new Map(users.map(u => [u.id, u.email?.split("@")[0] ?? "User"]));
    const enriched = orders.map(o => ({
      ...o,
      buyerName: userMap.get(o.buyerUserId) ?? "Unknown",
      sellerName: userMap.get(o.sellerUserId) ?? "Unknown",
      role: o.buyerUserId === (user.id as string) ? "buyer" : "seller",
    }));
    res.json({ orders: enriched, total: Number(totalRow?.count ?? 0), limit, offset });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch report" });
  }
});

// ─── Admin ────────────────────────────────────────────────────────────────────

router.get("/shop/admin/p2p/ads", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const ads = await db.select().from(shopP2pAdsTable).orderBy(desc(shopP2pAdsTable.createdAt));
    const enriched = await enrichAds(ads);
    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/shop/admin/p2p/orders", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const orders = await db.select().from(shopP2pOrdersTable).orderBy(desc(shopP2pOrdersTable.createdAt)).limit(200);
    const userIds = [...new Set([...orders.map(o => o.buyerUserId), ...orders.map(o => o.sellerUserId)])];
    const users = userIds.length > 0 ? await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}`), sql`, `)}]::text[])`) : [];
    const userMap = new Map(users.map(u => [u.id, u.email?.split("@")[0] ?? "User"]));
    res.json(orders.map(o => ({
      ...o,
      buyerName: userMap.get(o.buyerUserId) ?? "Unknown",
      sellerName: userMap.get(o.sellerUserId) ?? "Unknown",
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/shop/admin/p2p/orders/:id/resolve", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const dbUser = (req as any).dbUser;
    const orderId = param(req, "id");
    const { resolution, releaseToSeller } = req.body;
    const [order] = await db.select().from(shopP2pOrdersTable).where(eq(shopP2pOrdersTable.id, orderId)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.status !== "disputed") { res.status(400).json({ error: "Order is not in disputed state" }); return; }
    const amount = parseFloat(String(order.amount));
    const recipientId = releaseToSeller ? order.sellerUserId : order.buyerUserId;
    await db.update(usersTable)
      .set({ walletBalance: sql`${usersTable.walletBalance} + ${String(amount)}` })
      .where(eq(usersTable.id, recipientId));
    const [updated] = await db.update(shopP2pOrdersTable)
      .set({ status: "resolved", resolvedBy: dbUser.id, resolution: resolution ?? null, resolvedAt: new Date(), updatedAt: new Date() })
      .where(eq(shopP2pOrdersTable.id, orderId))
      .returning();
    await db.insert(shopP2pMessagesTable).values({
      orderId,
      senderUserId: "system",
      senderName: "System",
      content: `Admin resolved dispute. ${releaseToSeller ? "Funds released to seller." : "Funds refunded to buyer."} Resolution: ${resolution ?? "No details provided."}`,
      isSystem: true,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
