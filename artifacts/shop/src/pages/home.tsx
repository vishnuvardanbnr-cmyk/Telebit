import { Link } from "wouter";
import {
  useGetMe,
  useGetDashboard,
  useGetNftGlobal,
  useGetNftHoldings,
  useListNftPools,
  useClaimNftHoldings,
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
    const types = ["pool", "referral", "level"] as const;
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
      {(() => {
        const totalTokens =
          parseFloat(holdings?.poolRewardAvailable ?? "0") +
          parseFloat(holdings?.referralRewardAvailable ?? "0") +
          parseFloat(holdings?.levelRewardAvailable ?? "0");
        const sellPrice = parseFloat(holdings?.sellPrice ?? nftGlobal?.sellPrice ?? "0");
        const tokenValueUsdt = totalTokens * sellPrice;
        const currentPool = (pools ?? []).find((p) => p.status === "active") ?? (pools ?? [])[0];
        const biddingVolume = parseFloat(currentPool?.poolAmount ?? "0");
        const userPoolInvested = parseFloat(currentPool?.userBidAmount ?? "0");
        const lifetimePurchased = parseFloat(holdings?.lifetimePurchased ?? "0");

        return (
          <Card className="overflow-hidden">
            {/* coloured top stripe */}
            <div className="h-1 w-full bg-gradient-to-r from-primary to-primary/50" />
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Investment Overview
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  {nftGlobal && (
                    <Badge
                      variant={nftGlobal.canInvest ? "default" : "secondary"}
                      className="rounded-full text-[10px] px-2 py-0"
                    >
                      {nftGlobal.canInvest ? "Open" : "Paused"}
                    </Badge>
                  )}
                  <Link href="/nft/buy">
                    <Button variant="ghost" size="sm" className="text-xs h-7 gap-0.5 text-primary">
                      Buy Tokens <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* ── Primary metric: V2 token holding ── */}
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">V2 Tokens Holding</p>
                  <p className="text-2xl font-extrabold text-primary tabular-nums mt-0.5">
                    {totalTokens.toFixed(4)} <span className="text-sm font-semibold">TBT</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    ≈ <span className="font-semibold text-foreground">${tokenValueUsdt.toFixed(4)}</span> USDT at sell price
                  </p>
                </div>
                <Link href="/nft/holdings">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors cursor-pointer">
                    <Coins className="h-5 w-5 text-primary" />
                  </div>
                </Link>
              </div>

              {/* ── Secondary metrics ── */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-muted/50 border border-border p-3">
                  <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Bidding Volume</p>
                  <p className="font-extrabold text-sm mt-1 tabular-nums">${fmtUsdt(String(biddingVolume))}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">current pool</p>
                </div>
                <div className="rounded-xl bg-muted/50 border border-border p-3">
                  <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Invested</p>
                  <p className="font-extrabold text-sm mt-1 tabular-nums">${fmtUsdt(String(userPoolInvested))}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">current pool</p>
                </div>
              </div>

              {/* ── Lifetime progress bar ── */}
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                  <span>Lifetime cap</span>
                  <span className="font-semibold text-foreground">${fmtUsdt(String(lifetimePurchased))} / $10,000</span>
                </div>
                <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (lifetimePurchased / 10000) * 100)}%` }}
                  />
                </div>
              </div>

              {/* ── CTA ── */}
              <Link href="/nft/buy">
                <button className="w-full h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-white hover:opacity-95 transition-opacity">
                  <Coins className="h-3.5 w-3.5" />
                  {lifetimePurchased > 0 ? "Buy More V2 Tokens" : "Buy V2 Tokens"}
                </button>
              </Link>
            </CardContent>
          </Card>
        );
      })()}

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
