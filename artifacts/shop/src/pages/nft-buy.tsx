import { useState } from "react";
import {
  useGetNftGlobal,
  useGetNftHoldings,
  useBuyNftTokens,
  useGetMe,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { fmtUsdt } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  AlertCircle, Zap, Coins, TrendingUp, Info, ArrowLeft,
  ChevronRight, Shield, Users, BarChart3, Wallet,
} from "lucide-react";

const QUICK = [10, 50, 100, 500];

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-primary/40 bg-primary/5" : "border-border bg-white"}`}>
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-bold ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

export default function NftBuyPage() {
  const { data: global, isLoading: globalLoading } = useGetNftGlobal();
  const { data: holdings, isLoading: holdingsLoading } = useGetNftHoldings();
  const { data: user } = useGetMe();
  const buyMutation = useBuyNftTokens();
  const [amount, setAmount] = useState("");

  const parsedAmount = parseFloat(amount) || 0;
  const buyPrice = parseFloat(global?.buyPrice ?? "1");
  const walletBalance = parseFloat(user?.walletBalance ?? "0");
  const investedUsdt = parseFloat((user as any)?.investedUsdt ?? "0");
  const lifetimePurchased = parseFloat(holdings?.lifetimePurchased ?? "0");
  const estimatedTokens = parsedAmount > 0 ? (parsedAmount * 0.88) / buyPrice : 0;

  const validationError = (() => {
    if (!parsedAmount) return null;
    if (parsedAmount % 10 !== 0) return "Amount must be a multiple of $10";
    if (parsedAmount > 1000) return "Maximum $1,000 per transaction";
    if (parsedAmount > walletBalance) return "Insufficient wallet balance";
    if (lifetimePurchased + parsedAmount > 10000)
      return `Lifetime cap is $10,000. Used: $${lifetimePurchased.toFixed(2)}`;
    return null;
  })();

  const handleBuy = () => {
    if (!parsedAmount || validationError) return;
    buyMutation.mutate(
      { data: { amount: parsedAmount } },
      {
        onSuccess: (res) => { toast.success(res.message || "V2 tokens purchased!"); setAmount(""); },
        onError: (err: any) => toast.error(err.message || "Purchase failed"),
      }
    );
  };

  const isLoading = globalLoading || holdingsLoading;
  const disabled = !global?.canInvest || investedUsdt <= 0;
  const capPct = Math.min(100, (lifetimePurchased / 10000) * 100);

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 rounded-full bg-muted/60 hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold leading-tight">Buy V2 Tokens</h1>
          <p className="text-sm text-muted-foreground">Invest USDT, earn appreciating TBT tokens</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : global ? (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <StatPill label="Buy Price" value={`$${parseFloat(global.buyPrice).toFixed(6)}`} accent />
            <StatPill label="Sell Price" value={`$${parseFloat(global.sellPrice).toFixed(6)}`} />
            <StatPill label="Total Liquidity" value={`$${fmtUsdt(global.liquidity)}`} />
            <StatPill label="Platform Volume" value={`$${fmtUsdt(global.totalPurchase)}`} />
          </div>

          {/* Lifetime cap progress */}
          <Card className="border-border rounded-2xl">
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Lifetime Cap</span>
                <span className="text-sm font-bold text-primary">${fmtUsdt(lifetimePurchased)} / $10,000</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${capPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">{capPct.toFixed(1)}% used · ${fmtUsdt(String(10000 - lifetimePurchased))} remaining</p>
            </CardContent>
          </Card>

          {/* Warnings */}
          {!global.canInvest && (
            <Alert className="rounded-2xl border-amber-300 bg-amber-50 text-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-sm font-semibold">Purchases Paused</AlertTitle>
              <AlertDescription className="text-xs mt-0.5">V2 token purchases are temporarily disabled by admin.</AlertDescription>
            </Alert>
          )}
          {investedUsdt <= 0 && (
            <Alert className="rounded-2xl border-amber-300 bg-amber-50 text-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-sm font-semibold">Account Not Activated</AlertTitle>
              <AlertDescription className="text-xs mt-0.5">Make a deposit first to activate your investment account.</AlertDescription>
            </Alert>
          )}

          {/* Purchase card */}
          <Card className="border-primary/30 rounded-2xl shadow-sm">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                Purchase Tokens
                <Badge variant="secondary" className="ml-auto text-[10px] rounded-full px-2">
                  Balance: {fmtUsdt(user?.walletBalance)} USDT
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              {/* Quick amounts */}
              <div className="grid grid-cols-4 gap-2">
                {QUICK.map(v => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    disabled={disabled}
                    className={`rounded-xl border py-2.5 text-sm font-semibold transition-all disabled:opacity-40 ${
                      parsedAmount === v
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary/60"
                    }`}
                  >
                    ${v}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                  Custom Amount (USDT, multiples of $10)
                </label>
                <Input
                  type="number"
                  step="10"
                  min="10"
                  max="1000"
                  placeholder="e.g. 250"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="mt-1.5 rounded-xl h-11"
                  disabled={disabled}
                />
                {validationError && <p className="text-destructive text-xs mt-1.5">{validationError}</p>}
              </div>

              {/* Estimate */}
              {parsedAmount > 0 && !validationError && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">You spend</span>
                    <span className="font-semibold">${fmtUsdt(parsedAmount)} USDT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Distribution rate</span>
                    <span className="font-semibold">88%</span>
                  </div>
                  <div className="border-t border-primary/20 pt-2 flex justify-between text-sm font-bold text-primary">
                    <span>You receive ≈</span>
                    <span>{estimatedTokens.toFixed(4)} TBT</span>
                  </div>
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Value at sell price</span>
                    <span>≈ ${(estimatedTokens * parseFloat(global.sellPrice)).toFixed(4)}</span>
                  </div>
                </div>
              )}

              <Button
                className="w-full h-12 rounded-xl text-sm font-semibold gap-2"
                onClick={handleBuy}
                disabled={!parsedAmount || !!validationError || disabled || buyMutation.isPending}
              >
                <Zap className="h-4 w-4" />
                {buyMutation.isPending ? "Processing…" : "Buy V2 Tokens"}
              </Button>
            </CardContent>
          </Card>

          {/* How it works */}
          <Card className="rounded-2xl border-border">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              {[
                { icon: Wallet, title: "Invest multiples of $10", desc: "Up to $1,000 per transaction, $10,000 lifetime cap." },
                { icon: Coins, title: "Receive TBT tokens at buy price", desc: "88% of your investment is distributed as tokens at the current rate." },
                { icon: TrendingUp, title: "Price rises with adoption", desc: "The buy price increases with each new investment — early investors earn more." },
                { icon: Users, title: "Earn from your network", desc: "Upline sponsors up to 10 levels earn token bonuses when you invest." },
                { icon: BarChart3, title: "Claim at sell price", desc: "Redeem your tokens from the Holdings page at 90% of buy price." },
              ].map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <step.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}

              <div className="bg-muted/40 rounded-xl p-4 mt-2">
                <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Referral Rates</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[["Level 1", "5%"], ["Level 2", "1%"], ["Levels 3–10", "0.5% each"]].map(([l, r]) => (
                    <div key={l} className="bg-white rounded-lg p-2 text-center border border-border">
                      <p className="text-muted-foreground">{l}</p>
                      <p className="font-bold text-primary mt-0.5">{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA to pools */}
          <Link href="/nft/pools">
            <Card className="rounded-2xl border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Explore NFT Pools</p>
                    <p className="text-xs text-muted-foreground">Bid USDT into pools for distribution rewards</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </>
      ) : (
        <Alert className="rounded-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not Initialized</AlertTitle>
          <AlertDescription className="text-xs">The token system has not been set up yet. Contact the admin.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
