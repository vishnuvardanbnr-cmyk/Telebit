import { useState } from "react";
import {
  useListNftPools,
  useGetNftGlobal,
  useGetNftHoldings,
  useBidNftPool,
  useGetMe,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { fmtUsdt } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  AlertCircle, ArrowLeft, Layers, TrendingUp, Lock,
  ChevronRight, Coins, Info, CheckCircle2,
} from "lucide-react";

type NftPoolWithNft = {
  id: string; nftId: string; level: number;
  poolSize: string; poolLimit: string; poolAmount: string;
  status: string; createdAt: string; updatedAt: string;
  nft: { id: string; title: string; image: string; price: string; status: string };
};

function PoolCard({ pool, onBid }: { pool: NftPoolWithNft; onBid: (p: NftPoolWithNft) => void }) {
  const poolSize = parseFloat(pool.poolSize);
  const poolAmount = parseFloat(pool.poolAmount);
  const poolLimit = parseFloat(pool.poolLimit);
  const pct = poolSize > 0 ? (poolAmount / poolSize) * 100 : 0;
  const isFull = poolLimit <= 0;

  return (
    <Card className={`rounded-2xl transition-all ${isFull ? "border-border opacity-70" : "border-primary/30 shadow-sm hover:shadow-md hover:border-primary/50"}`}>
      <CardContent className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{pool.nft.title}</p>
            <p className="font-bold text-base mt-0.5">Level {pool.level} Pool</p>
          </div>
          <Badge
            className={`rounded-full text-[10px] px-2.5 font-semibold ${
              isFull ? "bg-muted text-muted-foreground" : "bg-green-100 text-green-700"
            }`}
            variant="secondary"
          >
            {isFull ? "Full" : "Open"}
          </Badge>
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Pool filled</span>
            <span className="font-semibold">{pct.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isFull ? "bg-muted-foreground" : "bg-primary"}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Pool Size</p>
            <p className="font-bold text-sm mt-0.5">${fmtUsdt(pool.poolSize)}</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Remaining</p>
            <p className={`font-bold text-sm mt-0.5 ${isFull ? "text-muted-foreground" : "text-green-600"}`}>
              ${fmtUsdt(pool.poolLimit)}
            </p>
          </div>
        </div>

        <Button
          className={`w-full h-11 rounded-xl text-sm font-semibold gap-2 ${isFull ? "" : ""}`}
          variant={isFull ? "outline" : "default"}
          disabled={isFull}
          onClick={() => !isFull && onBid(pool)}
        >
          {isFull ? (
            <><Lock className="h-4 w-4" /> Pool Full</>
          ) : (
            <><TrendingUp className="h-4 w-4" /> Bid in Pool</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function BidDialog({ pool, open, onClose }: { pool: NftPoolWithNft | null; open: boolean; onClose: () => void }) {
  const { data: global } = useGetNftGlobal();
  const { data: holdings } = useGetNftHoldings();
  const { data: user } = useGetMe();
  const bidMutation = useBidNftPool();
  const [amount, setAmount] = useState("");

  if (!pool) return null;

  const parsedAmount = parseFloat(amount) || 0;
  const poolTokens = parseFloat(holdings?.poolRewardAvailable ?? "0");
  const buyPrice = parseFloat(global?.buyPrice ?? "1");
  const nftHoldingUsdt = poolTokens * buyPrice;
  const lifetimeInvested = nftHoldingUsdt * 4;
  const poolSize = parseFloat(pool.poolSize);
  const poolLimit = parseFloat(pool.poolLimit);

  const validationError = (() => {
    if (!parsedAmount) return null;
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) return "Amount must be a positive whole number";
    if (parsedAmount > poolLimit) return `Exceeds pool capacity ($${fmtUsdt(poolLimit)})`;
    if (parsedAmount > parseFloat(user?.walletBalance ?? "0")) return "Insufficient wallet balance";
    if (nftHoldingUsdt < 4) return `Min $4 NFT holding required (yours: $${nftHoldingUsdt.toFixed(4)})`;
    return null;
  })();

  const handleBid = () => {
    if (!parsedAmount || validationError) return;
    bidMutation.mutate(
      { poolId: pool.id, data: { amount: parsedAmount } },
      {
        onSuccess: (res) => { toast.success(res.message || "Bid placed!"); setAmount(""); onClose(); },
        onError: (err: any) => toast.error(err.message || "Bid failed"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl p-0 gap-0 border-0 shadow-2xl overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 bg-primary/5 border-b border-border">
          <DialogTitle className="text-base font-bold">
            Bid — {pool.nft.title} Level {pool.level}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Whole numbers only · 24h cooldown per pool</p>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Your NFT Holding", val: `$${nftHoldingUsdt.toFixed(4)}`, highlight: false },
              { label: "Daily Bid Limit", val: `$${lifetimeInvested.toFixed(2)}`, highlight: false },
              { label: "Remaining in Pool", val: `$${fmtUsdt(pool.poolLimit)}`, highlight: true },
              { label: "Max per Pool (50%)", val: `$${fmtUsdt(String(poolSize * 0.5))}`, highlight: false },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-3 ${s.highlight ? "bg-green-50 border border-green-200" : "bg-muted/40"}`}>
                <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
                <p className={`font-bold text-sm mt-0.5 ${s.highlight ? "text-green-700" : ""}`}>{s.val}</p>
              </div>
            ))}
          </div>

          {nftHoldingUsdt < 4 && (
            <Alert className="rounded-xl border-amber-300 bg-amber-50 text-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-xs font-bold">NFT Holding Too Low</AlertTitle>
              <AlertDescription className="text-xs mt-0.5">
                Buy V2 tokens first to unlock pool bidding.{" "}
                <Link href="/nft/buy" className="underline font-medium">Buy now →</Link>
              </AlertDescription>
            </Alert>
          )}

          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex justify-between">
              <span>Bid Amount (USDT)</span>
              <span>Balance: {fmtUsdt(user?.walletBalance)}</span>
            </label>
            <Input
              type="number"
              step="1"
              min="1"
              placeholder="Whole number (e.g. 10)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="mt-1.5 rounded-xl h-11"
            />
            {validationError && <p className="text-destructive text-xs mt-1.5">{validationError}</p>}
          </div>

          <div className="space-y-1 text-[11px] text-muted-foreground bg-muted/30 rounded-xl p-3">
            <p>• Cannot bid in same pool within 24 hours</p>
            <p>• Total bid per pool cannot exceed 50% of pool size</p>
            <p>• Daily bids limited to 4× your NFT holding value</p>
          </div>

          <Button
            className="w-full h-12 rounded-xl text-sm font-semibold gap-2"
            onClick={handleBid}
            disabled={!parsedAmount || !!validationError || bidMutation.isPending}
          >
            <TrendingUp className="h-4 w-4" />
            {bidMutation.isPending ? "Placing Bid…" : "Place Bid"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function NftPoolsPage() {
  const { data: pools, isLoading } = useListNftPools();
  const [selectedPool, setSelectedPool] = useState<NftPoolWithNft | null>(null);

  const activePools = (pools as NftPoolWithNft[] | undefined)?.filter(p => p.status === "active") ?? [];
  const fullPools = (pools as NftPoolWithNft[] | undefined)?.filter(p => p.status !== "active") ?? [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 rounded-full bg-muted/60 hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold leading-tight">NFT Pool Bidding</h1>
          <p className="text-sm text-muted-foreground">Bid USDT into pools and earn distribution rewards</p>
        </div>
      </div>

      {/* How it works */}
      <Card className="rounded-2xl border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-primary">How Pool Bidding Works</p>
          </div>
          <div className="space-y-2">
            {[
              "Bid whole-number USDT amounts into active pools",
              "Your total bid per pool cannot exceed 50% of pool size",
              "Daily bidding limit = 4× your current NFT holding value",
              "Rewards are distributed as pool fills up and completes",
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                {s}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      ) : activePools.length > 0 ? (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{activePools.length} Active Pool{activePools.length !== 1 ? "s" : ""}</p>
          {activePools.map(pool => (
            <PoolCard key={pool.id} pool={pool} onBid={setSelectedPool} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl">
          <Layers className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50" />
          <p className="font-semibold text-muted-foreground">No active pools right now</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Admins create new pools regularly — check back soon</p>
        </div>
      )}

      {/* Full pools */}
      {fullPools.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Closed Pools</p>
          {fullPools.map(pool => (
            <PoolCard key={pool.id} pool={pool} onBid={() => {}} />
          ))}
        </div>
      )}

      {/* CTA to buy tokens */}
      <Link href="/nft/buy">
        <Card className="rounded-2xl border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Don't have V2 Tokens yet?</p>
                <p className="text-xs text-muted-foreground">You need tokens to unlock pool bidding</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      <BidDialog pool={selectedPool} open={!!selectedPool} onClose={() => setSelectedPool(null)} />
    </div>
  );
}
