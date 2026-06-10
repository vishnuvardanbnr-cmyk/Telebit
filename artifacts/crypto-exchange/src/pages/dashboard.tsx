import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useGetMe,
  useGetDashboard,
  useGetNftGlobal,
  useGetNftHoldings,
  useListNftPools,
  useCheckDeposit,
  useClaimNftHoldings,
  NftClaimRequestType,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatUsdt, truncateAddress } from "@/lib/format";
import {
  Wallet, TrendingUp, LayoutGrid, BadgeCheck,
  ArrowDownToLine, ArrowUpFromLine, Send, RefreshCw, AlertCircle,
  ChevronRight, Coins, Copy,
} from "lucide-react";
import { UserProfileCard } from "@/components/user-profile-card";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Link } from "wouter";

function DepositModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: user, isLoading } = useGetMe();
  const checkDepositMutation = useCheckDeposit();

  const handleCopy = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.depositAddress);
    toast.success("Address copied");
  };

  const handleCheck = () => {
    checkDepositMutation.mutate(undefined, {
      onSuccess: (res) => {
        if (res.found) toast.success(`Deposit found! Credited ${res.amount} USDT.`);
        else toast.info(res.message);
      },
      onError: () => toast.error("Failed to check for deposits."),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-none p-0 gap-0 border-border">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="font-mono uppercase tracking-wider text-lg">Deposit USDT</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-64 w-full rounded-none" /></div>
        ) : user ? (
          <div className="p-6 space-y-5">
            <div className="text-center border border-border bg-muted/20 py-2">
              <p className="font-mono text-xs font-bold text-primary uppercase tracking-wider">BNB Smart Chain (BEP-20)</p>
              <p className="font-mono text-xs text-muted-foreground mt-0.5">Send only USDT on BSC to this address</p>
            </div>
            <div className="flex justify-center">
              <div className="p-4 bg-white border border-border">
                <QRCodeSVG value={user.depositAddress} size={160} level="M" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Your Deposit Address</label>
              <div className="flex items-stretch">
                <div className="flex-1 px-3 py-2.5 border border-border border-r-0 bg-background font-mono text-xs truncate flex items-center">
                  {truncateAddress(user.depositAddress)}
                </div>
                <Button size="icon" variant="outline" className="rounded-none h-auto px-3 border-border shrink-0" onClick={handleCopy}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button variant="outline" className="w-full rounded-none font-mono uppercase tracking-wider" onClick={handleCheck} disabled={checkDepositMutation.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${checkDepositMutation.isPending ? "animate-spin" : ""}`} />
              {checkDepositMutation.isPending ? "Scanning…" : "Check for New Deposit"}
            </Button>
            <Alert className="rounded-none border-amber-300 bg-amber-50 text-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="font-mono text-xs font-bold uppercase">Important</AlertTitle>
              <AlertDescription className="font-mono text-xs mt-1 leading-relaxed">
                Send <strong>only USDT</strong> via <strong>BNB Smart Chain (BEP-20)</strong>. Other tokens or networks result in permanent loss.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="p-6 text-center text-destructive font-mono text-sm uppercase">Failed to load deposit info</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { data: dashboard } = useGetDashboard();
  const { data: nftGlobal } = useGetNftGlobal();
  const { data: holdings } = useGetNftHoldings();
  const { data: pools } = useListNftPools();
  const claimHoldings = useClaimNftHoldings();

  const [depositOpen, setDepositOpen] = useState(false);

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
      <Layout>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full rounded-none" />)}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5">

        {/* ── User Profile ── */}
        {user && (
          <UserProfileCard user={user}>
            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2 mt-5">
              <Button size="sm" className="rounded-none font-mono uppercase tracking-wider text-xs gap-1.5" onClick={() => setDepositOpen(true)}>
                <ArrowDownToLine className="h-3.5 w-3.5" />Deposit
              </Button>
              <Button size="sm" variant="outline" className="rounded-none font-mono uppercase tracking-wider text-xs gap-1.5" asChild>
                <Link href="/withdraw"><ArrowUpFromLine className="h-3.5 w-3.5" />Withdraw</Link>
              </Button>
              <Button size="sm" variant="outline" className="rounded-none font-mono uppercase tracking-wider text-xs gap-1.5" asChild>
                <Link href="/p2p"><Send className="h-3.5 w-3.5" />P2P</Link>
              </Button>
            </div>

            {/* Deposit address */}
            <div className="mt-3 flex items-center gap-2 bg-muted/30 border border-border px-3 py-2">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono text-[11px] text-muted-foreground flex-1 truncate">{user?.depositAddress}</span>
              <button onClick={() => { navigator.clipboard.writeText(user?.depositAddress || ""); toast.success("Address copied"); }}>
                <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            </div>
          </UserProfileCard>
        )}

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Deposited", val: formatUsdt(dashboard?.totalDeposited), unit: "USDT", color: "text-green-600" },
            { label: "Total Withdrawn", val: formatUsdt(dashboard?.totalWithdrawn), unit: "USDT", color: "text-destructive" },
            { label: "Token Buy Price", val: nftGlobal ? `$${parseFloat(nftGlobal.buyPrice).toFixed(4)}` : "—", unit: "USDT", color: "text-primary" },
            { label: "Token Sell Price", val: nftGlobal ? `$${parseFloat(nftGlobal.sellPrice).toFixed(4)}` : "—", unit: "USDT", color: "text-orange-500" },
          ].map((s) => (
            <Card key={s.label} className="rounded-none border-border">
              <CardContent className="p-3">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
                <div className={`font-mono font-black text-xl mt-1 ${s.color}`}>{s.val}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{s.unit}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Investment Overview ── */}
        <Card className="rounded-none border-border">
          <CardHeader className="border-b border-border bg-muted/20 py-3 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono uppercase tracking-wider text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Investment Overview
              </CardTitle>
              <Link href="/nft/buy">
                <Button variant="ghost" size="sm" className="rounded-none font-mono text-xs uppercase h-7 gap-1">
                  Buy Tokens <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {!nftGlobal ? (
              <p className="font-mono text-xs text-muted-foreground">NFT system not yet activated. Contact admin.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground uppercase">V2 Purchases:</span>
                  <Badge variant={nftGlobal.canInvest ? "default" : "secondary"} className="rounded-none font-mono text-[10px] uppercase">
                    {nftGlobal.canInvest ? "Open" : "Closed"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Current Buy Price", val: `$${parseFloat(nftGlobal.buyPrice).toFixed(6)}` },
                    { label: "Current Sell Price", val: `$${parseFloat(nftGlobal.sellPrice).toFixed(6)}` },
                    { label: "Total Liquidity", val: `$${formatUsdt(nftGlobal.liquidity)}` },
                    { label: "Platform Volume", val: `$${formatUsdt(nftGlobal.totalPurchase)}` },
                  ].map((s) => (
                    <div key={s.label} className="border border-border p-3">
                      <div className="font-mono text-[10px] text-muted-foreground uppercase">{s.label}</div>
                      <div className="font-mono font-bold text-sm mt-1">{s.val}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Link href="/nft/buy">
                    <Button size="sm" className="rounded-none font-mono uppercase text-xs gap-1.5" disabled={!nftGlobal.canInvest}>
                      <Coins className="h-3.5 w-3.5" />Buy V2 Tokens
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Bidding Overview ── */}
        <Card className="rounded-none border-border">
          <CardHeader className="border-b border-border bg-muted/20 py-3 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono uppercase tracking-wider text-sm flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-purple-500" />
                NFT Pool Bidding
              </CardTitle>
              <Link href="/nft/pools">
                <Button variant="ghost" size="sm" className="rounded-none font-mono text-xs uppercase h-7 gap-1">
                  All Pools <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {activePools.length === 0 ? (
              <div className="text-center py-6">
                <LayoutGrid className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="font-mono text-xs text-muted-foreground uppercase">No active pools right now</p>
                <Link href="/nft/pools">
                  <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs mt-3">Browse Pools</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {activePools.slice(0, 4).map((pool) => {
                  const filled = parseFloat(pool.poolAmount);
                  const size = parseFloat(pool.poolSize);
                  const pct = size > 0 ? Math.round((filled / size) * 100) : 0;
                  return (
                    <div key={pool.id} className="border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-sm">{pool.nft?.title ?? "Pool"}</span>
                          <span className="font-mono text-[10px] text-muted-foreground ml-2 uppercase">Level {pool.level}</span>
                        </div>
                        <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase text-green-600 border-green-300">Active</Badge>
                      </div>
                      <div className="flex justify-between font-mono text-xs text-muted-foreground">
                        <span>${formatUsdt(pool.poolAmount)} filled</span>
                        <span>${formatUsdt(pool.poolSize)} total · {pct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-none overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {activePools.length > 4 && (
                  <Link href="/nft/pools">
                    <p className="font-mono text-xs text-primary text-center py-1 hover:underline cursor-pointer">+{activePools.length - 4} more pools →</p>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Token Holdings ── */}
        <Card className="rounded-none border-border">
          <CardHeader className="border-b border-border bg-muted/20 py-3 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono uppercase tracking-wider text-sm flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-green-500" />
                Token Holdings
              </CardTitle>
              <Link href="/nft/holdings">
                <Button variant="ghost" size="sm" className="rounded-none font-mono text-xs uppercase h-7 gap-1">
                  Details <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {!holdings || parseFloat(holdings.lifetimePurchased) === 0 ? (
              <div className="text-center py-6">
                <BadgeCheck className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="font-mono text-xs text-muted-foreground uppercase">No token holdings yet</p>
                <Link href="/nft/buy">
                  <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs mt-3">Buy V2 Tokens</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Holding value */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="border border-primary/30 bg-primary/5 p-3 col-span-2 sm:col-span-1">
                    <div className="font-mono text-[10px] text-muted-foreground uppercase">Holding Value</div>
                    <div className="font-mono font-black text-2xl text-primary mt-1">{formatUsdt(holdings.holdingValueUsdt)}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">USDT</div>
                  </div>
                  <div className="border border-border p-3">
                    <div className="font-mono text-[10px] text-muted-foreground uppercase">Lifetime Purchased</div>
                    <div className="font-mono font-bold text-lg mt-1">{formatUsdt(holdings.lifetimePurchased)}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">tokens</div>
                  </div>
                  <div className="border border-border p-3">
                    <div className="font-mono text-[10px] text-muted-foreground uppercase">Sell Price</div>
                    <div className="font-mono font-bold text-lg mt-1">${parseFloat(holdings.sellPrice).toFixed(4)}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">per token</div>
                  </div>
                </div>

                {/* Reward breakdown */}
                <div className="border border-border divide-y divide-border">
                  {[
                    { label: "Pool Reward", avail: holdings.poolRewardAvailable, claimed: holdings.poolRewardClaimedUsdt },
                    { label: "Referral Reward", avail: holdings.referralRewardAvailable, claimed: holdings.referralRewardClaimedUsdt },
                    { label: "Level Reward", avail: holdings.levelRewardAvailable, claimed: holdings.levelRewardClaimedUsdt },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between px-3 py-2.5">
                      <span className="font-mono text-xs uppercase">{r.label}</span>
                      <div className="text-right">
                        <span className="font-mono text-sm font-bold text-green-600">+{formatUsdt(r.avail)} USDT</span>
                        <span className="font-mono text-[10px] text-muted-foreground ml-2">({formatUsdt(r.claimed)} claimed)</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Claim button */}
                <div className="flex items-center justify-between bg-muted/20 border border-border p-3">
                  <div>
                    <div className="font-mono text-[10px] text-muted-foreground uppercase">Total Claimable</div>
                    <div className="font-mono font-black text-xl text-green-600">{totalClaimable} USDT</div>
                  </div>
                  <Button
                    className="rounded-none font-mono uppercase tracking-wider text-xs"
                    disabled={parseFloat(totalClaimable) === 0 || claimHoldings.isPending}
                    onClick={handleClaim}
                  >
                    {claimHoldings.isPending ? "Claiming…" : "Claim Rewards"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />
    </Layout>
  );
}
