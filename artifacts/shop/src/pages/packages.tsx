import { useState } from "react";
import {
  useListPackages,
  useListMyPackages,
  usePurchasePackage,
  useGetIncomeSummary,
  useListIncome,
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
  Loader2, ChevronRight, Activity, Users, Crown,
  ArrowUpRight, Calendar,
} from "lucide-react";

function IncomeTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    roi: { label: "ROI", cls: "bg-green-100 text-green-700 border-green-200" },
    referral: { label: "Referral", cls: "bg-blue-100 text-blue-700 border-blue-200" },
    royalty: { label: "Royalty", cls: "bg-purple-100 text-purple-700 border-purple-200" },
  };
  const meta = map[type] ?? { label: type, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", meta.cls)}>
      {meta.label}
    </span>
  );
}

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
  const { data: summary, isLoading: loadSummary } = useGetIncomeSummary({});
  const { data: income, isLoading: loadIncome } = useListIncome({ limit: 30, offset: 0 });
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

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Packages & Income</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Buy packages to earn daily ROI, referral & royalty income</p>
      </div>

      {/* Income summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {loadSummary ? (
          <>
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </>
        ) : (
          <>
            <div className="rounded-2xl bg-green-50 border border-green-100 p-3 text-center">
              <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-[10px] text-green-700 font-semibold uppercase tracking-wide">ROI</p>
              <p className="text-sm font-bold text-green-800">{fmtUsdt(summary?.roi ?? "0")}</p>
            </div>
            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-3 text-center">
              <Users className="w-4 h-4 text-blue-600 mx-auto mb-1" />
              <p className="text-[10px] text-blue-700 font-semibold uppercase tracking-wide">Referral</p>
              <p className="text-sm font-bold text-blue-800">{fmtUsdt(summary?.referral ?? "0")}</p>
            </div>
            <div className="rounded-2xl bg-purple-50 border border-purple-100 p-3 text-center">
              <Crown className="w-4 h-4 text-purple-600 mx-auto mb-1" />
              <p className="text-[10px] text-purple-700 font-semibold uppercase tracking-wide">Royalty</p>
              <p className="text-sm font-bold text-purple-800">{fmtUsdt(summary?.royalty ?? "0")}</p>
            </div>
          </>
        )}
      </div>

      {/* Stats row */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-2xl bg-card border border-border p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Active Packages</p>
          <p className="text-lg font-black text-foreground">{activeCount}</p>
        </div>
        <div className="flex-1 rounded-2xl bg-card border border-border p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Total Invested</p>
          <p className="text-lg font-black text-foreground">{fmtUsdt(totalInvested)} <span className="text-xs font-normal">USDT</span></p>
        </div>
        <div className="flex-1 rounded-2xl bg-card border border-border p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Wallet</p>
          <p className="text-lg font-black text-foreground">{fmtUsdt(walletBalance)} <span className="text-xs font-normal">USDT</span></p>
        </div>
      </div>

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
              {/* Package header */}
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

              {/* Key stats */}
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

              {/* Total return */}
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

      {/* Income history */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Income History</h2>
        {loadIncome && <Skeleton className="h-16 rounded-2xl" />}
        {!loadIncome && !income?.length && (
          <div className="py-10 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-muted-foreground/25" />
            <p className="text-sm text-muted-foreground">No income yet — buy a package to start earning</p>
          </div>
        )}
        <div className="space-y-2">
          {income?.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-card">
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                entry.type === "roi" ? "bg-green-100" :
                entry.type === "referral" ? "bg-blue-100" : "bg-purple-100"
              )}>
                {entry.type === "roi" && <TrendingUp className="w-3.5 h-3.5 text-green-600" />}
                {entry.type === "referral" && <Users className="w-3.5 h-3.5 text-blue-600" />}
                {entry.type === "royalty" && <Crown className="w-3.5 h-3.5 text-purple-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <IncomeTypeBadge type={entry.type} />
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
                {entry.note && <p className="text-[11px] text-muted-foreground truncate">{entry.note}</p>}
              </div>
              <span className="text-sm font-bold text-green-600 tabular-nums shrink-0">
                +{fmtUsdt(entry.amount)} USDT
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
