import { Link } from "wouter";
import {
  useGetMe,
  useGetIncomeSummary,
  useListMyPackages,
  useGetMyRankProgress,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Wallet, ShoppingBag, ChevronRight, Trophy,
  Copy, TrendingUp, Users, Percent, Crown, ArrowDownLeft,
  ArrowUpRight, Star,
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
    ? parseFloat(income.roi) + parseFloat(income.referral) + parseFloat(income.royalty)
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
    <div className="container mx-auto px-4 py-6 space-y-5 max-w-2xl">

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
        <p className="text-xs font-semibold opacity-60 uppercase tracking-widest">Account Overview</p>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/wallet">
            <div className="rounded-2xl bg-white/10 hover:bg-white/15 transition-colors px-4 py-3.5 cursor-pointer">
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowDownLeft className="w-3.5 h-3.5 opacity-60" />
                <p className="text-[10px] font-semibold opacity-60 uppercase tracking-wide">Wallet Balance</p>
              </div>
              <p className="text-xl font-black tabular-nums">{fmtUsdt(walletBal)}</p>
              <p className="text-[10px] opacity-50 mt-0.5">USDT · Deposit/Shop</p>
            </div>
          </Link>
          <Link href="/wallet">
            <div className="rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors px-4 py-3.5 cursor-pointer border border-emerald-400/20">
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                <p className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wide">Income Balance</p>
              </div>
              <p className="text-xl font-black text-emerald-300 tabular-nums">{fmtUsdt(incomeBal)}</p>
              <p className="text-[10px] text-emerald-400/70 mt-0.5">USDT · Withdrawable</p>
            </div>
          </Link>
        </div>

        {/* Total invested pill */}
        <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 opacity-60" />
            <span className="text-xs opacity-70">Active Investment</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tabular-nums">{fmtUsdt(totalInvested)} USDT</span>
            {activePackages.length > 0 && (
              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full opacity-70">{activePackages.length} pkg</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Investment Overview ── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Investment Overview</h2>

        {incomeLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-2">
            {/* ROI income */}
            <Link href="/packages">
              <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3.5 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer group">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Percent className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">ROI Income</p>
                  <p className="text-[11px] text-muted-foreground">Daily returns from packages</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-black text-blue-600 tabular-nums">{fmtUsdt(income?.roi ?? "0")}</p>
                  <p className="text-[10px] text-muted-foreground">USDT earned</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            {/* Referral income */}
            <Link href="/packages">
              <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3.5 hover:border-purple-200 hover:bg-purple-50/30 transition-all cursor-pointer group">
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">Spot Referral Income</p>
                  <p className="text-[11px] text-muted-foreground">10-level network commissions</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-black text-purple-600 tabular-nums">{fmtUsdt(income?.referral ?? "0")}</p>
                  <p className="text-[10px] text-muted-foreground">USDT earned</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            {/* Royalty income */}
            <Link href="/packages">
              <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3.5 hover:border-amber-200 hover:bg-amber-50/30 transition-all cursor-pointer group">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Crown className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">Royalty Income</p>
                  <p className="text-[11px] text-muted-foreground">15% on upline withdrawals</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-black text-amber-600 tabular-nums">{fmtUsdt(income?.royalty ?? "0")}</p>
                  <p className="text-[10px] text-muted-foreground">USDT earned</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            {/* Total earned footer */}
            <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-emerald-600" fill="currentColor" />
                <span className="text-sm font-bold text-emerald-800">Total Income Earned</span>
              </div>
              <span className="text-lg font-black text-emerald-700 tabular-nums">{fmtUsdt(totalEarned)} <span className="text-xs font-semibold opacity-70">USDT</span></span>
            </div>
          </div>
        )}
      </div>

      {/* ── Rank Progress Teaser ── */}
      {rankProgress && (
        <Link href="/ranks">
          <div className="rounded-2xl border border-violet-200 bg-violet-50/50 px-4 py-3.5 cursor-pointer hover:bg-violet-50 transition-colors group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Trophy className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-violet-900">
                    {rankProgress.currentRank ? rankProgress.currentRank.name : "Unranked"}
                  </p>
                  <p className="text-[11px] text-violet-600">
                    {rankProgress.nextRank
                      ? `Next: ${rankProgress.nextRank.name}`
                      : rankProgress.currentRank
                      ? "Top rank achieved!"
                      : "Start earning to rank up"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {rankProgress.nextRank && (() => {
                  const p = rankProgress.progress?.find((x) => x.rank.id === rankProgress.nextRank!.id);
                  const pct = p?.progressPct ?? 0;
                  return (
                    <div className="text-right">
                      <p className="text-sm font-black text-violet-700">{pct.toFixed(0)}%</p>
                      <div className="w-16 h-1.5 bg-violet-200 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}
                <ChevronRight className="w-4 h-4 text-violet-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* ── Go to Shop ── */}
      <Link href="/products">
        <div className="border border-border rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors group">
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
