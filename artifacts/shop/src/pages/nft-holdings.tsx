import { useState } from "react";
import {
  useGetNftHoldings,
  useGetNftGlobal,
  useClaimNftHoldings,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { fmtUsdt } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  ArrowLeft, Coins, TrendingUp, Wallet, BarChart3,
  Trophy, RefreshCw, Info,
} from "lucide-react";

type ClaimBucket = "pool" | "referral" | "level" | "all";

function StatCard({ label, value, sub, accent, icon: Icon }: {
  label: string; value: string; sub?: string; accent?: boolean; icon: any;
}) {
  return (
    <Card className={`rounded-2xl ${accent ? "border-primary/40 bg-primary/5" : "border-border"}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className={`text-xl font-bold mt-1 ${accent ? "text-primary" : ""}`}>{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent ? "bg-primary/10" : "bg-muted/60"}`}>
            <Icon style={{ width: 18, height: 18 }} className={accent ? "text-primary" : "text-muted-foreground"} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClaimDialog({
  open, onClose, bucket, available, sellPrice,
}: {
  open: boolean; onClose: () => void;
  bucket: ClaimBucket | null; available: string; sellPrice: string;
}) {
  const claimMutation = useClaimNftHoldings();

  const label = bucket === "pool" ? "Pool Reward" : bucket === "referral" ? "Referral Reward" : bucket === "level" ? "Level Reward" : "All Rewards";
  const tokens = parseFloat(available);
  const usdtValue = tokens * parseFloat(sellPrice);

  const handleClaim = () => {
    if (!bucket) return;
    const type = bucket === "all" ? "pool" : bucket; // "all" triggers a sweep; use pool as default for now
    claimMutation.mutate(
      { data: { type } },
      {
        onSuccess: (res) => { toast.success((res as any).message || "Claimed successfully!"); onClose(); },
        onError: (err: any) => toast.error(err.message || "Claim failed"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl border-0 shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 bg-primary/5 border-b border-border">
          <DialogTitle className="text-base font-bold">Claim {label}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Tokens are credited to your wallet at the sell price</p>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground font-medium">Tokens</p>
              <p className="font-bold mt-0.5">{tokens.toFixed(4)} TBT</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground font-medium">USDT Received</p>
              <p className="font-bold text-green-700 mt-0.5">${usdtValue.toFixed(4)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
            Sell price: <span className="font-semibold text-foreground">${parseFloat(sellPrice).toFixed(6)}</span> per TBT
          </p>
        </div>
        <DialogFooter className="px-6 pb-6 gap-2 flex-row">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl h-11">Cancel</Button>
          <Button
            onClick={handleClaim}
            disabled={claimMutation.isPending || tokens <= 0}
            className="flex-1 rounded-xl h-11 gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${claimMutation.isPending ? "animate-spin" : ""}`} />
            {claimMutation.isPending ? "Claiming…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function NftHoldingsPage() {
  const { data: holdings, isLoading: holdingsLoading } = useGetNftHoldings();
  const { data: global, isLoading: globalLoading } = useGetNftGlobal();
  const [claimBucket, setClaimBucket] = useState<ClaimBucket | null>(null);

  const isLoading = holdingsLoading || globalLoading;
  const buyPrice = parseFloat(global?.buyPrice ?? "1");
  const sellPrice = parseFloat(global?.sellPrice ?? "0.9");

  const poolReward = parseFloat(holdings?.poolRewardAvailable ?? "0");
  const referralReward = parseFloat(holdings?.referralRewardAvailable ?? "0");
  const levelReward = parseFloat(holdings?.levelRewardAvailable ?? "0");
  const totalTokens = poolReward + referralReward + levelReward;
  const totalValue = totalTokens * sellPrice;
  const lifetimePurchased = parseFloat(holdings?.lifetimePurchased ?? "0");
  const capPct = Math.min(100, (lifetimePurchased / 10000) * 100);

  const claimableTokens =
    claimBucket === "pool" ? String(poolReward) :
    claimBucket === "referral" ? String(referralReward) :
    claimBucket === "level" ? String(levelReward) :
    String(totalTokens);

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 rounded-full bg-muted/60 hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold leading-tight">Token Holdings</h1>
          <p className="text-sm text-muted-foreground">Your TBT balance and claimable rewards</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Tokens" value={`${totalTokens.toFixed(4)} TBT`} sub={`≈ $${totalValue.toFixed(4)}`} accent icon={Coins} />
            <StatCard label="Token Value" value={`$${totalValue.toFixed(4)}`} sub="at sell price" icon={Wallet} />
            <StatCard label="Buy Price" value={`$${buyPrice.toFixed(6)}`} sub="per TBT" icon={TrendingUp} />
            <StatCard label="Sell Price" value={`$${sellPrice.toFixed(6)}`} sub="claim rate" icon={BarChart3} />
          </div>

          {/* Lifetime cap */}
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Lifetime Investment Cap</span>
                <span className="text-sm font-bold text-primary">${fmtUsdt(lifetimePurchased)} / $10,000</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${capPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">{capPct.toFixed(1)}% used</p>
            </CardContent>
          </Card>

          {/* Reward buckets */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Claimable Rewards</p>

            {/* Pool reward */}
            <Card className={`rounded-2xl transition-all ${poolReward > 0 ? "border-primary/30 shadow-sm" : "border-border opacity-60"}`}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Pool Reward</p>
                    <p className="text-xs text-muted-foreground">{poolReward.toFixed(4)} TBT · ≈ ${(poolReward * sellPrice).toFixed(4)}</p>
                  </div>
                </div>
                <Button size="sm" className="rounded-xl h-9 text-xs" disabled={poolReward <= 0} onClick={() => setClaimBucket("pool")}>
                  Claim
                </Button>
              </CardContent>
            </Card>

            {/* Referral reward */}
            <Card className={`rounded-2xl transition-all ${referralReward > 0 ? "border-orange-200 shadow-sm" : "border-border opacity-60"}`}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Referral Reward</p>
                    <p className="text-xs text-muted-foreground">{referralReward.toFixed(4)} TBT · ≈ ${(referralReward * sellPrice).toFixed(4)}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="rounded-xl h-9 text-xs" disabled={referralReward <= 0} onClick={() => setClaimBucket("referral")}>
                  Claim
                </Button>
              </CardContent>
            </Card>

            {/* Level reward */}
            <Card className={`rounded-2xl transition-all ${levelReward > 0 ? "border-purple-200 shadow-sm" : "border-border opacity-60"}`}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Coins className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Level Reward</p>
                    <p className="text-xs text-muted-foreground">{levelReward.toFixed(4)} TBT · ≈ ${(levelReward * sellPrice).toFixed(4)}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="rounded-xl h-9 text-xs border-purple-300 text-purple-700 hover:bg-purple-50" disabled={levelReward <= 0} onClick={() => setClaimBucket("level")}>
                  Claim
                </Button>
              </CardContent>
            </Card>

            {totalTokens <= 0 ? (
              <Alert className="rounded-2xl">
                <Info className="h-4 w-4" />
                <AlertTitle className="text-sm">No tokens yet</AlertTitle>
                <AlertDescription className="text-xs">Purchase V2 tokens or bid in pools to start earning rewards.</AlertDescription>
              </Alert>
            ) : (
              <Button
                className="w-full h-12 rounded-xl text-sm font-semibold gap-2"
                variant="outline"
                onClick={() => setClaimBucket("all")}
              >
                <RefreshCw className="h-4 w-4" />
                Claim All — {totalTokens.toFixed(4)} TBT (≈ ${totalValue.toFixed(4)})
              </Button>
            )}
          </div>

          {/* Navigation CTAs */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/nft/buy">
              <Card className="rounded-2xl border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <Coins className="h-6 w-6 text-primary" />
                  <p className="font-semibold text-sm">Buy More Tokens</p>
                  <p className="text-[11px] text-muted-foreground">Invest more USDT</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/nft/pools">
              <Card className="rounded-2xl border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <Trophy className="h-6 w-6 text-orange-500" />
                  <p className="font-semibold text-sm">Browse Pools</p>
                  <p className="text-[11px] text-muted-foreground">Bid for more rewards</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </>
      )}

      <ClaimDialog
        open={!!claimBucket}
        onClose={() => setClaimBucket(null)}
        bucket={claimBucket}
        available={claimableTokens}
        sellPrice={global?.sellPrice ?? "0.9"}
      />
    </div>
  );
}
