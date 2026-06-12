import { useListRanks, useGetMyRankProgress } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Trophy, Lock, CheckCircle2, ChevronRight,
  TrendingUp, Users, Crown, Star, Gem, Award,
} from "lucide-react";

const RANK_ICONS = [Trophy, Star, Gem, Crown, Award, Trophy, Star, Crown, Gem, Award];
const RANK_GRADIENTS = [
  "from-amber-700 to-yellow-500",      // Bronze
  "from-slate-400 to-slate-300",       // Silver
  "from-yellow-500 to-amber-400",      // Gold
  "from-slate-600 to-cyan-400",        // Platinum
  "from-sky-500 to-blue-400",          // Diamond
  "from-blue-700 to-blue-400",         // Blue Diamond
  "from-violet-600 to-purple-400",     // Crown Diamond
  "from-rose-600 to-pink-400",         // Royal Ambassador
  "from-orange-600 to-amber-400",      // Global Chairman
  "from-emerald-700 to-green-400",     // Legacy Chairman
];

function RadialProgress({ pct, size = 64 }: { pct: number; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={4}
        className="text-muted/30" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={4}
        className="text-primary" fill="none"
        strokeDasharray={circ} strokeDashoffset={dashOffset}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

function VolumeBar({ label, value, cap, color }: { label: string; value: number; cap: number; color: string }) {
  const pct = cap > 0 ? Math.min(100, (value / cap) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-bold text-foreground tabular-nums">
          {fmtUsdt(value)} / {fmtUsdt(cap)} <span className="text-muted-foreground font-normal">USDT</span>
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function RanksPage() {
  const { data: ranks, isLoading: loadRanks } = useListRanks({});
  const { data: progress, isLoading: loadProgress } = useGetMyRankProgress({});

  const currentRank = progress?.currentRank;
  const nextRank = progress?.nextRank;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Ranks & Rewards</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Grow your network volume to advance ranks and earn one-time rewards
        </p>
      </div>

      {/* Current rank hero */}
      {loadProgress ? (
        <Skeleton className="h-32 rounded-3xl" />
      ) : (
        <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground px-6 py-6 shadow-lg">
          <p className="text-xs font-semibold opacity-70 uppercase tracking-widest mb-1">Current Rank</p>
          <div className="flex items-center gap-3 mb-4">
            {currentRank ? (
              <>
                <div className={cn(
                  "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-inner shrink-0",
                  RANK_GRADIENTS[(ranks?.findIndex((r) => r.id === currentRank.id) ?? 0)]
                )}>
                  {(() => { const I = RANK_ICONS[(ranks?.findIndex((r) => r.id === currentRank.id) ?? 0) % RANK_ICONS.length]; return <I className="w-6 h-6 text-white" />; })()}
                </div>
                <div>
                  <p className="text-2xl font-black">{currentRank.name}</p>
                  <p className="text-sm opacity-75">Reward received: {fmtUsdt(currentRank.rewardUsdt)} USDT</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                  <Lock className="w-6 h-6 opacity-60" />
                </div>
                <div>
                  <p className="text-2xl font-black">Unranked</p>
                  <p className="text-sm opacity-75">Start growing your network to earn ranks</p>
                </div>
              </>
            )}
          </div>

          {nextRank && progress && (
            <>
              <p className="text-xs opacity-70 mb-2">Next: <strong className="opacity-100">{nextRank.name}</strong></p>
              {(() => {
                const p = progress.progress.find((x) => x.rank.id === nextRank.id);
                if (!p) return null;
                const target = parseFloat(nextRank.targetUsdt);
                return (
                  <div>
                    <div className="flex justify-between text-xs mb-1 opacity-80">
                      <span>{fmtUsdt(p.qualifyingVolume)} / {fmtUsdt(target)} USDT qualifying volume</span>
                      <span className="font-bold">{p.progressPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all"
                        style={{ width: `${p.progressPct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {!nextRank && currentRank && (
            <p className="text-sm font-semibold opacity-90">🎉 You've reached the highest rank!</p>
          )}
        </div>
      )}

      {/* How it works */}
      <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-4 space-y-2">
        <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">How Volume is Calculated</p>
        <div className="space-y-1.5 text-xs text-blue-700">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">P1</span>
            <span><strong>Power Leg 1</strong> (biggest tree) — contributes up to <strong>40%</strong> of target</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">P2</span>
            <span><strong>Power Leg 2</strong> (second biggest) — contributes up to <strong>30%</strong> of target</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">OL</span>
            <span><strong>Other Legs</strong> (all remaining combined) — contribute up to <strong>30%</strong> of target</span>
          </div>
        </div>
      </div>

      {/* Detailed progress for next rank */}
      {!loadProgress && nextRank && progress && (
        (() => {
          const p = progress.progress.find((x) => x.rank.id === nextRank.id);
          if (!p) return null;
          const target = parseFloat(nextRank.targetUsdt);
          return (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Next Rank Breakdown</p>
                <span className="text-xs text-muted-foreground">{nextRank.name}</span>
              </div>
              <div className="space-y-3">
                <VolumeBar
                  label="P1 — Power Leg 1 (max 40%)"
                  value={p.breakdown.p1}
                  cap={target * 0.4}
                  color="bg-green-500"
                />
                <VolumeBar
                  label="P2 — Power Leg 2 (max 30%)"
                  value={p.breakdown.p2}
                  cap={target * 0.3}
                  color="bg-blue-500"
                />
                <VolumeBar
                  label="Other Legs combined (max 30%)"
                  value={p.breakdown.others}
                  cap={target * 0.3}
                  color="bg-purple-500"
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs font-semibold text-muted-foreground">Qualifying Volume</span>
                <span className="text-sm font-black text-primary">
                  {fmtUsdt(p.qualifyingVolume)} / {fmtUsdt(target)} USDT
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                <span className="text-xs font-semibold text-amber-800">Rank Reward</span>
                <span className="text-sm font-black text-amber-700">+{fmtUsdt(nextRank.rewardUsdt)} USDT</span>
              </div>
            </div>
          );
        })()
      )}

      {/* All ranks list */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">All Ranks</h2>
        {(loadRanks || loadProgress) && (
          <div className="space-y-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        )}
        <div className="space-y-2">
          {ranks?.map((rank, idx) => {
            const p = progress?.progress.find((x) => x.rank.id === rank.id);
            const achieved = p?.achieved ?? false;
            const pct = p?.progressPct ?? 0;
            const Icon = RANK_ICONS[idx % RANK_ICONS.length];
            const grad = RANK_GRADIENTS[idx];
            return (
              <div key={rank.id} className={cn(
                "rounded-2xl border p-4 transition-all",
                achieved
                  ? "border-green-200 bg-green-50/50"
                  : "border-border bg-card"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0",
                    achieved ? grad : "from-muted to-muted/60"
                  )}>
                    {achieved
                      ? <Icon className="w-5 h-5 text-white" />
                      : <Lock className="w-4 h-4 text-muted-foreground" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={cn("font-bold text-sm", achieved ? "text-foreground" : "text-muted-foreground")}>
                        {rank.name}
                      </p>
                      {achieved && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Target: <strong className="text-foreground">{fmtUsdt(rank.targetUsdt)}</strong> USDT</span>
                      <span className="text-amber-600 font-semibold">+{fmtUsdt(rank.rewardUsdt)} USDT reward</span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {achieved ? (
                      <span className="text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-2 py-1 rounded-full">
                        Achieved
                      </span>
                    ) : (
                      <div className="relative flex items-center justify-center">
                        <RadialProgress pct={pct} size={44} />
                        <span className="absolute text-[9px] font-black text-foreground">{Math.round(pct)}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar for unachieved */}
                {!achieved && pct > 0 && (
                  <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
