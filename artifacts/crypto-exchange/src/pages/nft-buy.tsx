import { useState } from "react";
import { Layout } from "@/components/layout";
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
import { formatUsdt, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { AlertCircle, TrendingUp, Coins, Zap, Info } from "lucide-react";

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card className={`rounded-none ${accent ? "border-primary/50 bg-primary/5" : "border-border"}`}>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className={`text-xl font-mono font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
        {sub && <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function NftBuy() {
  const { data: global, isLoading: globalLoading } = useGetNftGlobal();
  const { data: holdings, isLoading: holdingsLoading } = useGetNftHoldings();
  const { data: user } = useGetMe();
  const buyMutation = useBuyNftTokens();

  const [amount, setAmount] = useState("");

  const parsedAmount = parseFloat(amount) || 0;
  const buyPrice = parseFloat(global?.buyPrice ?? "1");
  const walletBalance = parseFloat(user?.walletBalance ?? "0");
  const investedUsdt = parseFloat((user as any)?.investedUsdt ?? "0");

  const estimatedTokens = parsedAmount > 0 ? (parsedAmount * 0.88) / buyPrice : 0;

  const validationError = (() => {
    if (!parsedAmount) return null;
    if (parsedAmount % 10 !== 0) return "Amount must be a multiple of $10";
    if (parsedAmount > 1000) return "Maximum $1,000 per transaction";
    if (parsedAmount > walletBalance) return "Insufficient wallet balance";
    const lifetimePurchased = parseFloat(holdings?.lifetimePurchased ?? "0");
    if (lifetimePurchased + parsedAmount > 10000)
      return `Lifetime cap is $10,000. You've used $${lifetimePurchased.toFixed(2)}`;
    return null;
  })();

  const handleBuy = () => {
    if (!parsedAmount || validationError) return;
    buyMutation.mutate(
      { data: { amount: parsedAmount } },
      {
        onSuccess: (res) => {
          toast.success(res.message || "V2 tokens purchased successfully!");
          setAmount("");
        },
        onError: (err: any) =>
          toast.error(err.message || "Purchase failed"),
      }
    );
  };

  const isLoading = globalLoading || holdingsLoading;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-mono font-bold uppercase tracking-wider">V2 Token Purchase</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Buy V2 tokens that appreciate as more users invest
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-none" />
            ))}
          </div>
        ) : global ? (
          <>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <StatCard
                label="Buy Price"
                value={`$${parseFloat(global.buyPrice).toFixed(6)}`}
                sub="USDT per token"
                accent
              />
              <StatCard
                label="Sell Price"
                value={`$${parseFloat(global.sellPrice).toFixed(6)}`}
                sub="Claim rate"
              />
              <StatCard
                label="Total Liquidity"
                value={`$${formatUsdt(global.liquidity)}`}
                sub="USDT in pool"
              />
              <StatCard
                label="Your Lifetime Invested"
                value={`$${formatUsdt(holdings?.lifetimePurchased ?? "0")}`}
                sub="Cap: $10,000"
              />
            </div>

            {!global.canInvest && (
              <Alert className="rounded-none border-amber-300 bg-amber-50 text-amber-900">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="font-mono text-xs font-bold uppercase">
                  Purchases Temporarily Disabled
                </AlertTitle>
                <AlertDescription className="font-mono text-xs mt-1">
                  V2 token purchases are currently paused by the admin. Check back soon.
                </AlertDescription>
              </Alert>
            )}

            {investedUsdt <= 0 && (
              <Alert className="rounded-none border-amber-300 bg-amber-50 text-amber-900">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="font-mono text-xs font-bold uppercase">
                  Account Not Yet Activated
                </AlertTitle>
                <AlertDescription className="font-mono text-xs mt-1">
                  Make a deposit to automatically activate your investment account, or contact support.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {/* Purchase form */}
              <Card className="rounded-none border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" />
                    Purchase Tokens
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex justify-between">
                      <span>Amount (USDT)</span>
                      <span>Balance: {formatUsdt(user?.walletBalance)} USDT</span>
                    </label>
                    <Input
                      type="number"
                      step="10"
                      min="10"
                      max="1000"
                      placeholder="10, 20, 50, 100…"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="font-mono rounded-none text-sm"
                      disabled={!global.canInvest || investedUsdt <= 0}
                    />
                    {validationError && (
                      <p className="text-destructive font-mono text-xs">{validationError}</p>
                    )}
                  </div>

                  {/* Quick-select amounts */}
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 50, 100, 500].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAmount(String(v))}
                        disabled={!global.canInvest || investedUsdt <= 0}
                        className="border border-border bg-muted/20 hover:bg-muted/40 font-mono text-xs py-1.5 transition-colors disabled:opacity-40"
                      >
                        ${v}
                      </button>
                    ))}
                  </div>

                  {parsedAmount > 0 && !validationError && (
                    <div className="bg-muted/10 p-3 border border-border space-y-1.5">
                      <div className="flex justify-between font-mono text-xs">
                        <span className="text-muted-foreground">USDT to spend</span>
                        <span className="font-bold">${formatUsdt(parsedAmount)}</span>
                      </div>
                      <div className="flex justify-between font-mono text-xs">
                        <span className="text-muted-foreground">Distribution rate</span>
                        <span>88%</span>
                      </div>
                      <div className="border-t border-border pt-1.5 flex justify-between font-mono text-xs font-bold text-primary">
                        <span>Estimated tokens</span>
                        <span>≈ {estimatedTokens.toFixed(6)} TBT</span>
                      </div>
                      <div className="flex justify-between font-mono text-xs text-green-600">
                        <span>Token value at sell price</span>
                        <span>
                          ≈ ${(estimatedTokens * parseFloat(global.sellPrice)).toFixed(4)}
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full rounded-none font-mono uppercase tracking-wider"
                    onClick={handleBuy}
                    disabled={
                      !parsedAmount ||
                      !!validationError ||
                      !global.canInvest ||
                      investedUsdt <= 0 ||
                      buyMutation.isPending
                    }
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {buyMutation.isPending ? "Processing…" : "Buy V2 Tokens"}
                  </Button>
                </CardContent>
              </Card>

              {/* Info card */}
              <Card className="rounded-none border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    How It Works
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 font-mono text-xs text-muted-foreground">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
                      <p>Invest multiples of <strong className="text-foreground">$10</strong> USDT, up to <strong className="text-foreground">$1,000</strong> per transaction and <strong className="text-foreground">$10,000</strong> lifetime.</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
                      <p>You receive <strong className="text-foreground">V2 tokens</strong> at the current buy price. <strong className="text-foreground">88%</strong> of your investment is distributed to you.</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
                      <p>The <strong className="text-foreground">buy price rises</strong> with each new investment — early investors benefit most.</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</div>
                      <p>Your <strong className="text-foreground">upline sponsors</strong> (up to 10 levels) also earn token bonuses when you invest.</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">5</div>
                      <p>Claim your tokens at the <strong className="text-foreground">sell price</strong> (90% of buy price) from the Holdings page.</p>
                    </div>
                  </div>

                  <div className="border-t border-border pt-3 space-y-1">
                    <div className="flex justify-between">
                      <span>Referral income</span>
                      <span className="text-foreground font-bold">Up to 10 levels</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Level 1 rate</span>
                      <span className="text-foreground font-bold">5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Level 2 rate</span>
                      <span className="text-foreground font-bold">1%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Levels 3–10 rate</span>
                      <span className="text-foreground font-bold">0.5% each</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Alert className="rounded-none border-border">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-mono uppercase text-xs font-bold">Not Available</AlertTitle>
            <AlertDescription className="font-mono text-xs mt-1">
              The NFT token system has not been initialized yet. Contact the admin.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Layout>
  );
}
