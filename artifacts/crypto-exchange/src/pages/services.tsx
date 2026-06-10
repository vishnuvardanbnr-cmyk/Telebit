import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Smartphone, Zap, Flame, Tag, Tv2, Phone,
  X, Loader2, CheckCircle2, Clock, AlertTriangle,
  WifiOff, Wifi, ArrowLeft,
} from "lucide-react";
import { formatUsdt } from "@/lib/format";

const BASE = import.meta.env.BASE_URL;

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}api/utility${path}`, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

/* ─── Types ──────────────────────────────────────────────────── */
type Op = { code: string; name: string };
type ServiceType = "mobile" | "postpaid" | "electricity" | "gas" | "fastag" | "dth";
type UtilTx = {
  id: number; serviceType: string; operatorName: string; consumerNumber: string;
  amount: string; status: string; description: string; createdAt: string;
};
type Plan = {
  id: number; operator: string; operatorCode: string; serviceType: string;
  amount: number; category: string; planName: string | null; validity: string | null;
  data: string | null; calls: string | null; sms: string | null;
  description: string | null; extraBenefits: string | null; isPopular: boolean | null;
};

/* ─── Service catalogue ───────────────────────────────────────── */
const SERVICES: {
  type: ServiceType; label: string; icon: React.ElementType;
  desc: string; inputLabel: string; placeholder: string; amountLabel: string;
  color: string;
}[] = [
  { type: "mobile", label: "Mobile Recharge", icon: Smartphone, color: "text-blue-600",
    desc: "Airtel, JIO, Vi, BSNL prepaid",
    inputLabel: "Mobile Number", placeholder: "10-digit mobile number", amountLabel: "Recharge Amount (₹)" },
  { type: "postpaid", label: "Postpaid Bill", icon: Phone, color: "text-indigo-600",
    desc: "Airtel, JIO, Vi, BSNL postpaid & landline",
    inputLabel: "Mobile / Landline Number", placeholder: "Mobile or landline number", amountLabel: "Bill Amount (₹)" },
  { type: "electricity", label: "Electricity Bill", icon: Zap, color: "text-amber-600",
    desc: "80+ electricity boards across India",
    inputLabel: "Consumer / Account Number", placeholder: "Consumer number", amountLabel: "Bill Amount (₹)" },
  { type: "gas", label: "Gas Bill", icon: Flame, color: "text-orange-600",
    desc: "MGL, IGL, Adani Gas, Gujarat Gas & more",
    inputLabel: "Consumer / BP Number", placeholder: "Consumer number", amountLabel: "Bill Amount (₹)" },
  { type: "fastag", label: "FASTag Recharge", icon: Tag, color: "text-green-600",
    desc: "HDFC, SBI, ICICI, Axis, Paytm & more",
    inputLabel: "Vehicle / Customer ID", placeholder: "Vehicle number or customer ID", amountLabel: "Recharge Amount (₹)" },
  { type: "dth", label: "DTH Recharge", icon: Tv2, color: "text-purple-600",
    desc: "Airtel Digital, Tata Play, Dish TV, SUN Direct",
    inputLabel: "Customer / Subscriber ID", placeholder: "Customer ID", amountLabel: "Recharge Amount (₹)" },
];

const AMOUNT_PRESETS: Record<string, number[]> = {
  mobile: [19, 49, 99, 199, 299, 399, 499, 599],
  dth: [99, 199, 299, 399, 499],
  postpaid: [199, 299, 399, 499, 699, 999],
  electricity: [500, 1000, 2000, 5000],
  gas: [500, 1000, 2000, 3000],
  fastag: [200, 500, 1000, 2000],
};

const TYPE_COLORS: Record<string, string> = {
  mobile: "bg-blue-100 text-blue-700", postpaid: "bg-indigo-100 text-indigo-700",
  electricity: "bg-amber-100 text-amber-700", gas: "bg-orange-100 text-orange-700",
  fastag: "bg-green-100 text-green-700", dth: "bg-purple-100 text-purple-700",
};

/* ─── Service Form Modal ─────────────────────────────────────── */
function ServiceForm({
  svc, walletBalance, onClose, onSuccess,
}: {
  svc: typeof SERVICES[0]; walletBalance: number;
  onClose: () => void; onSuccess: () => void;
}) {
  const [operators, setOperators] = useState<Op[]>([]);
  const [operator, setOperator] = useState("");
  const [consumerNumber, setConsumerNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [doneStatus, setDoneStatus] = useState<"success" | "pending">("success");
  const [live, setLive] = useState(false);
  const [usdToInrRate, setUsdToInrRate] = useState(85);

  const PLAN_TYPES = ["mobile", "postpaid", "dth"];
  const [plans, setPlans] = useState<Plan[]>([]);
  const [groupedPlans, setGroupedPlans] = useState<Record<string, Plan[]>>({});
  const [planCategory, setPlanCategory] = useState("all");
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

  const fetchPlans = (op: string) => {
    if (!PLAN_TYPES.includes(svc.type)) return;
    setLoadingPlans(true);
    apiFetch(`/plans?operator=${op}&type=${svc.type}`)
      .then(d => { setPlans(d.plans ?? []); setGroupedPlans(d.grouped ?? {}); setPlanCategory("all"); })
      .catch(() => { setPlans([]); setGroupedPlans({}); })
      .finally(() => setLoadingPlans(false));
  };

  useEffect(() => {
    apiFetch(`/operators?type=${svc.type}`).then(d => {
      setOperators(d.operators ?? []);
      setLive(d.live ?? false);
      const first = d.operators?.[0]?.code ?? "";
      if (first) { setOperator(first); fetchPlans(first); }
    }).catch(() => {});
    apiFetch("/rate").then(d => setUsdToInrRate(d.usdToInrRate ?? 85)).catch(() => {});
  }, [svc.type]);

  const presets = AMOUNT_PRESETS[svc.type] ?? [];
  const visiblePlans = planCategory === "all" ? plans : (groupedPlans[planCategory] ?? []);
  const usdtCost = Number(amount) > 0 ? (Number(amount) / usdToInrRate).toFixed(4) : null;
  const isValid = operator && consumerNumber.trim() && Number(amount) > 0;

  const handlePay = async () => {
    const amt = Number(amount);
    if (!isValid) return;
    if (amt / usdToInrRate > walletBalance) {
      toast.error("Insufficient wallet balance. Please top up first.");
      return;
    }
    setBusy(true);
    try {
      const d = await apiFetch("/pay", {
        method: "POST",
        body: JSON.stringify({ operator, consumerNumber, amount: amt, serviceType: svc.type }),
      });
      setDoneStatus(d.status === "pending" ? "pending" : "success");
      setDone(true);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message ?? "Payment failed");
    } finally { setBusy(false); }
  };

  const Icon = svc.icon;

  if (done) {
    return (
      <div className="flex flex-col items-center gap-6 py-10 text-center px-6">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${doneStatus === "success" ? "bg-green-100" : "bg-amber-100"}`}>
          <CheckCircle2 className={`w-10 h-10 ${doneStatus === "success" ? "text-green-600" : "text-amber-600"}`} />
        </div>
        <div>
          <p className="font-bold text-xl">{doneStatus === "pending" ? "Request Submitted" : "Payment Successful!"}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {operators.find(o => o.code === operator)?.name ?? operator} · {consumerNumber}
          </p>
          <p className="font-bold text-3xl mt-2">₹{Number(amount).toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">{usdtCost} USDT deducted</p>
          {doneStatus === "pending" && (
            <p className="text-xs text-amber-600 mt-3">Processing by operator — may take a few minutes.</p>
          )}
        </div>
        <Button onClick={onClose} className="w-full max-w-xs">Done</Button>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto max-h-[80vh]">
      {/* Header */}
      <div className="sticky top-0 bg-card border-b border-border flex items-center justify-between px-5 py-4 z-10">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-muted`}>
            <Icon className={`w-5 h-5 ${svc.color}`} />
          </div>
          <div>
            <p className="font-semibold text-sm">{svc.label}</p>
            <p className="text-xs text-muted-foreground">{svc.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {live ? (
            <Badge variant="outline" className="text-green-600 border-green-300 text-[10px] gap-1">
              <Wifi className="w-3 h-3" /> LIVE
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] gap-1">
              <WifiOff className="w-3 h-3" /> DEMO
            </Badge>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Balance + rate strip */}
        <div className="flex items-center justify-between text-xs bg-muted/40 rounded-lg px-3 py-2.5">
          <span className="text-muted-foreground">Wallet: <span className="font-semibold text-foreground">{formatUsdt(walletBalance)} USDT</span></span>
          <span className="text-muted-foreground">Rate: <span className="font-semibold text-foreground">$1 = ₹{usdToInrRate}</span></span>
        </div>

        {/* Operator */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Operator / Provider</label>
          <select
            value={operator}
            onChange={e => { setOperator(e.target.value); fetchPlans(e.target.value); }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {operators.map(op => (
              <option key={op.code} value={op.code}>{op.name}</option>
            ))}
          </select>
        </div>

        {/* Consumer number */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">{svc.inputLabel}</label>
          <input
            type="text"
            value={consumerNumber}
            onChange={e => setConsumerNumber(e.target.value)}
            placeholder={svc.placeholder}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">{svc.amountLabel}</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Enter amount"
            min={1}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {/* Quick presets */}
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {presets.map(p => (
                <button
                  key={p}
                  onClick={() => setAmount(String(p))}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    amount === String(p)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:border-primary/50 hover:bg-accent"
                  }`}
                >
                  ₹{p}
                </button>
              ))}
            </div>
          )}
          {usdtCost && (
            <p className="text-xs text-muted-foreground mt-1.5">≈ {usdtCost} USDT will be deducted</p>
          )}
        </div>

        {/* Browse plans */}
        {PLAN_TYPES.includes(svc.type) && (
          <div>
            <button
              onClick={() => setShowPlans(v => !v)}
              className="text-xs font-medium text-primary underline-offset-2 hover:underline flex items-center gap-1"
            >
              {showPlans ? "▲ Hide plans" : "▼ Browse plans (optional)"}
            </button>

            {showPlans && (
              <div className="mt-3 border border-border rounded-xl overflow-hidden">
                {/* Category tabs */}
                <div className="flex gap-1 overflow-x-auto px-3 pt-3 pb-2 bg-muted/30">
                  {["all", ...Object.keys(groupedPlans)].filter((v, i, a) => a.indexOf(v) === i).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setPlanCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        planCategory === cat ? "bg-primary text-primary-foreground" : "bg-background border border-border hover:border-primary/50"
                      }`}
                    >
                      {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
                {loadingPlans ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                ) : visiblePlans.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No plans found</p>
                ) : (
                  <div className="divide-y divide-border max-h-60 overflow-y-auto">
                    {visiblePlans.map(plan => (
                      <button
                        key={plan.id}
                        onClick={() => { setAmount(String(plan.amount)); setShowPlans(false); }}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent transition-colors ${
                          amount === String(plan.amount) ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">₹{plan.amount}</span>
                            {plan.isPopular && <Badge className="text-[9px] px-1.5 py-0">Popular</Badge>}
                          </div>
                          {plan.planName && <p className="text-xs text-muted-foreground truncate">{plan.planName}</p>}
                          <div className="flex gap-1.5 mt-1 flex-wrap">
                            {plan.data && plan.data !== "—" && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">📶 {plan.data}</span>}
                            {plan.calls && plan.calls !== "—" && <span className="text-[10px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">📞 {plan.calls}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {plan.validity && <span className="text-xs font-medium text-muted-foreground">{plan.validity}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pay button */}
        <Button
          onClick={handlePay}
          disabled={!isValid || busy}
          className="w-full font-semibold"
          size="lg"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {busy ? "Processing…" : usdtCost ? `Pay ₹${amount} (${usdtCost} USDT)` : "Pay Now"}
        </Button>

        {!live && (
          <p className="text-[11px] text-amber-600 text-center">
            Demo mode — no real transaction will be made. Add MYRC_USERNAME + MYRC_TOKEN env vars to go live.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Main Services Page ─────────────────────────────────────── */
export default function Services() {
  const { data: user } = useGetMe();
  const walletBalance = Number(user?.walletBalance ?? 0);

  const [activeService, setActiveService] = useState<ServiceType | null>(null);
  const [txs, setTxs] = useState<UtilTx[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);

  const loadTxs = () => {
    setLoadingTxs(true);
    apiFetch("/transactions")
      .then(d => setTxs(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingTxs(false));
  };

  useEffect(() => { loadTxs(); }, []);

  const activeSvc = SERVICES.find(s => s.type === activeService) ?? null;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-mono font-bold uppercase tracking-wider">Services</h1>
          <p className="text-sm text-muted-foreground mt-1">Pay bills & recharge using your USDT wallet balance</p>
        </div>

        {/* Wallet balance strip */}
        <Card className="rounded-none border-primary/40 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Available Balance</p>
                <p className="text-2xl font-mono font-bold text-primary mt-1">
                  {formatUsdt(walletBalance)} <span className="text-base text-primary/70">USDT</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service grid */}
        <div>
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">Select Service</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {SERVICES.map(svc => {
              const Icon = svc.icon;
              return (
                <button
                  key={svc.type}
                  onClick={() => setActiveService(svc.type)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center hover:border-primary/50 hover:bg-accent transition-colors group"
                >
                  <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <Icon className={`w-5 h-5 ${svc.color}`} />
                  </div>
                  <p className="text-[11px] font-semibold leading-tight">{svc.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Transaction history */}
        <div>
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">Service History</h2>
          <Card className="rounded-none">
            <CardContent className="p-0">
              {loadingTxs ? (
                <div className="space-y-3 p-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : txs.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No service transactions yet.</p>
                  <p className="text-xs text-muted-foreground">Your recharge and bill payment history will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {txs.map(tx => {
                    const svc = SERVICES.find(s => s.type === tx.serviceType);
                    const Icon = svc?.icon ?? Smartphone;
                    return (
                      <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/40 transition-colors">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${TYPE_COLORS[tx.serviceType] ?? "bg-muted text-foreground"}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tx.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(tx.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-red-600">−{Number(tx.amount).toFixed(4)} USDT</p>
                          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                            tx.status === "success" ? "bg-green-100 text-green-700" :
                            tx.status === "failed" ? "bg-red-100 text-red-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Service Modal (slide-up on mobile, centered on desktop) */}
      {activeSvc && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setActiveService(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full sm:max-w-[480px] bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* drag handle on mobile */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>
            <ServiceForm
              svc={activeSvc}
              walletBalance={walletBalance}
              onClose={() => setActiveService(null)}
              onSuccess={() => { loadTxs(); }}
            />
          </div>
        </div>
      )}
    </Layout>
  );
}
