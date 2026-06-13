import { Link } from "wouter";
import {
  useGetIncomeSummary,
  useListMyPackages,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Percent, Users, Crown, Trophy, TrendingUp,
  Package, ChevronRight, Wallet,
} from "lucide-react";

const INCOME_TYPES = [
  {
    type: "roi" as const,
    label: "ROI Income",
    sublabel: "Daily returns on active packages",
    dot: "bg-blue-500",
    bg: "bg-blue-50",
    border: "border-blue-100",
    accent: "text-blue-600",
    iconBg: "bg-blue-100",
    Icon: Percent,
  },
  {
    type: "referral" as const,
    label: "Spot Referral",
    sublabel: "10-level network commissions",
    dot: "bg-violet-500",
    bg: "bg-violet-50",
    border: "border-violet-100",
    accent: "text-violet-600",
    iconBg: "bg-violet-100",
    Icon: Users,
  },
  {
    type: "royalty" as const,
    label: "Royalty Income",
    sublabel: "Profit share based on sales",
    dot: "bg-amber-500",
    bg: "bg-amber-50",
    border: "border-amber-100",
    accent: "text-amber-600",
    iconBg: "bg-amber-100",
    Icon: Crown,
  },
  {
    type: "rank_reward" as const,
    label: "Rank Rewards",
    sublabel: "One-time achievements",
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    accent: "text-emerald-600",
    iconBg: "bg-emerald-100",
    Icon: Trophy,
  },
] as const;

function StatPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-card border border-border p-3 text-center">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-lg font-black text-foreground tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function IncomePage() {
  const { data: summary, isLoading } = useGetIncomeSummary();
  const { data: myPackages } = useListMyPackages({});

  const values: Record<string, string> = {
    roi: summary?.roi ?? "0",
    referral: summary?.referral ?? "0",
    royalty: summary?.royalty ?? "0",
    rank_reward: summary?.rankReward ?? "0",
  };

  const totalIncome = Object.values(values).reduce((s, v) => s + parseFloat(v), 0);
  const activeCount = myPackages?.filter((p) => p.isActive).length ?? 0;
  const totalInvested = myPackages?.reduce((s, p) => s + parseFloat(p.principalUsdt), 0) ?? 0;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Income</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All earnings from your investment activity</p>
        </div>
        <Link href="/packages">
          <button className="flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-xl px-3 py-2 transition-colors">
            <TrendingUp className="w-3.5 h-3.5" />
            Invest
          </button>
        </Link>
      </div>

      {/* Hero total */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 px-5 py-5 text-white">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Total Income Earned</p>
        {isLoading ? (
          <Skeleton className="h-9 w-32 bg-slate-700 rounded-lg" />
        ) : (
          <p className="text-3xl font-black tabular-nums">
            {fmtUsdt(totalIncome)}
            <span className="text-base font-semibold text-slate-400 ml-2">USDT</span>
          </p>
        )}
        <p className="text-xs text-slate-500 mt-2">Across ROI · Referral · Royalty · Rewards</p>
      </div>

      {/* Quick stats */}
      <div className="flex gap-3">
        <StatPill label="Active Packages" value={String(activeCount)} sub="earning daily" />
        <StatPill label="Total Invested" value={fmtUsdt(totalInvested)} sub="USDT" />
        <Link href="/wallet" className="flex-1">
          <div className="rounded-2xl bg-card border border-border p-3 text-center cursor-pointer hover:bg-muted/30 transition-colors h-full flex flex-col items-center justify-center">
            <Wallet className="w-4 h-4 text-muted-foreground mb-1" />
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Wallet</p>
          </div>
        </Link>
      </div>

      {/* Income type breakdown */}
      <div className="rounded-2xl border border-border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <p className="text-sm font-bold text-foreground">Income Breakdown</p>
          <p className="text-xs text-muted-foreground mt-0.5">Tap any row to see full transaction history</p>
        </div>
        <div className="divide-y divide-border/50">
          {INCOME_TYPES.map(({ type, label, sublabel, iconBg, accent, Icon }) => (
            <Link key={type} href={`/income/${type}`}>
              <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors cursor-pointer">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
                  <Icon className={cn("w-5 h-5", accent)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</p>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  {isLoading ? (
                    <Skeleton className="h-5 w-16 rounded-md" />
                  ) : (
                    <div>
                      <p className={cn("text-sm font-black tabular-nums", accent)}>
                        {fmtUsdt(values[type])}
                      </p>
                      <p className="text-[10px] text-muted-foreground text-right">USDT</p>
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Active packages mini-list */}
      {activeCount > 0 && (
        <div className="rounded-2xl border border-border bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">Active Packages</p>
              <p className="text-xs text-muted-foreground mt-0.5">Currently generating ROI</p>
            </div>
            <Link href="/packages">
              <span className="text-xs font-semibold text-primary hover:underline">Manage</span>
            </Link>
          </div>
          <div className="divide-y divide-border/50">
            {myPackages?.filter(p => p.isActive).map((p, i) => {
              const pct = Math.min(100, (p.daysCredited / p.totalRoiDays) * 100);
              const daily = (parseFloat(p.principalUsdt) * parseFloat(p.roiPercent)) / 100;
              return (
                <div key={p.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Package className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Package #{i + 1}</p>
                        <p className="text-[11px] text-muted-foreground">{fmtUsdt(p.principalUsdt)} USDT · {p.roiPercent}%/day</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-blue-600">+{fmtUsdt(daily)}/day</p>
                      <p className="text-[10px] text-muted-foreground">Day {p.daysCredited}/{p.totalRoiDays}</p>
                    </div>
                  </div>
                  <div className="h-1 bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
