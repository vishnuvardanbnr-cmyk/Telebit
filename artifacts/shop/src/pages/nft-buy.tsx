import { useState } from "react";
import {
  useGetNftGlobal,
  useGetNftHoldings,
  useBuyNftTokens,
  useGetMe,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtUsdt } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  AlertCircle, Zap, Coins, TrendingUp, ArrowLeft,
  ChevronRight, Shield, Users, BarChart3, Wallet, Lock, Clock,
} from "lucide-react";

const QUICK = [10, 50, 100, 500];

export default function NftBuyPage() {
  const { data: global, isLoading: globalLoading } = useGetNftGlobal();
  const { data: holdings, isLoading: holdingsLoading } = useGetNftHoldings();
  const { data: user } = useGetMe();
  const buyMutation = useBuyNftTokens();
  const [amount, setAmount] = useState("");

  const parsedAmount = parseFloat(amount) || 0;
  const buyPrice = parseFloat(global?.buyPrice ?? "0.001");
  const sellPrice = parseFloat(global?.sellPrice ?? "0.0009");
  const liquidity = global?.liquidity ?? "0";
  const totalPurchase = global?.totalPurchase ?? "0";
  const canInvest = global?.canInvest ?? false;
  const walletBalance = parseFloat(user?.walletBalance ?? "0");
  const investedUsdt = parseFloat((user as any)?.investedUsdt ?? "0");
  const lifetimePurchased = parseFloat(holdings?.lifetimePurchased ?? "0");
  const estimatedTokens = parsedAmount > 0 ? (parsedAmount * 0.88) / buyPrice : 0;
  const capPct = Math.min(100, (lifetimePurchased / 10000) * 100);

  const isLoading = globalLoading || holdingsLoading;
  const notInitialized = !globalLoading && !global;
  const purchasesDisabled = notInitialized || !canInvest || investedUsdt <= 0;

  const validationError = (() => {
    if (!parsedAmount) return null;
    if (purchasesDisabled) return null;
    if (parsedAmount % 10 !== 0) return "Amount must be a multiple of $10";
    if (parsedAmount > 1000) return "Maximum $1,000 per transaction";
    if (parsedAmount > walletBalance) return "Insufficient wallet balance";
    if (lifetimePurchased + parsedAmount > 10000)
      return `Lifetime cap is $10,000. Used: $${lifetimePurchased.toFixed(2)}`;
    return null;
  })();

  const handleBuy = () => {
    if (!parsedAmount || validationError || purchasesDisabled) return;
    buyMutation.mutate(
      { data: { amount: parsedAmount } },
      {
        onSuccess: (res) => { toast.success((res as any).message || "V2 tokens purchased!"); setAmount(""); },
        onError: (err: any) => toast.error(err.message || "Purchase failed"),
      }
    );
  };

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* Hero header */}
      <div className="bg-white border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/" className="w-8 h-8 rounded-full border border-border bg-white flex items-center justify-center hover:bg-muted/50 transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Buy V2 Tokens</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Invest USDT · Earn appreciating TBT tokens</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* Status banner */}
        {notInitialized && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <Clock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Launching Soon</p>
              <p className="text-xs text-amber-700 mt-0.5">The V2 token system is being configured by the admin. Check back shortly to start investing.</p>
            </div>
          </div>
        )}
        {!notInitialized && !canInvest && !isLoading && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <Lock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Purchases Paused</p>
              <p className="text-xs text-amber-700 mt-0.5">Token purchases are temporarily disabled by the admin.</p>
            </div>
          </div>
        )}
        {!notInitialized && canInvest && investedUsdt <= 0 && !isLoading && (
          <div className="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-2xl p-4">
            <AlertCircle className="h-4 w-4 text-sky-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-sky-800">Deposit Required</p>
              <p className="text-xs text-sky-700 mt-0.5">Make a USDT deposit first to activate your investment account.</p>
            </div>
          </div>
        )}

        {/* Stats */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Buy Price", value: `$${buyPrice.toFixed(6)}`, accent: true },
              { label: "Sell Price", value: `$${sellPrice.toFixed(6)}`, accent: false },
              { label: "Total Liquidity", value: `$${fmtUsdt(liquidity)}`, accent: false },
              { label: "Platform Volume", value: `$${fmtUsdt(totalPurchase)}`, accent: false },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl border p-4 bg-white ${s.accent ? "border-primary/40" : "border-border"}`}>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">{s.label}</p>
                <p className={`text-lg font-extrabold tabular-nums ${s.accent ? "text-primary" : ""}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Lifetime cap */}
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-sm font-semibold">Your Lifetime Cap</span>
            <span className="text-sm font-bold text-primary tabular-nums">
              {isLoading ? "—" : `$${fmtUsdt(lifetimePurchased)} / $10,000`}
            </span>
          </div>
          <div className="h-2.5 bg-muted/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-700"
              style={{ width: isLoading ? "0%" : `${capPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[11px] text-muted-foreground">
            <span>{capPct.toFixed(1)}% used</span>
            <span>{isLoading ? "" : `$${fmtUsdt(String(10000 - lifetimePurchased))} remaining`}</span>
          </div>
        </div>

        {/* Purchase form */}
        <div className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 ${purchasesDisabled ? "border-border opacity-70" : "border-primary/30"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              <span className="font-bold text-base">Purchase Tokens</span>
            </div>
            <div className="text-[11px] bg-muted/50 border border-border rounded-full px-2.5 py-1 font-medium text-muted-foreground">
              {fmtUsdt(user?.walletBalance ?? "0")} USDT
            </div>
          </div>

          {/* Quick select */}
          <div className="grid grid-cols-4 gap-2">
            {QUICK.map(v => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                disabled={purchasesDisabled}
                className={`rounded-xl border py-2.5 text-sm font-bold transition-all disabled:pointer-events-none ${
                  parsedAmount === v
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "border-border bg-background hover:border-primary/50 text-foreground"
                }`}
              >
                ${v}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div>
            <label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide block mb-1.5">
              Custom Amount (USDT · multiples of $10)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">$</span>
              <Input
                type="number"
                step="10"
                min="10"
                max="1000"
                placeholder="e.g. 250"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                disabled={purchasesDisabled}
                className="pl-7 h-12 rounded-xl text-sm font-medium"
              />
            </div>
            {validationError && (
              <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{validationError}
              </p>
            )}
          </div>

          {/* Live estimate */}
          {parsedAmount > 0 && !validationError && !purchasesDisabled && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">You spend</span>
                <span className="font-semibold">${fmtUsdt(parsedAmount)} USDT</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Distribution (88%)</span>
                <span className="font-semibold">${fmtUsdt(String(parsedAmount * 0.88))}</span>
              </div>
              <div className="border-t border-primary/20 pt-2.5 flex justify-between text-sm font-extrabold text-primary">
                <span>You receive ≈</span>
                <span>{estimatedTokens.toFixed(4)} TBT</span>
              </div>
              <div className="flex justify-between text-xs text-emerald-600 font-medium">
                <span>Value at sell price</span>
                <span>≈ ${(estimatedTokens * sellPrice).toFixed(4)} USDT</span>
              </div>
            </div>
          )}

          <button
            onClick={handleBuy}
            disabled={!parsedAmount || !!validationError || purchasesDisabled || buyMutation.isPending}
            className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-white shadow-sm hover:opacity-95 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {purchasesDisabled ? (
              <><Lock className="h-4 w-4" /> Purchases Unavailable</>
            ) : buyMutation.isPending ? (
              <><Zap className="h-4 w-4 animate-pulse" /> Processing…</>
            ) : (
              <><Zap className="h-4 w-4" /> Buy V2 Tokens</>
            )}
          </button>
        </div>

        {/* How it works */}
        <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
          <p className="font-bold text-base">How It Works</p>
          <div className="space-y-4">
            {[
              { icon: Wallet, title: "Invest multiples of $10", desc: "Up to $1,000 per transaction · $10,000 lifetime cap per account." },
              { icon: Coins, title: "Receive TBT tokens at buy price", desc: "88% of your investment is allocated as tokens at the current buy rate." },
              { icon: TrendingUp, title: "Price rises with adoption", desc: "Buy price increases with each new investment — early investors earn more." },
              { icon: Users, title: "Earn from your network", desc: "Up to 10 upline sponsors earn token bonuses when you invest." },
              { icon: BarChart3, title: "Claim at sell price", desc: "Redeem tokens from the Holdings page at 90% of the current buy price." },
            ].map((step, i) => (
              <div key={i} className="flex gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <step.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="pt-0.5">
                  <p className="text-sm font-semibold leading-snug">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Referral grid */}
          <div className="bg-muted/40 rounded-xl p-4 mt-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Referral Bonus Rates</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[["Level 1", "5%"], ["Level 2", "1%"], ["Levels 3–10", "0.5% ea"]].map(([l, r]) => (
                <div key={l} className="bg-white rounded-xl p-3 text-center border border-border">
                  <p className="text-muted-foreground text-[10px] font-medium">{l}</p>
                  <p className="font-extrabold text-primary mt-1">{r}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <Link href="/nft/pools">
          <div className="group flex items-center justify-between bg-white border border-border hover:border-primary/30 hover:shadow-sm rounded-2xl p-4 transition-all cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Explore NFT Pools</p>
                <p className="text-xs text-muted-foreground">Bid USDT into pools for distribution rewards</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

      </div>
    </div>
  );
}
