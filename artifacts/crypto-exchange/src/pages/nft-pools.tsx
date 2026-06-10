import { useState } from "react";
import { Layout } from "@/components/layout";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatUsdt } from "@/lib/format";
import { toast } from "sonner";
import { AlertCircle, Layers, TrendingUp, Lock } from "lucide-react";

type NftPoolWithNft = {
  id: string;
  nftId: string;
  level: number;
  poolSize: string;
  poolLimit: string;
  poolAmount: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  nft: { id: string; title: string; image: string; price: string; status: string };
};

function PoolCard({
  pool,
  onBid,
}: {
  pool: NftPoolWithNft;
  onBid: (pool: NftPoolWithNft) => void;
}) {
  const poolSize = parseFloat(pool.poolSize);
  const poolAmount = parseFloat(pool.poolAmount);
  const poolLimit = parseFloat(pool.poolLimit);
  const pct = poolSize > 0 ? (poolAmount / poolSize) * 100 : 0;
  const isFull = poolLimit <= 0;

  return (
    <Card className="rounded-none border-border hover:border-primary/40 transition-colors">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              {pool.nft.title}
            </p>
            <p className="font-mono font-bold text-sm mt-0.5">
              Level {pool.level} Pool
            </p>
          </div>
          <Badge
            variant="outline"
            className={`rounded-none font-mono text-[10px] uppercase shrink-0 ${
              isFull
                ? "border-destructive/40 text-destructive"
                : "border-green-400 text-green-700 bg-green-50"
            }`}
          >
            {isFull ? "Full" : "Active"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>Filled</span>
            <span>{pct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-muted/30 border border-border w-full">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div>
            <p className="text-muted-foreground uppercase text-[10px]">Pool Size</p>
            <p className="font-bold">${formatUsdt(pool.poolSize)}</p>
          </div>
          <div>
            <p className="text-muted-foreground uppercase text-[10px]">Remaining</p>
            <p className={`font-bold ${isFull ? "text-destructive" : "text-green-600"}`}>
              ${formatUsdt(pool.poolLimit)}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          className="w-full rounded-none font-mono uppercase tracking-wider"
          variant={isFull ? "outline" : "default"}
          disabled={isFull}
          onClick={() => !isFull && onBid(pool)}
        >
          {isFull ? (
            <>
              <Lock className="h-3.5 w-3.5 mr-1.5" />
              Pool Full
            </>
          ) : (
            <>
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              Bid in Pool
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function BidDialog({
  pool,
  open,
  onClose,
}: {
  pool: NftPoolWithNft | null;
  open: boolean;
  onClose: () => void;
}) {
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
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0)
      return "Amount must be a positive whole number";
    if (parsedAmount > poolLimit) return `Amount exceeds remaining pool capacity ($${formatUsdt(poolLimit)})`;
    if (parsedAmount > parseFloat(user?.walletBalance ?? "0"))
      return "Insufficient wallet balance";
    if (nftHoldingUsdt < 4)
      return `Minimum $4 NFT holding required (yours: $${nftHoldingUsdt.toFixed(4)})`;
    return null;
  })();

  const handleBid = () => {
    if (!parsedAmount || validationError) return;
    bidMutation.mutate(
      { poolId: pool.id, data: { amount: parsedAmount } },
      {
        onSuccess: (res) => {
          toast.success(res.message || "Bid placed successfully!");
          setAmount("");
          onClose();
        },
        onError: (err: any) => toast.error(err.message || "Bid failed"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-none p-0 gap-0 border-border">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="font-mono uppercase tracking-wider text-base">
            Bid — {pool.nft.title} Level {pool.level}
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="bg-muted/10 border border-border p-2.5">
              <p className="text-muted-foreground uppercase text-[10px] mb-0.5">Your NFT Holding</p>
              <p className="font-bold">${nftHoldingUsdt.toFixed(4)}</p>
            </div>
            <div className="bg-muted/10 border border-border p-2.5">
              <p className="text-muted-foreground uppercase text-[10px] mb-0.5">Daily Bid Limit</p>
              <p className="font-bold">${lifetimeInvested.toFixed(2)}</p>
            </div>
            <div className="bg-muted/10 border border-border p-2.5">
              <p className="text-muted-foreground uppercase text-[10px] mb-0.5">Remaining in Pool</p>
              <p className="font-bold text-green-600">${formatUsdt(pool.poolLimit)}</p>
            </div>
            <div className="bg-muted/10 border border-border p-2.5">
              <p className="text-muted-foreground uppercase text-[10px] mb-0.5">Max per Pool (50%)</p>
              <p className="font-bold">${formatUsdt(String(poolSize * 0.5))}</p>
            </div>
          </div>

          {nftHoldingUsdt < 4 && (
            <Alert className="rounded-none border-amber-300 bg-amber-50 text-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="font-mono text-xs font-bold uppercase">
                NFT Holding Too Low
              </AlertTitle>
              <AlertDescription className="font-mono text-xs mt-1">
                You need at least $4 in NFT holdings to bid. Purchase V2 tokens first.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <label className="font-mono text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex justify-between">
              <span>Bid Amount (USDT, whole number)</span>
              <span>Balance: {formatUsdt(user?.walletBalance)} USDT</span>
            </label>
            <Input
              type="number"
              step="1"
              min="1"
              placeholder="e.g. 10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono rounded-none text-sm"
            />
            {validationError && (
              <p className="text-destructive font-mono text-xs">{validationError}</p>
            )}
          </div>

          <div className="text-[10px] font-mono text-muted-foreground space-y-0.5 border-t border-border pt-3">
            <p>• You cannot bid in the same pool within 24 hours</p>
            <p>• Your total bid in one pool cannot exceed 50% of pool size</p>
            <p>• Daily bids limited to 4× your NFT holding value</p>
          </div>

          <Button
            className="w-full rounded-none font-mono uppercase tracking-wider"
            onClick={handleBid}
            disabled={!parsedAmount || !!validationError || bidMutation.isPending}
          >
            {bidMutation.isPending ? "Placing Bid…" : "Place Bid"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function NftPools() {
  const { data: pools, isLoading } = useListNftPools();
  const [selectedPool, setSelectedPool] = useState<NftPoolWithNft | null>(null);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-mono font-bold uppercase tracking-wider">NFT Pool Bidding</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Bid USDT into NFT pools to earn distribution rewards
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-none" />
            ))}
          </div>
        ) : pools && pools.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {(pools as NftPoolWithNft[]).map((pool) => (
              <PoolCard key={pool.id} pool={pool} onBid={setSelectedPool} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center border border-border">
            <Layers className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-mono text-sm uppercase text-muted-foreground">No active pools available</p>
            <p className="font-mono text-xs text-muted-foreground/60 mt-1">
              Check back soon — admins create new pools regularly
            </p>
          </div>
        )}

        <BidDialog
          pool={selectedPool}
          open={!!selectedPool}
          onClose={() => setSelectedPool(null)}
        />
      </div>
    </Layout>
  );
}
