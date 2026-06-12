import { Link } from "wouter";
import {
  useGetMe,
  useGetIncomeSummary,
  useListMyPackages,
  useGetMyRankProgress,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtUsdt } from "@/lib/utils";
import {
  Wallet, ShoppingBag, ChevronRight, Trophy,
  Copy, TrendingUp, Users, Percent, Crown,
  ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { UserProfileCard } from "@/components/user-profile-card";

export default function Home() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { data: income, isLoading: incomeLoading } = useGetIncomeSummary();
  const { data: myPackages } = useListMyPackages({});
  const { data: rankProgress } = useGetMyRankProgress();

  const activePackages = myPackages?.filter((p) => p.isActive) ?? [];
  const totalInvested = activePackages.reduce((s, p) => s + parseFloat(p.principalUsdt), 0);
  const totalEarned = income
    ? parseFloat(income.roi) + parseFloat(income.referral) + parseFloat(income.royalty) + parseFloat(income.rankReward)
    : 0;

  const walletBal = parseFloat(user?.walletBalance ?? "0");
  const incomeBal = parseFloat(user?.biddingProfitBalance ?? "0");

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
        </UserProfileCard>
      )}

      {/* ── Balance Overview ── */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-700 text-white px-5 py-5 shadow-lg space-y-4">
        <p className="text-[10px] font-semibold opacity-50 uppercase tracking-widest">Account Overview</p>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/wallet">
            <div className="rounded-2xl bg-white/8 hover:bg-white/12 transition-colors px-4 py-3.5 cursor-pointer" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-1.5 mb-2.5">
                <ArrowDownLeft className="w-3 h-3 opacity-50" />
                <p className="text-[10px] font-medium opacity-50 uppercase tracking-wider">Wallet</p>
              </div>
              <p className="text-2xl font-black tabular-nums leading-none">{fmtUsdt(walletBal)}</p>
              <p className="text-[10px] opacity-40 mt-1.5">USDT · for purchases</p>
            </div>
          </Link>
          <Link href="/wallet">
            <div className="rounded-2xl cursor-pointer px-4 py-3.5 transition-colors hover:opacity-90" style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.2)" }}>
              <div className="flex items-center gap-1.5 mb-2.5">
                <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                <p className="text-[10px] font-medium text-emerald-300 uppercase tracking-wider">Income</p>
              </div>
              <p className="text-2xl font-black text-emerald-300 tabular-nums leading-none">{fmtUsdt(incomeBal)}</p>
              <p className="text-[10px] text-emerald-400/60 mt-1.5">USDT · withdrawable</p>
            </div>
          </Link>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          <div className="flex items-center gap-2 opacity-60">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs">Active Investment</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tabular-nums">{fmtUsdt(totalInvested)}</span>
            <span className="text-[10px] opacity-40">USDT</span>
            {activePackages.length > 0 && (
              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full opacity-60">{activePackages.length} active</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Investment Overview + Rank + Shop — unified card ── */}
      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">

        {/* Investment Overview header */}
        <Link href="/packages">
          <div className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer">
            <p className="text-sm font-bold text-foreground">Investment Overview</p>
            <div className="flex items-center gap-1 text-muted-foreground/50">
              <span className="text-[11px]">Details</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>

        {/* Income rows */}
        {incomeLoading ? (
          <div className="px-5 py-4 space-y-3 border-t border-border/50">
            {[1,2,3].map(i => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        ) : (
          <>
            {[
              { label: "ROI Income", sub: "Daily returns from packages", value: income?.roi ?? "0", dot: "bg-blue-500" },
              { label: "Spot Referral", sub: "10-level network commissions", value: income?.referral ?? "0", dot: "bg-violet-500" },
              { label: "Royalty Income", sub: "15% on upline withdrawals", value: income?.royalty ?? "0", dot: "bg-amber-500" },
              { label: "Rank Rewards", sub: "One-time rank achievement bonuses", value: income?.rankReward ?? "0", dot: "bg-emerald-500" },
            ].map(({ label, sub, value, dot }) => (
              <div key={label} className="flex items-center justify-between px-5 py-5 border-t border-border/50">
                <div className="flex items-center gap-3.5">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-foreground">{fmtUsdt(value)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">USDT</p>
                </div>
              </div>
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
