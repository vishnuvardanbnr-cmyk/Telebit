import { Link } from "wouter";
import {
  useGetIncomeSummary,
  useListMyPackages,
  useGetMyRankProgress,
  useGetSettings,
  useGetMyShareRequests,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtUsdt } from "@/lib/utils";
import {
  Wallet, ShoppingBag, ChevronRight, Trophy,
  Copy, TrendingUp, Users, Percent, Crown,
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Leaf, Ticket, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { UserProfileCard } from "@/components/user-profile-card";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, isLoading: userLoading } = useAuth();
  const { data: income, isLoading: incomeLoading } = useGetIncomeSummary();
  const { data: myPackages } = useListMyPackages({});
  const { data: rankProgress } = useGetMyRankProgress();
  const { data: settings } = useGetSettings();
  const { data: shareData } = useGetMyShareRequests();

  const activePackages = myPackages?.filter((p) => p.isActive) ?? [];
  const isActiveMember = (user?.subscriptionActive ?? false) || activePackages.length > 0;
  const totalInvested = activePackages.reduce((s, p) => s + parseFloat(p.principalUsdt), 0);
  const totalEarned = income
    ? parseFloat(income.roi) + parseFloat(income.referral) + parseFloat(income.royalty) + parseFloat(income.rankReward)
    : 0;

  const walletBal = parseFloat(user?.walletBalance ?? "0");
  const incomeBal = parseFloat(user?.incomeBalance ?? "0");

  if (userLoading) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-4 max-w-2xl">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-4 max-w-2xl">

      {/* ── User Profile ── */}
      {user && (
        <UserProfileCard user={user}>
          <div className="mt-4 flex items-center gap-2 bg-muted/30 border border-border rounded-lg px-3 py-2">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-mono text-[11px] text-muted-foreground flex-1 truncate">{user?.depositAddress}</span>
            <button onClick={() => { navigator.clipboard.writeText(user?.depositAddress || ""); toast.success("Address copied"); }}>
              <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {isActiveMember ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1 text-[11px] font-bold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Member
                </span>
                {activePackages.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">{activePackages.length} package{activePackages.length > 1 ? "s" : ""}</span>
                )}
              </>
            ) : (
              <Link href="/packages">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                  No active package · Get started
                </span>
              </Link>
            )}
          </div>
        </UserProfileCard>
      )}

      {/* ── Ethnol Bio Fuel Share Guarantee ── */}
      {(() => {
        const sharesPerPkg = parseInt(settings?.sharesPerPackage ?? "50");
        const shareVal = parseFloat(settings?.shareValueUsdt ?? "0");
        const confirmedShares = shareData?.totalConfirmedShares ?? 0;
        const pendingShares = shareData?.totalPendingShares ?? 0;
        const confirmedValue = confirmedShares * shareVal;
        return (
          <div className="rounded-2xl overflow-hidden border border-green-200 shadow-sm">
            <div className="bg-gradient-to-r from-green-700 to-emerald-600 px-5 pt-5 pb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                    <Leaf className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-green-200 uppercase tracking-widest">Package Guarantee</p>
                    <p className="text-sm font-black text-white leading-tight">Ethnol Bio Fuel Company</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/20 px-4 py-4">
                <p className="text-[10px] font-semibold text-green-200 uppercase tracking-widest mb-1">Your Share Holdings</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-black text-white tabular-nums leading-none">{confirmedShares.toLocaleString()}</p>
                    <p className="text-xs text-green-200 mt-1">confirmed shares transferred</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-emerald-200 tabular-nums">
                      {confirmedValue > 0 ? `$${confirmedValue.toFixed(2)}` : shareVal > 0 ? "$0.00" : "—"}
                    </p>
                    <p className="text-[10px] text-green-300 mt-0.5">USDT value</p>
                  </div>
                </div>
                {pendingShares > 0 && (
                  <p className="text-[10px] text-amber-300 mt-2">⏳ {pendingShares} shares pending admin transfer</p>
                )}
                {confirmedShares === 0 && pendingShares === 0 && (
                  <p className="text-[10px] text-green-300/70 mt-2">Purchase a package and request share transfer</p>
                )}
              </div>
            </div>
            <div className="bg-white px-5 py-4 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every <strong className="text-foreground">$125 package</strong> awards <strong className="text-green-700">{sharesPerPkg} shares</strong> — backed by real equity in Ethnol Bio Fuel Company.
              </p>

              <Link href="/demat">
                <div className="flex items-center justify-center gap-2 rounded-xl bg-green-700 hover:bg-green-800 transition-colors px-4 py-3 cursor-pointer">
                  <Leaf className="w-4 h-4 text-white" />
                  <p className="text-xs font-black text-white uppercase tracking-wider">Setup Demat & Request Transfer</p>
                </div>
              </Link>
            </div>
          </div>
        );
      })()}

      {/* ── Quick action buttons ── */}
      <div className="flex gap-3">
        <Link href="/lottery" className="flex-1">
          <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-border bg-white shadow-sm px-4 py-4 hover:bg-muted/30 transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Ticket className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-sm font-bold text-foreground">Lucky Draw</span>
          </div>
        </Link>
        <Link href="/p2p" className="flex-1">
          <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-border bg-white shadow-sm px-4 py-4 hover:bg-muted/30 transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-4 h-4 text-violet-600" />
            </div>
            <span className="text-sm font-bold text-foreground">P2P</span>
          </div>
        </Link>
      </div>

      {/* ── Investment Overview + Rank + Shop — unified card ── */}
      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">

        {/* Investment Overview header — no link, just a label */}
        <div className="px-5 py-4">
          <p className="text-sm font-bold text-foreground">Investment Overview</p>
        </div>

        {/* Income rows — each individually clickable */}
        {incomeLoading ? (
          <div className="px-5 py-4 space-y-3 border-t border-border/50">
            {[1,2,3].map(i => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        ) : (
          <>
            {[
              { label: "Profit Share",     sub: "Daily returns from packages",       value: income?.roi ?? "0",        dot: "bg-blue-500",   href: "/income/roi" },
              { label: "Spot Referral",    sub: "10-level network commissions",      value: income?.referral ?? "0",   dot: "bg-violet-500", href: "/income/referral" },
              { label: "Royalty Income",   sub: "Profit share based on sales",       value: income?.royalty ?? "0",    dot: "bg-amber-500",  href: "/income/royalty" },
              { label: "Rank Rewards",     sub: "One-time rank achievement bonuses", value: income?.rankReward ?? "0", dot: "bg-emerald-500",href: "/income/rank_reward" },
            ].map(({ label, sub, value, dot, href }) => (
              <Link key={label} href={href}>
              <div className="flex items-center justify-between px-5 py-5 border-t border-border/50 hover:bg-muted/30 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3.5">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-foreground">{fmtUsdt(value)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">USDT</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </div>
              </div>
              </Link>
            ))}

            {/* Total earned */}
            <div className="flex items-center justify-between px-5 py-5 border-t border-border bg-muted/20">
              <p className="text-sm font-bold text-foreground">Total Earned</p>
              <div className="text-right">
                <p className="text-base font-black tabular-nums text-emerald-600">{fmtUsdt(totalEarned)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">USDT</p>
              </div>
            </div>
          </>
        )}

        {/* Rank progress */}
        {rankProgress && (
          <Link href="/ranks">
            <div className="flex items-center justify-between px-5 py-4 border-t border-border hover:bg-muted/30 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground leading-tight">
                    {rankProgress.currentRank ? rankProgress.currentRank.name : "Unranked"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {rankProgress.nextRank
                      ? `Next: ${rankProgress.nextRank.name}`
                      : rankProgress.currentRank
                      ? "Highest rank achieved"
                      : "Purchase a package to start ranking"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {rankProgress.nextRank && (() => {
                  const p = rankProgress.progress?.find((x) => x.rank.id === rankProgress.nextRank!.id);
                  const pct = p?.progressPct ?? 0;
                  return (
                    <div className="text-right">
                      <p className="text-xs font-black text-violet-600 tabular-nums">{pct.toFixed(1)}%</p>
                      <div className="w-20 h-1.5 bg-violet-100 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}
                <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
              </div>
            </div>
          </Link>
        )}

        {/* Shop Products */}
        <Link href="/products">
          <div className="flex items-center justify-between px-5 py-4 border-t border-border hover:bg-muted/30 transition-colors cursor-pointer group">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground leading-tight">Shop Products</p>
                <p className="text-[11px] text-muted-foreground">Browse the catalog</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
          </div>
        </Link>

      </div>


    </div>
  );
}
