import { Router } from "express";
import { db, usersTable, p2pTransfersTable } from "@workspace/db";
import { eq, or, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/p2p", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const transfers = await db
    .select()
    .from(p2pTransfersTable)
    .where(or(eq(p2pTransfersTable.senderId, user.id), eq(p2pTransfersTable.receiverId, user.id)))
    .orderBy(desc(p2pTransfersTable.createdAt))
    .limit(limit)
    .offset(offset);

  // Fetch sender/receiver emails
  const result = await Promise.all(transfers.map(async (t) => {
    const [sender] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, t.senderId));
    const [receiver] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, t.receiverId));
    return {
      ...t,
      senderEmail: sender?.email ?? null,
      receiverEmail: receiver?.email ?? null,
    };
  }));

  res.json(result);
});

router.post("/p2p", requireAuth, async (req, res): Promise<void> => {
  const sender = (req as any).dbUser;
  const { amount, recipientIdentifier, note } = req.body;

  if (!amount || !recipientIdentifier) {
    res.status(400).json({ error: "Amount and recipient are required" });
    return;
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  // Find recipient by referral code or ID
  const [receiver] = await db.select().from(usersTable).where(
    or(
      eq(usersTable.referralCode, recipientIdentifier.toUpperCase()),
      eq(usersTable.id, recipientIdentifier),
    )
  );

  if (!receiver) {
    res.status(400).json({ error: "Recipient not found" });
    return;
  }

  if (receiver.id === sender.id) {
    res.status(400).json({ error: "Cannot send to yourself" });
    return;
  }

  const senderBalance = parseFloat(sender.walletBalance);
  if (senderBalance < amountNum) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  // Atomic transfer
  await db.transaction(async (tx) => {
    await tx.update(usersTable)
      .set({ walletBalance: String(senderBalance - amountNum) })
      .where(eq(usersTable.id, sender.id));

    const receiverBalance = parseFloat(receiver.walletBalance);
    await tx.update(usersTable)
      .set({ walletBalance: String(receiverBalance + amountNum) })
      .where(eq(usersTable.id, receiver.id));
  });

  const [transfer] = await db.insert(p2pTransfersTable).values({
    senderId: sender.id,
    receiverId: receiver.id,
    amount: String(amountNum),
    note: note ?? null,
  }).returning();

  res.status(201).json({
    ...transfer,
    senderEmail: sender.email,
    receiverEmail: receiver.email,
  });
});

export default router;
