import { useState } from "react";
import { Link } from "wouter";
import {
  useListPackages,
  useListMyPackages,
  usePurchasePackage,
  useGetIncomeSummary,
  useGetMe,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  TrendingUp, Package, CheckCircle2, Clock,
  Loader2, Activity, ChevronRight, Wallet,
  Zap, ShieldCheck, ArrowUpRight,
} from "lucide-react";

function PackageProgressBar({ daysCredited, totalRoiDays }: { daysCredited: number; totalRoiDays: number }) {
  const pct = Math.min(100, (daysCredited / totalRoiDays) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] text-slate-400">
        <span>Day {daysCredited} of {totalRoiDays}</span>
        <span className="font-semibold text-slate-300">{pct.toFixed(0)}% complete</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function PackagesPage() {
  const { data: user } = useGetMe();
  const { data: packages, isLoading: loadPkgs } = useListPackages({});
  const { data: myPackages, isLoading: loadMyPkgs } = useListMyPackages({});
  const { data: summary } = useGetIncomeSummary({});
  const purchase = usePurchasePackage();
  const [buying, setBuying] = useState<string | null>(null);

  const walletBalance = parseFloat(user?.walletBalance ?? "0");
  const activePackages = myPackages?.filter((p) => p.isActive) ?? [];
  const completedPackages = myPackages?.filter((p) => !p.isActive) ?? [];
  const totalInvested = myPackages?.reduce((s, p) => s + parseFloat(p.principalUsdt), 0) ?? 0;
  const totalEarned =
    parseFloat(summary?.roi ?? "0") +
    parseFloat(summary?.referral ?? "0") +
    parseFloat(summary?.royalty ?? "0") +
    parseFloat(summary?.rankReward ?? "0");

  const handleBuy = (pkgId: string, price: string) => {
    if (parseFloat(price) > walletBalance) {
      toast.error(`Insufficient balance — deposit ${fmtUsdt(parseFloat(price) - walletBalance)} more USDT to purchase`);
      return;
    }
    setBuying(pkgId);
    purchase.mutate(
      { data: { packageId: pkgId } },
      {
        onSuccess: () => { toast.success("Package purchased! ROI will be credited daily."); setBuying(null); },
        onError: (err: any) => { toast.error(err?.message ?? "Failed to purchase package"); setBuying(null); },
      }
    );
  };

  return (
    <div className="max-w-xl mx-auto">

      {/* ── Dark hero ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 pt-7 pb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Portfolio</p>
            <h1 className="text-2xl font-black text-white leading-tight">Invest</h1>
          </div>
          <Link href="/income">
            <button className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl px-3 py-2 transition-colors">
              <TrendingUp className="w-3.5 h-3.5" />
              View Income
              <ChevronRight className="w-3 h-3" />
            </button>
          </Link>
        </div>

        {/* Portfolio stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-3.5 text-center">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Invested</p>
            <p className="text-lg font-black text-white tabular-nums leading-none">{fmtUsdt(totalInvested)}</p>
            <p className="text-[10px] text-slate-500 mt-1">USDT</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-3.5 text-center">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Active</p>
            <p className="text-lg font-black text-white tabular-nums leading-none">{activePackages.length}</p>
            <p className="text-[10px] text-slate-500 mt-1">Packages</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-3.5 text-center">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Wallet</p>
            <p className="text-lg font-black text-white tabular-nums leading-none">{fmtUsdt(walletBalance)}</p>
            <p className="text-[10px] text-slate-500 mt-1">USDT</p>
          </div>
        </div>

        {/* Total income earned link */}
        <Link href="/income">
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3.5 cursor-pointer hover:bg-emerald-500/15 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-300">Total Income Earned</p>
                <p className="text-[10px] text-slate-500 mt-0.5">ROI · Referral · Royalty · Rewards</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-base font-black text-emerald-400 tabular-nums">{fmtUsdt(totalEarned)}</p>
              <p className="text-[10px] text-slate-500">USDT</p>
            </div>
          </div>
        </Link>
      </div>

      {/* ── Active packages ────────────────────────────────────── */}
      {(loadMyPkgs || activePackages.length > 0) && (
        <div className="px-5 pt-6 pb-2">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Active Packages
          </p>

          {loadMyPkgs ? (
            <Skeleton className="h-28 rounded-2xl" />
          ) : (
            <div className="space-y-3">
              {activePackages.map((p, i) => {
                const daily = (parseFloat(p.principalUsdt) * parseFloat(p.roiPercent)) / 100;
                return (
                  <div key={p.id} className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">${parseFloat(p.principalUsdt).toFixed(0)} Package</p>
                          <p className="text-[11px] text-slate-400">{p.roiPercent}% daily · {p.totalRoiDays} days</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-emerald-400 tabular-nums">+{fmtUsdt(daily)}</p>
                        <p className="text-[10px] text-slate-500">per day</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-white/5 px-3 py-2">
                        <p className="text-[10px] text-slate-500">ROI Credited</p>
                        <p className="text-xs font-bold text-white tabular-nums">{fmtUsdt(p.totalRoiCredited)} USDT</p>
                      </div>
                      <div className="rounded-xl bg-white/5 px-3 py-2">
                        <p className="text-[10px] text-slate-500">Remaining</p>
                        <p className="text-xs font-bold text-white tabular-nums">{p.totalRoiDays - p.daysCredited} days left</p>
                      </div>
                    </div>
                    <PackageProgressBar daysCredited={p.daysCredited} totalRoiDays={p.totalRoiDays} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Available packages ─────────────────────────────────── */}
      <div className="px-5 pt-6 pb-24">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Available Packages
        </p>

        {loadPkgs && (
          <div className="space-y-4">
            <Skeleton className="h-52 rounded-3xl" />
          </div>
        )}

        {packages?.map((pkg) => {
          const price = parseFloat(pkg.priceUsdt);
          const canAfford = walletBalance >= price;
          const isBuying = buying === pkg.id;
          const dailyRoi = (price * parseFloat(pkg.roiPercent) / 100);
          const totalReturn = dailyRoi * pkg.roiDays;
          const returnMultiple = ((totalReturn / price) * 100).toFixed(0);

          return (
            <div key={pkg.id} className="rounded-3xl overflow-hidden border border-border bg-white shadow-sm mb-4">

              {/* Card header — gradient band */}
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 pt-5 pb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                        <Zap className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-xs font-bold text-white/70 uppercase tracking-wide">Investment Package</span>
                    </div>
                    <h3 className="text-xl font-black text-white">{pkg.name}</h3>
                    <p className="text-xs text-white/60 mt-0.5">One-time · Earn daily returns</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-white tabular-nums">{fmtUsdt(pkg.priceUsdt)}</p>
                    <p className="text-xs text-white/60">USDT</p>
                  </div>
                </div>

                {/* Return highlight */}
                <div className="mt-4 rounded-2xl bg-white/10 border border-white/20 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-white/70" />
                    <span className="text-sm font-semibold text-white/80">Total ROI Return</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-emerald-300 tabular-nums">+{fmtUsdt(totalReturn)} USDT</span>
                    <p className="text-[10px] text-white/50">{returnMultiple}% total yield</p>
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div className="px-5 py-4 space-y-4">

                {/* Key metrics */}
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: "Daily ROI", value: `${pkg.roiPercent}%`, sub: "per day" },
                    { label: "Duration", value: `${pkg.roiDays}`, sub: "days" },
                    { label: "Daily Earn", value: `$${dailyRoi.toFixed(2)}`, sub: "USDT/day" },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-3 text-center">
                      <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
                      <p className="text-base font-black text-foreground tabular-nums mt-0.5">{value}</p>
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">{sub}</p>
                    </div>
                  ))}
                </div>

                {/* Trust badges */}
                <div className="flex items-center gap-4 py-1">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[11px] text-muted-foreground font-medium">Capital protected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[11px] text-muted-foreground font-medium">Auto-credited daily</span>
                  </div>
                </div>

                {/* Wallet balance check */}
                {!canAfford ? (
                  <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                    <Wallet className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-800">Insufficient balance</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Deposit {fmtUsdt(price - walletBalance)} more USDT to purchase this package
                      </p>
                    </div>
                    <Link href="/wallet">
                      <span className="text-xs font-bold text-amber-700 border border-amber-300 bg-amber-100 hover:bg-amber-200 rounded-lg px-2.5 py-1.5 whitespace-nowrap transition-colors">
                        Top up
                      </span>
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <p className="text-xs font-semibold text-emerald-800">Ready to invest — you have sufficient balance</p>
                  </div>
                )}

                <Button
                  className={cn(
                    "w-full h-13 rounded-2xl font-bold text-sm transition-all",
                    canAfford
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-200"
                      : "bg-muted text-muted-foreground"
                  )}
                  disabled={!canAfford || isBuying || purchase.isPending}
                  onClick={() => handleBuy(pkg.id, pkg.priceUsdt)}
                >
                  {isBuying ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
                  ) : (
                    <><Zap className="w-4 h-4 mr-2" /> Buy Package · {fmtUsdt(pkg.priceUsdt)} USDT</>
                  )}
                </Button>
              </div>
            </div>
          );
        })}

        {/* Completed packages */}
        {completedPackages.length > 0 && (
          <div className="mt-2">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Completed</p>
            <div className="space-y-2">
              {completedPackages.map((p) => (
                <div key={p.id} className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3.5 flex items-center justify-between opacity-70">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">${parseFloat(p.principalUsdt).toFixed(0)} Package</p>
                      <p className="text-[11px] text-muted-foreground">{p.roiPercent}%/day · {p.totalRoiDays} days</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-foreground tabular-nums">{fmtUsdt(p.totalRoiCredited)}</p>
                    <p className="text-[10px] text-muted-foreground">total earned</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
