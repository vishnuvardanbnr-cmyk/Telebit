import { useRoute, Link } from "wouter";
import {
  useListIncome,
  useGetIncomeSummary,
  useListMyPackages,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Percent, Users, Crown, Trophy,
  TrendingUp, Calendar, Package, ChevronRight,
} from "lucide-react";

type IncomeType = "roi" | "referral" | "royalty" | "rank_reward";

const TYPE_META: Record<IncomeType, {
  label: string;
  desc: string;
  dot: string;
  accent: string;
  bg: string;
  Icon: any;
}> = {
  roi: {
    label: "Profit Share",
    desc: "Daily returns credited from active packages",
    dot: "bg-blue-500",
    accent: "text-blue-600",
    bg: "bg-blue-50",
    Icon: Percent,
  },
  referral: {
    label: "Spot Referral Income",
    desc: "Commissions from 10-level network on package purchases",
    dot: "bg-violet-500",
    accent: "text-violet-600",
    bg: "bg-violet-50",
    Icon: Users,
  },
  royalty: {
    label: "Royalty Income",
    desc: "Profit share based on sales",
    dot: "bg-amber-500",
    accent: "text-amber-600",
    bg: "bg-amber-50",
    Icon: Crown,
  },
  rank_reward: {
    label: "Rank Rewards",
    desc: "One-time rewards credited upon achieving a rank",
    dot: "bg-emerald-500",
    accent: "text-emerald-600",
    bg: "bg-emerald-50",
    Icon: Trophy,
  },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit",
  });
}

/* ─── ROI detail: per-package breakdown ────────────────────── */
function RoiPackageBreakdown() {
  const { data: pkgs } = useListMyPackages({});
  if (!pkgs?.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-border/60">
        <p className="text-sm font-bold text-foreground">Package Breakdown</p>
        <p className="text-xs text-muted-foreground mt-0.5">Profit Share progress per active package</p>
      </div>
      <div className="divide-y divide-border/50">
        {pkgs.map((pkg, i) => {
          const earned = parseFloat(pkg.totalRoiCredited);
          const daily = (parseFloat(pkg.principalUsdt) * parseFloat(pkg.roiPercent)) / 100;
          const remaining = pkg.totalRoiDays - pkg.daysCredited;
          const pending = remaining > 0 ? remaining * daily : 0;
          const pct = pkg.totalRoiDays > 0 ? (pkg.daysCredited / pkg.totalRoiDays) * 100 : 0;

          return (
            <div key={pkg.id} className="px-5 py-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Package #{i + 1}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtUsdt(pkg.principalUsdt)} USDT · {pkg.roiPercent}%/day · {pkg.totalRoiDays} days
                    </p>
                  </div>
                </div>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full",
                  pkg.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                )}>
                  {pkg.isActive ? "Active" : "Completed"}
                </span>
              </div>

              {/* progress bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                  <span>Day {pkg.daysCredited} of {pkg.totalRoiDays}</span>
                  <span>{pct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* stats row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Earned", value: fmtUsdt(earned), color: "text-blue-600" },
                  { label: "Pending", value: fmtUsdt(pending), color: "text-amber-600" },
                  { label: "Daily Profit Share", value: fmtUsdt(daily), color: "text-foreground" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl bg-muted/40 px-3 py-2.5 text-center">
                    <p className={cn("text-sm font-black tabular-nums", color)}>{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────── */
export default function IncomeDetailPage() {
  const [, params] = useRoute<{ type: string }>("/income/:type");
  const type = (params?.type ?? "roi") as IncomeType;
  const meta = TYPE_META[type] ?? TYPE_META.roi;

  const { data: summary } = useGetIncomeSummary();
  const { data: entries, isLoading } = useListIncome({ type } as any, {});

  const totalMap: Record<IncomeType, string> = {
    roi: summary?.roi ?? "0",
    referral: summary?.referral ?? "0",
    royalty: summary?.royalty ?? "0",
    rank_reward: summary?.rankReward ?? "0",
  };
  const total = totalMap[type] ?? "0";
  const Icon = meta.Icon;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">

      {/* ── Back + Title ── */}
      <div className="flex items-center gap-3">
        <Link href="/">
          <button className="w-9 h-9 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
        </Link>
        <div>
          <h1 className="text-lg font-bold leading-tight">{meta.label}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{meta.desc}</p>
        </div>
      </div>

      {/* ── Summary hero ── */}
      <div className={cn("rounded-2xl px-5 py-5", meta.bg, "border border-border/60")}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Total Earned</p>
        <p className={cn("text-3xl font-black tabular-nums", meta.accent)}>
          {fmtUsdt(total)}
          <span className="text-sm font-semibold text-muted-foreground ml-2">USDT</span>
        </p>
        <p className="text-xs text-muted-foreground mt-2">{entries?.length ?? 0} transactions recorded</p>
      </div>

      {/* ── ROI: per-package breakdown ── */}
      {type === "roi" && <RoiPackageBreakdown />}

      {/* ── Transaction list ── */}
      <div className="rounded-2xl border border-border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <p className="text-sm font-bold text-foreground">Transaction History</p>
        </div>

        {isLoading && (
          <div className="px-5 py-4 space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        )}

        {!isLoading && !entries?.length && (
          <div className="px-5 py-12 text-center">
            <div className={cn("w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center", meta.bg)}>
              <Icon className={cn("w-5 h-5", meta.accent)} />
            </div>
            <p className="text-sm font-semibold text-foreground">No transactions yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              {type === "roi" && "Purchase a package to start earning daily Profit Share"}
              {type === "referral" && "Invite users to earn referral commissions"}
              {type === "royalty" && "Royalty income is credited when your uplines withdraw"}
              {type === "rank_reward" && "Achieve a rank to earn one-time rewards"}
            </p>
          </div>
        )}

        {!isLoading && entries && entries.length > 0 && (
          <div className="divide-y divide-border/50">
            {entries.map((entry) => {
              const note = entry.note ?? "";

              // Parse meaningful label from note
              let title = note;
              let subtitle = "";

              if (type === "roi") {
                // "ROI Day 3/30" → "Day 3 of 30"
                const m = note.match(/Day (\d+)\/(\d+)/);
                title = m ? `Day ${m[1]} of ${m[2]}` : note;
                subtitle = "Daily Profit Share credit";
              } else if (type === "referral") {
                // "Level 2 referral commission"
                const m = note.match(/Level (\d+)/);
                title = m ? `Level ${m[1]} Commission` : note;
                subtitle = "Network referral bonus";
              } else if (type === "royalty") {
                // "Royalty day 3 of 15 (level 2)"
                const mDay = note.match(/day (\d+) of (\d+)/i);
                const mLvl = note.match(/level (\d+)/i);
                title = mDay ? `Day ${mDay[1]} of ${mDay[2]}` : note;
                subtitle = mLvl ? `Level ${mLvl[1]} royalty` : "Royalty distribution";
              } else if (type === "rank_reward") {
                // "Rank achievement reward: Bronze Leader"
                const m = note.match(/reward: (.+)/i);
                title = m ? m[1] : note;
                subtitle = "Rank achievement reward";
              }

              return (
                <div key={entry.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3.5">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", meta.bg)}>
                      <Icon className={cn("w-4 h-4", meta.accent)} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3 h-3 text-muted-foreground/60" />
                        <p className="text-[11px] text-muted-foreground">
                          {fmtDate(entry.createdAt)} · {fmtTime(entry.createdAt)}
                        </p>
                      </div>
                      {subtitle && (
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-sm font-black tabular-nums", meta.accent)}>
                      +{fmtUsdt(entry.amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">USDT</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
