import { Layout } from "@/components/layout";
import {
  useGetNftHoldings,
  useGetNftGlobal,
  useClaimNftHoldings,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatUsdt } from "@/lib/format";
import { toast } from "sonner";
import { AlertCircle, Coins, TrendingUp, Users, Star, ArrowDownToLine } from "lucide-react";
import { Link } from "wouter";

type ClaimType = "pool" | "referral" | "level";

function HoldingBucket({
  label,
  icon: Icon,
  available,
  claimed,
  claimedUsdt,
  sellPrice,
  claimType,
  onClaim,
  isPending,
}: {
  label: string;
  icon: React.ElementType;
  available: string;
  claimed: string;
  claimedUsdt: string;
  sellPrice: number;
  claimType: ClaimType;
  onClaim: (type: ClaimType) => void;
  isPending: boolean;
}) {
  const availableTokens = parseFloat(available);
  const usdtValue = availableTokens * sellPrice;
  const hasBalance = availableTokens > 0.000001;

  return (
    <Card className={`rounded-none ${hasBalance ? "border-primary/40" : "border-border"}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center gap-2">
          <Icon className={`h-4 w-4 ${hasBalance ? "text-primary" : "text-muted-foreground"}`} />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="bg-muted/10 border border-border p-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-mono text-[10px] text-muted-foreground uppercase">Available</p>
              <p className={`font-mono text-xl font-bold mt-0.5 ${hasBalance ? "text-primary" : "text-muted-foreground"}`}>
                {parseFloat(available).toFixed(6)}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">TBT tokens</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] text-muted-foreground uppercase">≈ USDT Value</p>
              <p className={`font-mono text-lg font-bold mt-0.5 ${hasBalance ? "text-green-600" : "text-muted-foreground"}`}>
                ${formatUsdt(String(usdtValue))}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground">
          <div>
            <span className="uppercase">Total Claimed</span>
            <p className="text-foreground font-medium">{parseFloat(claimed).toFixed(6)} TBT</p>
          </div>
          <div>
            <span className="uppercase">Claimed USDT</span>
            <p className="text-foreground font-medium">${formatUsdt(claimedUsdt)}</p>
          </div>
        </div>

        <Button
          size="sm"
          className="w-full rounded-none font-mono uppercase tracking-wider"
          variant={hasBalance ? "default" : "outline"}
          disabled={!hasBalance || isPending}
          onClick={() => onClaim(claimType)}
        >
          <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" />
          {isPending ? "Claiming…" : `Claim $${formatUsdt(String(usdtValue))} USDT`}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function NftHoldings() {
  const { data: holdings, isLoading } = useGetNftHoldings();
  const { data: global } = useGetNftGlobal();
  const claimMutation = useClaimNftHoldings();

  const sellPrice = parseFloat(global?.sellPrice ?? "0.9");
  const buyPrice = parseFloat(global?.buyPrice ?? "1");

  const handleClaim = (type: ClaimType) => {
    claimMutation.mutate(
      { data: { type } },
      {
        onSuccess: (res) => {
          toast.success(res.message || "Tokens claimed successfully!");
        },
        onError: (err: any) => toast.error(err.message || "Claim failed"),
      }
    );
  };

  const totalAvailableUsdt = holdings
    ? (parseFloat(holdings.poolRewardAvailable) +
        parseFloat(holdings.referralRewardAvailable) +
        parseFloat(holdings.levelRewardAvailable)) *
      sellPrice
    : 0;

  const totalTokens = holdings
    ? parseFloat(holdings.poolRewardAvailable) +
      parseFloat(holdings.referralRewardAvailable) +
      parseFloat(holdings.levelRewardAvailable)
    : 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-mono font-bold uppercase tracking-wider">NFT Holdings</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Your V2 token balances — claim them as USDT any time
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-56 w-full rounded-none" />)}
          </div>
        ) : holdings ? (
          <>
            {/* Summary */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Card className="rounded-none col-span-2 border-primary/50 bg-primary/5">
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    Total Claimable Value
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-3xl font-mono font-bold text-primary">
                    ${formatUsdt(String(totalAvailableUsdt))}
                    <span className="text-base text-primary/70 ml-1">USDT</span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">
                    {totalTokens.toFixed(6)} TBT tokens @ ${sellPrice.toFixed(6)}/token
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border">
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    Buy Price
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-lg font-mono font-bold">${buyPrice.toFixed(6)}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">per TBT</p>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border">
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    Lifetime Invested
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-lg font-mono font-bold">${formatUsdt(holdings.lifetimePurchased)}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">of $10,000 cap</p>
                </CardContent>
              </Card>
            </div>

            {/* Three reward buckets */}
            <div className="grid gap-4 md:grid-cols-3">
              <HoldingBucket
                label="Pool Contribution"
                icon={Coins}
                available={holdings.poolRewardAvailable}
                claimed={holdings.poolRewardClaimed}
                claimedUsdt={holdings.poolRewardClaimedUsdt}
                sellPrice={sellPrice}
                claimType="pool"
                onClaim={handleClaim}
                isPending={claimMutation.isPending}
              />
              <HoldingBucket
                label="Referral Income"
                icon={Users}
                available={holdings.referralRewardAvailable}
                claimed={holdings.referralRewardClaimed}
                claimedUsdt={holdings.referralRewardClaimedUsdt}
                sellPrice={sellPrice}
                claimType="referral"
                onClaim={handleClaim}
                isPending={claimMutation.isPending}
              />
              <HoldingBucket
                label="Pool Level Income"
                icon={Star}
                available={holdings.levelRewardAvailable}
                claimed={holdings.levelRewardClaimed}
                claimedUsdt={holdings.levelRewardClaimedUsdt}
                sellPrice={sellPrice}
                claimType="level"
                onClaim={handleClaim}
                isPending={claimMutation.isPending}
              />
            </div>

            {totalAvailableUsdt < 0.001 && totalTokens < 0.001 && (
              <Alert className="rounded-none border-border">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-mono uppercase text-xs font-bold">No Tokens Yet</AlertTitle>
                <AlertDescription className="font-mono text-xs mt-1">
                  You don&apos;t have any tokens to claim yet. Purchase V2 tokens or bid in NFT pools to earn rewards.{" "}
                  <Link href="/nft/buy" className="text-primary underline">
                    Buy V2 tokens →
                  </Link>
                </AlertDescription>
              </Alert>
            )}

            {/* How claiming works */}
            <Card className="rounded-none border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  About Your Tokens
                </CardTitle>
              </CardHeader>
              <CardContent className="font-mono text-xs text-muted-foreground space-y-2">
                <p>
                  <strong className="text-foreground">Pool Contribution</strong> — earned by purchasing V2 tokens.
                  88% of your investment is converted to tokens at the current buy price.
                </p>
                <p>
                  <strong className="text-foreground">Referral Income</strong> — earned as tokens when your downline
                  (up to 10 levels) purchases V2 tokens.
                </p>
                <p>
                  <strong className="text-foreground">Pool Level Income</strong> — earned when NFT pools in which
                  you participated reach capacity or cross $10k milestones.
                </p>
                <p className="border-t border-border pt-2">
                  Claiming converts your TBT tokens to USDT at the current{" "}
                  <strong className="text-foreground">sell price (${sellPrice.toFixed(6)})</strong> and credits
                  them directly to your wallet. Each claim slightly reduces the token price.
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <Alert className="rounded-none border-border">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-mono uppercase text-xs font-bold">No Holdings</AlertTitle>
            <AlertDescription className="font-mono text-xs mt-1">
              Start by purchasing V2 tokens to build your holdings.{" "}
              <Link href="/nft/buy" className="text-primary underline">
                Buy V2 tokens →
              </Link>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Layout>
  );
}
