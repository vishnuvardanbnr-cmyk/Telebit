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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  TrendingUp, Package, CheckCircle2, Clock, Star,
  Loader2, Activity, ChevronRight,
} from "lucide-react";

function PackageProgressBar({ daysCredited, totalRoiDays }: { daysCredited: number; totalRoiDays: number }) {
  const pct = Math.min(100, (daysCredited / totalRoiDays) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Day {daysCredited} of {totalRoiDays}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
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

  const handleBuy = (pkgId: string, price: string) => {
    if (parseFloat(price) > walletBalance) {
      toast.error(`Insufficient balance. You need ${fmtUsdt(price)} USDT in your wallet.`);
      return;
    }
    setBuying(pkgId);
    purchase.mutate(
      { data: { packageId: pkgId } },
      {
        onSuccess: () => {
          toast.success("Package purchased! ROI will be credited daily.");
          setBuying(null);
        },
        onError: (err: any) => {
          toast.error(err?.message ?? "Failed to purchase package");
          setBuying(null);
        },
      }
    );
  };

  const activeCount = myPackages?.filter((p) => p.isActive).length ?? 0;
  const totalInvested = myPackages?.reduce((s, p) => s + parseFloat(p.principalUsdt), 0) ?? 0;
  const totalEarned = parseFloat(summary?.roi ?? "0")
    + parseFloat(summary?.referral ?? "0")
    + parseFloat(summary?.royalty ?? "0")
    + parseFloat(summary?.rankReward ?? "0");

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Invest</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Purchase packages to earn daily ROI returns</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-card border border-border p-3 text-center">
          <p className="text-[11px] text-muted-foreground mb-0.5">Active</p>
          <p className="text-xl font-black text-foreground">{activeCount}</p>
          <p className="text-[10px] text-muted-foreground">Packages</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-3 text-center">
          <p className="text-[11px] text-muted-foreground mb-0.5">Invested</p>
          <p className="text-lg font-black text-foreground tabular-nums">{fmtUsdt(totalInvested)}</p>
          <p className="text-[10px] text-muted-foreground">USDT</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-3 text-center">
          <p className="text-[11px] text-muted-foreground mb-0.5">Wallet</p>
          <p className="text-lg font-black text-foreground tabular-nums">{fmtUsdt(walletBalance)}</p>
          <p className="text-[10px] text-muted-foreground">USDT</p>
        </div>
      </div>

      {/* Income summary CTA */}
      <Link href="/income">
        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 px-5 py-4 cursor-pointer hover:from-emerald-100 hover:to-teal-100 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-900">Total Income Earned</p>
              <p className="text-xs text-emerald-700 mt-0.5">ROI · Referral · Royalty · Rewards</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-lg font-black text-emerald-700 tabular-nums">{fmtUsdt(totalEarned)}</p>
              <p className="text-[10px] text-emerald-600 font-medium">USDT</p>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
        </div>
      </Link>

      {/* Available packages */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Available Packages</h2>
        {loadPkgs && <Skeleton className="h-40 rounded-2xl" />}
        {packages?.map((pkg) => {
          const price = parseFloat(pkg.priceUsdt);
          const canAfford = walletBalance >= price;
          const isBuying = buying === pkg.id;
          const dailyRoi = (price * parseFloat(pkg.roiPercent) / 100).toFixed(4);
          const totalReturn = (price * parseFloat(pkg.roiPercent) / 100 * pkg.roiDays).toFixed(2);

          return (
            <div key={pkg.id} className="rounded-3xl border border-border bg-card p-5 space-y-4 mb-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                    <h3 className="font-black text-base">{pkg.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">One-time investment · Earn daily returns</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-primary">{fmtUsdt(pkg.priceUsdt)}</p>
                  <p className="text-xs text-muted-foreground">USDT</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Daily ROI", value: `${pkg.roiPercent}%` },
                  { label: "Duration", value: `${pkg.roiDays} days` },
                  { label: "Daily Earn", value: `$${dailyRoi}` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/40 rounded-xl p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="text-sm font-bold">{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Total ROI Return</span>
                </div>
                <span className="text-base font-black text-green-600">+${totalReturn} USDT</span>
              </div>

              {!canAfford && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Insufficient balance — deposit {fmtUsdt(price - walletBalance)} more USDT to purchase
                </p>
              )}

              <Button
                className="w-full h-12 rounded-2xl font-bold text-sm"
                disabled={!canAfford || isBuying || purchase.isPending}
                onClick={() => handleBuy(pkg.id, pkg.priceUsdt)}
              >
                {isBuying ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
                ) : (
                  <><Package className="w-4 h-4 mr-2" /> Buy Package · {fmtUsdt(pkg.priceUsdt)} USDT</>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {/* My active packages */}
      {(myPackages?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">My Packages</h2>
          {loadMyPkgs && <Skeleton className="h-24 rounded-2xl" />}
          <div className="space-y-3">
            {myPackages?.map((p) => (
              <div key={p.id} className={cn(
                "rounded-2xl border p-4 space-y-3",
                p.isActive ? "border-border bg-card" : "border-border/50 bg-muted/20 opacity-60"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {p.isActive
                      ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                      : <Clock className="w-4 h-4 text-muted-foreground" />}
                    <span className="font-semibold text-sm">
                      ${parseFloat(p.principalUsdt).toFixed(0)} Package
                    </span>
                  </div>
                  <Badge variant="outline" className={p.isActive ? "text-green-700 border-green-300 bg-green-50" : ""}>
                    {p.isActive ? "Active" : "Completed"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>ROI Credited: <strong className="text-foreground">{fmtUsdt(p.totalRoiCredited)} USDT</strong></span>
                  <span>Daily: <strong className="text-foreground">{p.roiPercent}%</strong></span>
                </div>
                <PackageProgressBar daysCredited={p.daysCredited} totalRoiDays={p.totalRoiDays} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
