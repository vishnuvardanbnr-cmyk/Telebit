import { Router } from "express";
import {
  db,
  dematAccountsTable,
  shareTransferRequestsTable,
  usersTable,
} from "@workspace/db";
import { eq, desc, sum } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { getSettings } from "../lib/settings";

const router = Router();

// ─── User: get own demat account ──────────────────────────────────────────────

router.get("/users/me/demat", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const [account] = await db
    .select()
    .from(dematAccountsTable)
    .where(eq(dematAccountsTable.userId, userId));

  if (!account) {
    res.status(404).json({ error: "No demat account found" });
    return;
  }

  res.json({
    id: account.id,
    holderName: account.holderName,
    dpId: account.dpId,
    clientId: account.clientId,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  });
});

// ─── User: create / update demat account ──────────────────────────────────────

router.put("/users/me/demat", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const { holderName, dpId, clientId } = req.body;

  if (!holderName?.trim() || !dpId?.trim() || !clientId?.trim()) {
    res.status(400).json({ error: "holderName, dpId, and clientId are required" });
    return;
  }

  const existing = await db
    .select()
    .from(dematAccountsTable)
    .where(eq(dematAccountsTable.userId, userId));

  let account;
  if (existing.length > 0) {
    const [updated] = await db
      .update(dematAccountsTable)
      .set({
        holderName: holderName.trim(),
        dpId: dpId.trim(),
        clientId: clientId.trim(),
        updatedAt: new Date(),
      } as any)
      .where(eq(dematAccountsTable.userId, userId))
      .returning();
    account = updated;
  } else {
    const [created] = await db
      .insert(dematAccountsTable)
      .values({
        userId,
        holderName: holderName.trim(),
        dpId: dpId.trim(),
        clientId: clientId.trim(),
      })
      .returning();
    account = created;
  }

  res.json({
    id: account.id,
    holderName: account.holderName,
    dpId: account.dpId,
    clientId: account.clientId,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  });
});

// ─── User: list own share transfer requests ────────────────────────────────────

router.get("/users/me/share-requests", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  const requests = await db
    .select()
    .from(shareTransferRequestsTable)
    .where(eq(shareTransferRequestsTable.userId, userId))
    .orderBy(desc(shareTransferRequestsTable.requestedAt));

  const totalConfirmedShares = requests
    .filter((r) => r.status === "transferred")
    .reduce((sum, r) => sum + r.sharesCount, 0);

  const totalPendingShares = requests
    .filter((r) => r.status === "pending")
    .reduce((sum, r) => sum + r.sharesCount, 0);

  res.json({
    requests: requests.map((r) => ({
      id: r.id,
      sharesCount: r.sharesCount,
      status: r.status,
      requestedAt: r.requestedAt,
      transferredAt: r.transferredAt,
      adminNote: r.adminNote,
    })),
    totalConfirmedShares,
    totalPendingShares,
  });
});

// ─── User: submit a share transfer request ─────────────────────────────────────

router.post("/users/me/share-requests", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  const [demat] = await db
    .select()
    .from(dematAccountsTable)
    .where(eq(dematAccountsTable.userId, userId));

  if (!demat) {
    res.status(400).json({ error: "Please add your demat account details first" });
    return;
  }

  const settings = await getSettings();
  const sharesCount = parseInt(settings.sharesPerPackage);

  const [created] = await db
    .insert(shareTransferRequestsTable)
    .values({
      userId,
      dematAccountId: demat.id,
      sharesCount,
    })
    .returning();

  res.status(201).json({
    id: created.id,
    sharesCount: created.sharesCount,
    status: created.status,
    requestedAt: created.requestedAt,
  });
});

// ─── Admin: list all share transfer requests ───────────────────────────────────

router.get("/admin/share-requests", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const status = req.query.status as string | undefined;

  const rows = await db
    .select()
    .from(shareTransferRequestsTable)
    .orderBy(desc(shareTransferRequestsTable.requestedAt));

  const filtered = status ? rows.filter((r) => r.status === status) : rows;

  const enriched = await Promise.all(
    filtered.map(async (r) => {
      const [user] = await db
        .select({ email: usersTable.email, fullName: usersTable.fullName })
        .from(usersTable)
        .where(eq(usersTable.id, r.userId));

      const [demat] = await db
        .select()
        .from(dematAccountsTable)
        .where(eq(dematAccountsTable.id, r.dematAccountId));

      return {
        id: r.id,
        userId: r.userId,
        userEmail: user?.email ?? "",
        userFullName: user?.fullName ?? "",
        sharesCount: r.sharesCount,
        status: r.status,
        requestedAt: r.requestedAt,
        transferredAt: r.transferredAt,
        adminNote: r.adminNote,
        dematAccount: demat
          ? {
              holderName: demat.holderName,
              dpId: demat.dpId,
              clientId: demat.clientId,
            }
          : null,
      };
    })
  );

  res.json(enriched);
});

// ─── Admin: mark request as transferred ───────────────────────────────────────

router.patch("/admin/share-requests/:id/transfer", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const { adminNote } = req.body;

  const [existing] = await db
    .select()
    .from(shareTransferRequestsTable)
    .where(eq(shareTransferRequestsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  if (existing.status === "transferred") {
    res.status(400).json({ error: "Already marked as transferred" });
    return;
  }

  const [updated] = await db
    .update(shareTransferRequestsTable)
    .set({
      status: "transferred",
      transferredAt: new Date(),
      adminNote: adminNote?.trim() ?? null,
    } as any)
    .where(eq(shareTransferRequestsTable.id, id))
    .returning();

  res.json({
    id: updated.id,
    status: updated.status,
    transferredAt: updated.transferredAt,
    adminNote: updated.adminNote,
  });
});

export default router;
