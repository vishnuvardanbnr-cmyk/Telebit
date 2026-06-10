import { Link } from "wouter";
import {
  useGetMe,
  useGetDashboard,
  useGetNftGlobal,
  useGetNftHoldings,
  useListNftPools,
  useClaimNftHoldings,
  NftClaimRequestType,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { fmtUsdt } from "@/lib/utils";
import {
  Wallet, TrendingUp, LayoutGrid, BadgeCheck,
  Coins, ChevronRight, ShoppingBag, Copy,
} from "lucide-react";
import { toast } from "sonner";
import { UserProfileCard } from "@/components/user-profile-card";

export default function Home() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { data: dashboard } = useGetDashboard();
  const { data: nftGlobal } = useGetNftGlobal();
  const { data: holdings } = useGetNftHoldings();
  const { data: pools } = useListNftPools();
  const claimHoldings = useClaimNftHoldings();

  const activePools = pools?.filter((p) => p.status === "active") ?? [];

  const totalClaimable = holdings
    ? (
        parseFloat(holdings.poolRewardAvailable) +
        parseFloat(holdings.referralRewardAvailable) +
        parseFloat(holdings.levelRewardAvailable)
      ).toFixed(4)
    : "0.0000";

  const handleClaim = () => {
    const types = [NftClaimRequestType.pool, NftClaimRequestType.referral, NftClaimRequestType.level];
    let idx = 0;
    const claimNext = () => {
      if (idx >= types.length) { toast.success("Rewards claimed successfully"); return; }
      claimHoldings.mutate({ data: { type: types[idx++] } }, {
        onSuccess: claimNext,
        onError: () => toast.error("Claim failed"),
      });
    };
    claimNext();
  };

  if (userLoading) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-4 max-w-2xl">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-5 max-w-2xl">

      {/* ── User Profile ── */}
      {user && (
        <UserProfileCard user={user}>
          {/* Deposit address */}
          <div className="mt-4 flex items-center gap-2 bg-muted/30 border border-border rounded-lg px-3 py-2">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-mono text-[11px] text-muted-foreground flex-1 truncate">{user?.depositAddress}</span>
            <button onClick={() => { navigator.clipboard.writeText(user?.depositAddress || ""); toast.success("Address copied"); }}>
              <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          </div>
        </UserProfileCard>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Deposited", val: fmtUsdt(dashboard?.totalDeposited), color: "text-green-600" },
          { label: "Total Withdrawn", val: fmtUsdt(dashboard?.totalWithdrawn), color: "text-red-500" },
          { label: "Token Buy Price", val: nftGlobal ? `$${parseFloat(nftGlobal.buyPrice).toFixed(4)}` : "—", color: "text-primary" },
          { label: "Token Sell Price", val: nftGlobal ? `$${parseFloat(nftGlobal.sellPrice).toFixed(4)}` : "—", color: "text-orange-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
              <div className={`font-black text-xl mt-1 ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-muted-foreground">USDT</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Investment Overview ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Investment Overview
            </CardTitle>
            <Link href="/nft/buy">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-0.5 text-primary">
                Buy Tokens <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {!nftGlobal ? (
            <p className="text-xs text-muted-foreground py-2">NFT system not yet activated.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">V2 Purchases:</span>
                <Badge variant={nftGlobal.canInvest ? "default" : "secondary"} className="rounded-full text-[10px] uppercase px-2">
                  {nftGlobal.canInvest ? "Open" : "Closed"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Buy Price", val: `$${parseFloat(nftGlobal.buyPrice).toFixed(6)}` },
                  { label: "Sell Price", val: `$${parseFloat(nftGlobal.sellPrice).toFixed(6)}` },
                  { label: "Liquidity", val: `$${fmtUsdt(nftGlobal.liquidity)}` },
                  { label: "Platform Volume", val: `$${fmtUsdt(nftGlobal.totalPurchase)}` },
                ].map((s) => (
                  <div key={s.label} className="border rounded-lg p-2.5">
                    <div className="text-[10px] text-muted-foreground uppercase">{s.label}</div>
                    <div className="font-bold text-sm mt-0.5">{s.val}</div>
                  </div>
                ))}
              </div>
              <Link href="/nft/buy">
                <Button size="sm" className="rounded-full text-xs gap-1.5 w-full" disabled={!nftGlobal.canInvest}>
                  <Coins className="h-3.5 w-3.5" /> Buy V2 Tokens
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── NFT Pool Bidding ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-purple-500" />
              NFT Pool Bidding
            </CardTitle>
            <Link href="/nft/pools">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-0.5 text-primary">
                All Pools <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {activePools.length === 0 ? (
            <div className="text-center py-4">
              <LayoutGrid className="h-7 w-7 text-muted-foreground/30 mx-auto mb-1.5" />
              <p className="text-xs text-muted-foreground">No active pools right now</p>
              <Link href="/nft/pools">
                <Button variant="outline" size="sm" className="rounded-full text-xs mt-2.5">Browse Pools</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {activePools.slice(0, 3).map((pool) => {
                const filled = parseFloat(pool.poolAmount);
                const size = parseFloat(pool.poolSize);
                const pct = size > 0 ? Math.round((filled / size) * 100) : 0;
                return (
                  <div key={pool.id} className="border rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{pool.nft?.title ?? "Pool"} <span className="text-[10px] text-muted-foreground font-normal">Lv.{pool.level}</span></span>
                      <Badge variant="outline" className="rounded-full text-[10px] text-green-600 border-green-300 px-2">Active</Badge>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>${fmtUsdt(pool.poolAmount)} / ${fmtUsdt(pool.poolSize)}</span>
                      <span>{pct}% filled</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Token Holdings ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-green-500" />
              Token Holdings
            </CardTitle>
            <Link href="/nft/holdings">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-0.5 text-primary">
                Details <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {!holdings || parseFloat(holdings.lifetimePurchased) === 0 ? (
            <div className="text-center py-4">
              <BadgeCheck className="h-7 w-7 text-muted-foreground/30 mx-auto mb-1.5" />
              <p className="text-xs text-muted-foreground">No token holdings yet</p>
              <Link href="/nft/buy">
                <Button variant="outline" size="sm" className="rounded-full text-xs mt-2.5">Buy V2 Tokens</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 border border-primary/30 bg-primary/5 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Holding Value</div>
                    <div className="font-black text-2xl text-primary">{fmtUsdt(holdings.holdingValueUsdt)}</div>
                    <div className="text-[10px] text-muted-foreground">USDT</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground uppercase">Sell Price</div>
                    <div className="font-bold text-lg">${parseFloat(holdings.sellPrice).toFixed(4)}</div>
                  </div>
                </div>
                <div className="border rounded-lg p-2.5">
                  <div className="text-[10px] text-muted-foreground uppercase">Lifetime Purchased</div>
                  <div className="font-bold text-lg">{fmtUsdt(holdings.lifetimePurchased)}</div>
                  <div className="text-[10px] text-muted-foreground">tokens</div>
                </div>
                <div className="border rounded-lg p-2.5">
                  <div className="text-[10px] text-muted-foreground uppercase">Total Claimable</div>
                  <div className="font-bold text-lg text-green-600">{totalClaimable}</div>
                  <div className="text-[10px] text-muted-foreground">USDT</div>
                </div>
              </div>

              {/* Reward breakdown */}
              <div className="border rounded-lg divide-y">
                {[
                  { label: "Pool Reward", avail: holdings.poolRewardAvailable, claimed: holdings.poolRewardClaimedUsdt },
                  { label: "Referral Reward", avail: holdings.referralRewardAvailable, claimed: holdings.referralRewardClaimedUsdt },
                  { label: "Level Reward", avail: holdings.levelRewardAvailable, claimed: holdings.levelRewardClaimedUsdt },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-medium">{r.label}</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-green-600">+{fmtUsdt(r.avail)}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">({fmtUsdt(r.claimed)} claimed)</span>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                className="w-full rounded-full text-xs font-semibold"
                disabled={parseFloat(totalClaimable) === 0 || claimHoldings.isPending}
                onClick={handleClaim}
              >
                {claimHoldings.isPending ? "Claiming…" : `Claim ${totalClaimable} USDT`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Go to Shop ── */}
      <Link href="/products">
        <div className="border border-border rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-sm">Shop Products</div>
              <div className="text-[11px] text-muted-foreground">Browse the catalog</div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>

    </div>
  );
}
