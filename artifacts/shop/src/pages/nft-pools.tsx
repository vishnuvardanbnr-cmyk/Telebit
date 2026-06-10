import { useState } from "react";
import {
  useListNftPools,
  useGetNftGlobal,
  useGetNftHoldings,
  useBidNftPool,
  useGetMe,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { fmtUsdt } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  AlertCircle, ArrowLeft, TrendingUp, Lock,
  ChevronRight, Coins, Shield, Zap, Users, Clock,
} from "lucide-react";

type NftPoolWithNft = {
  id: string; nftId: string; level: number;
  poolSize: string; poolLimit: string; poolAmount: string;
  status: string; createdAt: string; updatedAt: string;
  nft: { id: string; title: string; image: string; price: string; status: string };
};

/* ─── Level theme ─────────────────────────────────────────────────────── */
const THEMES: Record<number, { bar: string; icon: string; badge: string; badgeText: string; comingSoon: string }> = {
  1: {
    bar: "from-sky-400 to-blue-500",
    icon: "from-sky-400 to-blue-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badgeText: "bg-sky-50 text-sky-700 border-sky-200",
    comingSoon: "bg-sky-50 border-sky-100",
  },
  2: {
    bar: "from-violet-400 to-purple-500",
    icon: "from-violet-400 to-purple-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badgeText: "bg-violet-50 text-violet-700 border-violet-200",
    comingSoon: "bg-violet-50 border-violet-100",
  },
  3: {
    bar: "from-amber-400 to-orange-500",
    icon: "from-amber-400 to-orange-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badgeText: "bg-amber-50 text-amber-700 border-amber-200",
    comingSoon: "bg-amber-50 border-amber-100",
  },
  4: {
    bar: "from-emerald-400 to-teal-500",
    icon: "from-emerald-400 to-teal-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badgeText: "bg-emerald-50 text-emerald-700 border-emerald-200",
    comingSoon: "bg-emerald-50 border-emerald-100",
  },
};
const fallbackTheme = THEMES[1];
const getTheme = (level: number) => THEMES[level] ?? fallbackTheme;

/* ─── Placeholder pool card (shown when no real pools exist) ──────────── */
const PLACEHOLDER_POOLS = [
  { level: 1, title: "Bronze Pool", size: "5,000", dailyYield: "0.8%" },
  { level: 2, title: "Silver Pool", size: "10,000", dailyYield: "1.2%" },
  { level: 3, title: "Gold Pool",   size: "25,000", dailyYield: "1.8%" },
  { level: 4, title: "Platinum Pool", size: "50,000", dailyYield: "2.5%" },
];

function PlaceholderPoolCard({ level, title, size, dailyYield }: { level: number; title: string; size: string; dailyYield: string }) {
  const t = getTheme(level);
  return (
    <div className={`rounded-2xl border overflow-hidden ${t.comingSoon}`}>
      <div className={`h-1 w-full bg-gradient-to-r ${t.bar} opacity-40`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.icon} opacity-40 flex items-center justify-center`}>
              <span className="text-white font-black text-sm">L{level}</span>
            </div>
            <div>
              <p className="font-bold text-base text-foreground/50">{title}</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Level {level} Pool</p>
            </div>
          </div>
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border border-muted bg-muted/60 text-muted-foreground`}>
            <Clock className="h-2.5 w-2.5 inline mr-1 -mt-px" />
            Coming Soon
          </span>
        </div>

        {/* Progress placeholder */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] text-muted-foreground/60 font-medium">Pool filled</span>
            <span className="text-[11px] font-bold tabular-nums text-muted-foreground/60">0%</span>
          </div>
          <div className="h-2 bg-muted/40 rounded-full" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/60 rounded-xl p-2.5 text-center border border-white">
            <p className="text-[9px] text-muted-foreground/60 uppercase font-semibold tracking-wide">Size</p>
            <p className="font-bold text-sm mt-0.5 text-foreground/40">${size}</p>
          </div>
          <div className="bg-white/60 rounded-xl p-2.5 text-center border border-white">
            <p className="text-[9px] text-muted-foreground/60 uppercase font-semibold tracking-wide">Daily Yield</p>
            <p className="font-bold text-sm mt-0.5 text-foreground/40">{dailyYield}</p>
          </div>
          <div className="bg-white/60 rounded-xl p-2.5 text-center border border-white">
            <p className="text-[9px] text-muted-foreground/60 uppercase font-semibold tracking-wide">Left</p>
            <p className="font-bold text-sm mt-0.5 text-foreground/40">${size}</p>
          </div>
        </div>

        <div className="h-11 rounded-xl flex items-center justify-center gap-2 bg-muted/40 text-muted-foreground/60 text-sm font-semibold border border-muted/60 cursor-not-allowed select-none">
          <Lock className="h-4 w-4" />
          Opens Soon
        </div>
      </div>
    </div>
  );
}

/* ─── Real pool card ──────────────────────────────────────────────────── */
function PoolCard({ pool, onBid }: { pool: NftPoolWithNft; onBid: (p: NftPoolWithNft) => void }) {
  const poolSize = parseFloat(pool.poolSize);
  const poolAmount = parseFloat(pool.poolAmount);
  const poolLimit = parseFloat(pool.poolLimit);
  const pct = poolSize > 0 ? Math.min(100, (poolAmount / poolSize) * 100) : 0;
  const isFull = poolLimit <= 0;
  const t = getTheme(pool.level);

  return (
    <div className={`rounded-2xl border bg-white overflow-hidden transition-all duration-200 ${
      isFull
        ? "border-border opacity-60"
        : `border-border hover:border-primary/30 shadow-sm hover:shadow-md`
    }`}>
      {!isFull && <div className={`h-1 w-full bg-gradient-to-r ${t.bar}`} />}
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.bar} flex items-center justify-center shadow-sm`}>
              <span className="text-white font-black text-sm">L{pool.level}</span>
            </div>
            <div>
              <p className={`font-bold text-base leading-tight ${isFull ? "text-muted-foreground" : ""}`}>
                {pool.nft.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Level {pool.level} Pool</p>
            </div>
          </div>
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
            isFull ? "bg-muted text-muted-foreground border-border" : t.badge
          }`}>
            {isFull ? "● Closed" : "● Open"}
          </span>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] text-muted-foreground font-medium">Pool filled</span>
            <span className="text-[11px] font-bold tabular-nums">{pct.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${isFull ? "from-muted-foreground to-muted-foreground" : t.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-muted/40 rounded-xl p-2.5 text-center">
            <p className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wide">Size</p>
            <p className="font-bold text-sm mt-0.5">${fmtUsdt(pool.poolSize)}</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-2.5 text-center">
            <p className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wide">Filled</p>
            <p className="font-bold text-sm mt-0.5">${fmtUsdt(pool.poolAmount)}</p>
          </div>
          <div className={`rounded-xl p-2.5 text-center ${isFull ? "bg-muted/40" : "bg-emerald-50 border border-emerald-100"}`}>
            <p className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wide">Left</p>
            <p className={`font-bold text-sm mt-0.5 ${isFull ? "text-muted-foreground" : "text-emerald-600"}`}>
              ${fmtUsdt(pool.poolLimit)}
            </p>
          </div>
        </div>

        {isFull ? (
          <div className="h-11 rounded-xl flex items-center justify-center gap-2 bg-muted/40 text-muted-foreground text-sm font-medium">
            <Lock className="h-4 w-4" />Pool Closed
          </div>
        ) : (
          <button
            onClick={() => onBid(pool)}
            className={`w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-gradient-to-r ${t.bar} text-white shadow-sm hover:shadow-md hover:opacity-95 transition-all active:scale-[0.98]`}
          >
            <TrendingUp className="h-4 w-4" />Place Bid
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Bid dialog ──────────────────────────────────────────────────────── */
function BidDialog({ pool, open, onClose }: { pool: NftPoolWithNft | null; open: boolean; onClose: () => void }) {
  const { data: global } = useGetNftGlobal();
  const { data: holdings } = useGetNftHoldings();
  const { data: user } = useGetMe();
  const bidMutation = useBidNftPool();
  const [amount, setAmount] = useState("");

  if (!pool) return null;

  const t = getTheme(pool.level);
  const parsedAmount = parseFloat(amount) || 0;
  const poolTokens = parseFloat(holdings?.poolRewardAvailable ?? "0");
  const buyPrice = parseFloat(global?.buyPrice ?? "1");
  const nftHoldingUsdt = poolTokens * buyPrice;
  const dailyLimit = nftHoldingUsdt * 4;
  const poolSize = parseFloat(pool.poolSize);
  const poolLimit = parseFloat(pool.poolLimit);
  const walletBalance = parseFloat(user?.walletBalance ?? "0");

  const validationError = (() => {
    if (!parsedAmount) return null;
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) return "Amount must be a positive whole number";
    if (parsedAmount > poolLimit) return `Exceeds pool capacity ($${fmtUsdt(String(poolLimit))})`;
    if (parsedAmount > walletBalance) return "Insufficient wallet balance";
    if (nftHoldingUsdt < 4) return "Buy V2 tokens first to unlock pool bidding";
    return null;
  })();

  const handleBid = () => {
    if (!parsedAmount || validationError) return;
    bidMutation.mutate(
      { poolId: pool.id, data: { amount: parsedAmount } },
      {
        onSuccess: (res) => { toast.success((res as any).message || "Bid placed!"); setAmount(""); onClose(); },
        onError: (err: any) => toast.error(err.message || "Bid failed"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl p-0 gap-0 border-0 shadow-2xl overflow-hidden">
        <div className={`px-6 pt-6 pb-5 bg-gradient-to-br ${t.bar} text-white`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <span className="font-black text-sm">L{pool.level}</span>
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">{pool.nft.title}</DialogTitle>
              <p className="text-xs text-white/70">Level {pool.level} Pool Bid</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Your NFT Holding", val: `$${nftHoldingUsdt.toFixed(2)}`, green: false },
              { label: "Daily Bid Limit", val: `$${dailyLimit.toFixed(2)}`, green: false },
              { label: "Pool Remaining", val: `$${fmtUsdt(pool.poolLimit)}`, green: true },
              { label: "Max per Pool (50%)", val: `$${fmtUsdt(String(poolSize * 0.5))}`, green: false },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-3 ${s.green ? "bg-emerald-50 border border-emerald-100" : "bg-muted/40"}`}>
                <p className="text-[10px] text-muted-foreground font-medium leading-tight">{s.label}</p>
                <p className={`font-bold text-sm mt-1 ${s.green ? "text-emerald-700" : ""}`}>{s.val}</p>
              </div>
            ))}
          </div>

          {nftHoldingUsdt < 4 && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-800">NFT Holding Too Low</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  <Link href="/nft/buy" className="underline font-medium">Buy V2 tokens</Link> first to unlock bidding.
                </p>
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Bid Amount (USDT)</label>
              <span className="text-[11px] text-muted-foreground">Bal: <span className="font-semibold text-foreground">${fmtUsdt(user?.walletBalance)}</span></span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">$</span>
              <Input
                type="number" step="1" min="1" placeholder="Whole number (e.g. 10)"
                value={amount} onChange={e => setAmount(e.target.value)}
                className="pl-7 h-12 rounded-xl text-sm font-medium"
              />
            </div>
            {validationError && (
              <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{validationError}
              </p>
            )}
          </div>

          <div className="space-y-1.5 bg-muted/30 rounded-xl p-3">
            {["Whole-number bids only", "24h cooldown per pool per user", "Total bid ≤ 50% of pool size", "Daily bids ≤ 4× your NFT holding"].map(r => (
              <div key={r} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <div className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
                {r}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 h-12 rounded-xl text-sm">Cancel</Button>
            <button
              onClick={handleBid}
              disabled={!parsedAmount || !!validationError || bidMutation.isPending}
              className={`flex-1 h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-gradient-to-r ${t.bar} text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <TrendingUp className="h-4 w-4" />
              {bidMutation.isPending ? "Placing…" : "Place Bid"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */
export default function NftPoolsPage() {
  const { data: pools, isLoading } = useListNftPools();
  const [selectedPool, setSelectedPool] = useState<NftPoolWithNft | null>(null);

  const allPools = (pools as NftPoolWithNft[] | undefined) ?? [];
  const activePools = allPools.filter(p => p.status === "active");
  const closedPools = allPools.filter(p => p.status !== "active");
  const hasAnyReal = allPools.length > 0;

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* Hero header */}
      <div className="bg-white border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/" className="w-8 h-8 rounded-full border border-border bg-white flex items-center justify-center hover:bg-muted/50 transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">NFT Pool Bidding</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Bid USDT into pools · Earn distribution rewards</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { icon: Zap,    text: "Whole-number bids" },
              { icon: Shield, text: "Max 50% per pool" },
              { icon: Users,  text: "4× holding daily limit" },
              { icon: Coins,  text: "V2 tokens required" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5 border border-border">
                <Icon className="h-3 w-3" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}
          </div>
        ) : hasAnyReal ? (
          <>
            {activePools.length > 0 && (
              <div className="space-y-4">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  {activePools.length} Active Pool{activePools.length !== 1 ? "s" : ""}
                </p>
                {activePools.map(pool => (
                  <PoolCard key={pool.id} pool={pool} onBid={setSelectedPool} />
                ))}
              </div>
            )}
            {closedPools.length > 0 && (
              <div className="space-y-4">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Closed Pools</p>
                {closedPools.map(pool => (
                  <PoolCard key={pool.id} pool={pool} onBid={() => {}} />
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── No real pools yet: show placeholder cards ── */
          <div className="space-y-4">
            {/* Soft notice */}
            <div className="flex items-center gap-2.5 bg-white border border-border rounded-2xl px-4 py-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-semibold">Pools launching soon</p>
                <p className="text-xs text-muted-foreground">The admin is setting up pools — here's a preview of what's coming.</p>
              </div>
            </div>

            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Upcoming Pools</p>
            {PLACEHOLDER_POOLS.map(p => (
              <PlaceholderPoolCard key={p.level} {...p} />
            ))}
          </div>
        )}

        {/* CTA */}
        <Link href="/nft/buy">
          <div className="group flex items-center justify-between bg-white border border-border hover:border-primary/30 hover:shadow-sm rounded-2xl p-4 transition-all cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Don't have V2 Tokens yet?</p>
                <p className="text-xs text-muted-foreground">Purchase tokens to unlock pool bidding</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>
      </div>

      <BidDialog pool={selectedPool} open={!!selectedPool} onClose={() => setSelectedPool(null)} />
    </div>
  );
}
