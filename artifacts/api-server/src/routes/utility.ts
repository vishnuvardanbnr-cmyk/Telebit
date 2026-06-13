import { Router } from "express";
import { db, usersTable, utilityTransactionsTable, rechargePlansTable, platformSettingsTable } from "@workspace/db";
import { eq, sql, desc, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();
router.use("/utility", requireAuth);

/* ─── myrc.in config ──────────────────────────────────────────── */
const MYRC_USERNAME = process.env["MYRC_USERNAME"] ?? "";
const MYRC_TOKEN = process.env["MYRC_TOKEN"] ?? "";
const LIVE = !!(MYRC_USERNAME && MYRC_TOKEN);

async function callMyrc(params: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams({
    username: MYRC_USERNAME,
    token: MYRC_TOKEN,
    format: "json",
    ...params,
  });
  const res = await fetch(`https://myrc.in/v3/recharge/api?${qs}`);
  return res.json();
}

async function myrcBalance(): Promise<number | null> {
  if (!LIVE) return null;
  try {
    const qs = new URLSearchParams({ username: MYRC_USERNAME, token: MYRC_TOKEN, format: "json" });
    const res = await fetch(`https://myrc.in/v3/recharge/balance?${qs}`);
    const d = await res.json() as { status: string; balance?: number };
    return d.status === "Success" ? Number(d.balance) : null;
  } catch { return null; }
}

/* ─── Full operator list from myrc.in ─────────────────────────── */
const OPERATORS: Record<string, { code: string; name: string }[]> = {
  mobile: [
    { code: "A", name: "Airtel" },
    { code: "V", name: "Vodafone Idea (VI)" },
    { code: "RC", name: "JIO" },
    { code: "BT", name: "BSNL Topup" },
    { code: "BR", name: "BSNL STV" },
    { code: "AL", name: "Airtel Live" },
  ],
  postpaid: [
    { code: "PAT", name: "Airtel Postpaid" },
    { code: "IP", name: "Idea Postpaid" },
    { code: "VP", name: "Vodafone Postpaid" },
    { code: "VLN", name: "Vodafone Landline" },
    { code: "BP", name: "BSNL Postpaid" },
    { code: "LBS", name: "BSNL Landline" },
    { code: "LAT", name: "Airtel Landline" },
    { code: "JPP", name: "JIO Postpaid" },
  ],
  electricity: [
    { code: "NBE", name: "North Bihar Electricity" },
    { code: "JBVNL", name: "JBVNL - Jharkhand" },
    { code: "BSES", name: "BSES Rajdhani - Delhi" },
    { code: "BSESY", name: "BSES Yamuna - Delhi" },
    { code: "TPD", name: "Tata Power Delhi" },
    { code: "SBE", name: "South Bihar Electricity" },
    { code: "BEST", name: "BEST Mumbai" },
    { code: "BESCOM", name: "BESCOM Bangalore" },
    { code: "CESC", name: "CESC West Bengal" },
    { code: "JVV", name: "Jaipur Vidyut (Rajasthan)" },
    { code: "MSEDC", name: "MSEDC Maharashtra" },
    { code: "NP", name: "Noida Power" },
    { code: "SPA", name: "Southern Power - Andhra Pradesh" },
    { code: "SPT", name: "Southern Power - Telangana" },
    { code: "TNEB", name: "TNEB Tamil Nadu" },
    { code: "UPPCLU", name: "PVVNL (UP Urban)" },
    { code: "UPPCLR", name: "UPPCL Rural" },
    { code: "DHBVN", name: "DHBVN Haryana" },
    { code: "PSPCL", name: "PSPCL Punjab" },
    { code: "KSEB", name: "KSEB Kerala" },
    { code: "PGVCL", name: "Paschim Gujarat Vij" },
    { code: "MGVCL", name: "Madhya Gujarat Vij" },
    { code: "DGVCL", name: "Dakshin Gujarat Vij" },
    { code: "UGVCL", name: "Uttar Gujarat Vij" },
    { code: "WBSEDCL", name: "WBSEDCL West Bengal" },
    { code: "NDPL", name: "TPDDL Delhi" },
    { code: "RELIANCE", name: "Reliance Energy" },
    { code: "AEML", name: "Adani Power (AEML)" },
    { code: "CSPDCL", name: "CSPDCL Chhattisgarh" },
    { code: "HPSEBL", name: "HPSEBL Himachal Pradesh" },
    { code: "UHBV", name: "UHBVN Haryana" },
    { code: "UPCLU", name: "UPCL Uttarakhand" },
  ],
  gas: [
    { code: "MG", name: "Mahanagar Gas" },
    { code: "AG", name: "Adani Gas" },
    { code: "GG", name: "Gujarat Gas" },
    { code: "IG", name: "Indraprastha Gas" },
    { code: "SMG", name: "Sabarmati Gas" },
    { code: "MNGL", name: "Maharashtra Natural Gas" },
    { code: "Hpgas", name: "HP Gas Booking" },
    { code: "Indanegas", name: "Indane Gas Booking" },
    { code: "Bharatgas", name: "Bharat Gas Booking" },
  ],
  fastag: [
    { code: "HDF", name: "HDFC Bank FASTag" },
    { code: "SBF", name: "SBI FASTag" },
    { code: "ICF", name: "ICICI Bank FASTag" },
    { code: "AXF", name: "Axis Bank FASTag" },
    { code: "PTF", name: "Paytm FASTag" },
    { code: "KMF", name: "Kotak Mahindra FASTag" },
    { code: "INDF", name: "IndusInd Bank FASTag" },
    { code: "IFF", name: "IDFC First Bank FASTag" },
    { code: "FDF", name: "Federal Bank FASTag" },
    { code: "BBF", name: "Bank of Baroda FASTag" },
    { code: "APB", name: "Airtel Payments Bank FASTag" },
  ],
  dth: [
    { code: "ATV", name: "Airtel Digital TV" },
    { code: "STV", name: "SUN Direct DTH" },
    { code: "TTV", name: "Tata Play" },
    { code: "VTV", name: "Videocon DTH" },
    { code: "DTV", name: "Dish TV" },
  ],
};

/* ─── GET /api/utility/operators?type=… ─────────────────────── */
router.get("/utility/operators", (req, res) => {
  const type = req.query["type"] as string;
  const list = OPERATORS[type];
  if (!list) {
    res.status(400).json({ error: "Invalid type. Use: mobile, postpaid, electricity, gas, fastag, dth" });
    return;
  }
  res.json({ operators: list, live: LIVE });
});

/* ─── GET /api/utility/balance ────────────────────────────────── */
router.get("/utility/balance", async (_req, res) => {
  const bal = await myrcBalance();
  res.json({ live: LIVE, providerBalance: bal });
});

/* ─── Operator code → plan API operator name mapping ─────────── */
const OP_NAME: Record<string, string> = {
  A: "AIRTEL", AL: "AIRTEL", PAT: "AIRTEL",
  V: "Vi", VP: "Vi", VLN: "Vi", IP: "Vi",
  RC: "JIO", JPP: "JIO",
  BT: "BSNL", BR: "BSNL", BP: "BSNL", LBS: "BSNL",
  ATV: "AIRTEL_DTH", TTV: "TATAPLAY", DTV: "DISHTV",
};

/* ─── GET /api/utility/plans?operator=<code>&type=<type> ─────── */
router.get("/utility/plans", async (req, res) => {
  try {
    const opcode = (req.query["operator"] as string) ?? "";
    const serviceType = (req.query["type"] as string) ?? "mobile";
    const category = (req.query["category"] as string) ?? "";

    const conditions: ReturnType<typeof eq>[] = [eq(rechargePlansTable.serviceType, serviceType)];
    const operatorName = OP_NAME[opcode];
    if (operatorName) {
      conditions.push(eq(rechargePlansTable.operator, operatorName));
    }
    if (category) {
      conditions.push(eq(rechargePlansTable.category, category));
    }

    const plans = await db
      .select()
      .from(rechargePlansTable)
      .where(and(...conditions))
      .orderBy(rechargePlansTable.amount);

    const grouped: Record<string, typeof plans> = {};
    for (const p of plans) {
      (grouped[p.category] ??= []).push(p);
    }

    res.json({ plans, grouped, supported: plans.length > 0 });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ─── GET /api/utility/rate ──────────────────────────────────── */
router.get("/utility/rate", async (_req, res) => {
  try {
    const [setting] = await db
      .select()
      .from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "usdToInrRate"));
    const rate = setting ? Number(setting.value) : 85;
    res.json({ usdToInrRate: rate });
  } catch {
    res.json({ usdToInrRate: 85 });
  }
});

/* ─── GET /api/utility/transactions ──────────────────────────── */
router.get("/utility/transactions", async (req, res) => {
  try {
    const userId = (req as any).dbUser.id as string;
    const rows = await db
      .select()
      .from(utilityTransactionsTable)
      .where(eq(utilityTransactionsTable.userId, userId))
      .orderBy(desc(utilityTransactionsTable.createdAt))
      .limit(50);
    res.json({ data: rows });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ─── POST /api/utility/pay ──────────────────────────────────── */
router.post("/utility/pay", async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const userId = user.id as string;

    const { operator, consumerNumber, amount, serviceType, value1, value2 } = req.body as {
      operator: string;
      consumerNumber: string;
      amount: number;
      serviceType: string;
      value1?: string;
      value2?: string;
    };

    if (!operator || !consumerNumber || !amount || amount <= 0) {
      res.status(400).json({ error: "operator, consumerNumber and amount are required" });
      return;
    }

    const [rateSetting] = await db
      .select()
      .from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "usdToInrRate"));
    const usdToInrRate = rateSetting ? Number(rateSetting.value) : 85;
    const amountUsdt = amount / usdToInrRate;

    if (Number(user.incomeBalance) < amountUsdt) {
      res.status(400).json({ error: "Insufficient income balance" });
      return;
    }

    const refId = `TB${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
    const opList = OPERATORS[serviceType] ?? [];
    const opName = opList.find(o => o.code === operator)?.name ?? operator;

    let txStatus = "success";
    let apiOpId = "";
    let apiTxId = "";

    if (LIVE) {
      const params: Record<string, string> = {
        opcode: operator,
        number: consumerNumber,
        amount: String(amount),
        orderid: refId,
      };
      if (value1) params["value1"] = value1;
      if (value2) params["value2"] = value2;

      const d = await callMyrc(params) as { status: string; message?: string; opid?: string; txid?: string };

      if (d.status === "Failure") {
        res.status(400).json({ error: d.message ?? "Transaction failed" });
        return;
      }

      txStatus = d.status === "Success" ? "success" : "pending";
      apiOpId = d.opid ?? "";
      apiTxId = d.txid ?? "";
    } else {
      apiOpId = `DEMO_${refId}`;
    }

    await db.update(usersTable).set({
      incomeBalance: sql`income_balance - ${amountUsdt.toFixed(8)}`,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, userId));

    const [utx] = await db.insert(utilityTransactionsTable).values({
      userId,
      serviceType,
      operatorCode: operator,
      operatorName: opName,
      consumerNumber,
      amount: amountUsdt.toFixed(8),
      status: txStatus,
      apiRefId: apiOpId,
      externalRefId: refId,
      description: `${opName} — ${consumerNumber}`,
      meta: { live: LIVE, apiTxId, inrAmount: amount, usdToInrRate, value1: value1 ?? null, value2: value2 ?? null },
    }).returning();

    res.json({
      success: true,
      txId: utx.id,
      refId,
      status: txStatus,
      live: LIVE,
      usdToInrRate,
      amountInr: amount,
      amountUsdt: Number(amountUsdt.toFixed(6)),
      message: txStatus === "pending"
        ? "Transaction submitted, processing by operator."
        : `${opName} payment successful.`,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
