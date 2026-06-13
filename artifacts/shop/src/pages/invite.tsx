import { useState } from "react";
import { useGetMe, useGetMyNetwork } from "@workspace/api-client-react";
import {
  Copy, Check, Users, Link as LinkIcon, Gift, UserPlus,
  ChevronDown, ChevronRight, TrendingUp, Package, Globe, Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const LEVEL_COLORS: Record<number, { bg: string; text: string; border: string; dot: string }> = {
  1:  { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",   dot: "bg-blue-500" },
  2:  { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200", dot: "bg-violet-500" },
  3:  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200",dot: "bg-emerald-500" },
  4:  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",  dot: "bg-amber-500" },
  5:  { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",   dot: "bg-rose-500" },
  6:  { bg: "bg-cyan-50",    text: "text-cyan-700",    border: "border-cyan-200",   dot: "bg-cyan-500" },
  7:  { bg: "bg-pink-50",    text: "text-pink-700",    border: "border-pink-200",   dot: "bg-pink-500" },
  8:  { bg: "bg-teal-50",    text: "text-teal-700",    border: "border-teal-200",   dot: "bg-teal-500" },
  9:  { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200", dot: "bg-orange-500" },
  10: { bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200", dot: "bg-indigo-500" },
};

function Avatar({ name, photo, size = "md" }: { name?: string | null; photo?: string | null; size?: "sm" | "md" }) {
  const initials = name ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "?";
  const cls = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  if (photo) {
    return <img src={photo} alt={name ?? "user"} className={cn(cls, "rounded-full object-cover shrink-0")} />;
  }
  return (
    <div className={cn(cls, "rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-white font-bold flex items-center justify-center shrink-0")}>
      {initials}
    </div>
  );
}

function LevelRow({ level, count, members, referralIncome }: {
  level: number;
  count: number;
  members: { id: string; fullName?: string | null; telegramUsername?: string | null; telegramPhotoUrl?: string | null; joinedAt: string; investedUsdt: string }[];
  referralIncome?: string;
}) {
  const [open, setOpen] = useState(false);
  const c = LEVEL_COLORS[level] ?? LEVEL_COLORS[1];

  return (
    <div className={cn("rounded-2xl border overflow-hidden transition-all", c.border, open ? c.bg : "bg-white")}>
      {/* Level header — always visible, clickable */}
      <button
        onClick={() => count > 0 && setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
          count === 0 ? "opacity-50 cursor-default" : "cursor-pointer hover:bg-black/[0.02]"
        )}
      >
        {/* Level badge */}
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0", c.bg, c.text, `border ${c.border}`)}>
          L{level}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn("text-sm font-bold", count > 0 ? "text-foreground" : "text-muted-foreground")}>
              Level {level}
            </p>
            {level === 1 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Direct</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {count === 0 ? "No members yet" : `${count} member${count !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Count pill */}
        {count > 0 && (
          <div className={cn("rounded-full px-2.5 py-1 text-xs font-black tabular-nums", c.bg, c.text, `border ${c.border}`)}>
            {count}
          </div>
        )}

        {/* Chevron */}
        {count > 0 && (
          <div className="shrink-0 ml-1">
            {open
              ? <ChevronDown className={cn("w-4 h-4", c.text)} />
              : <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
          </div>
        )}
      </button>

      {/* Members dropdown */}
      {open && count > 0 && (
        <div className="border-t border-current/10 divide-y divide-border/40">
          {members.map((m) => {
            const name = m.fullName || (m.telegramUsername ? `@${m.telegramUsername}` : "Anonymous");
            const invested = parseFloat(m.investedUsdt ?? "0");
            const joinDate = new Date(m.joinedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3.5 bg-white/60">
                <Avatar name={m.fullName} photo={m.telegramPhotoUrl} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">Joined {joinDate}</span>
                    {m.telegramUsername && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-[10px] text-muted-foreground">@{m.telegramUsername}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {invested > 0 ? (
                    <>
                      <p className="text-xs font-black text-emerald-600 tabular-nums">{fmtUsdt(invested)}</p>
                      <p className="text-[9px] text-muted-foreground">USDT invested</p>
                    </>
                  ) : (
                    <span className="text-[10px] font-medium text-muted-foreground/50 border border-border/50 rounded-full px-2 py-0.5">No package</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const APP_PACKAGE = "com.telebit.shop";

function buildDeeplink(origin: string, basePath: string, ref: string) {
  const webPath = `${origin}${basePath}/sign-in?ref=${ref}`;
  // Strip protocol for intent host
  const host = origin.replace(/^https?:\/\//, "");
  const intentPath = `${host}${basePath}/sign-in?ref=${ref}`;
  const deeplink = `intent://${intentPath}#Intent;scheme=https;package=${APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(webPath)};end`;
  return { webLink: webPath, deeplink };
}

export default function InvitePage() {
  const { data: user } = useGetMe();
  const { data: network, isLoading: loadNetwork } = useGetMyNetwork({});
  const [copiedWeb, setCopiedWeb] = useState(false);
  const [copiedApp, setCopiedApp] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const { webLink, deeplink } = user
    ? buildDeeplink(window.location.origin, BASE, user.referralCode)
    : { webLink: "", deeplink: "" };

  const handleCopy = (text: string, setter: (v: boolean) => void, msg: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      toast.success(msg);
      setTimeout(() => setter(false), 2000);
    });
  };

  const handleCopyCode = () => {
    if (!user?.referralCode) return;
    navigator.clipboard.writeText(user.referralCode).then(() => {
      setCodeCopied(true);
      toast.success("Referral code copied!");
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const totalMembers = network?.totalCount ?? 0;
  const directMembers = network?.levels?.[0]?.count ?? 0;
  const activeLevels = network?.levels?.filter((l) => l.count > 0).length ?? 0;

  return (
    <div className="max-w-xl mx-auto">

      {/* ── Dark hero ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 pt-7 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Gift className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Invite Friends</h1>
            <p className="text-xs text-slate-400 mt-0.5">Share your link · Earn 10-level referral income</p>
          </div>
        </div>

        {/* Network stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-3.5 text-center">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Total</p>
            <p className="text-xl font-black text-white tabular-nums">{totalMembers}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Members</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-3.5 text-center">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Direct</p>
            <p className="text-xl font-black text-white tabular-nums">{directMembers}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Level 1</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-3.5 text-center">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Active</p>
            <p className="text-xl font-black text-white tabular-nums">{activeLevels}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Levels</p>
          </div>
        </div>

        {/* Invite links — Website + App */}
        <div className="space-y-3">

          {/* Website link */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Website Link</p>
              <span className="ml-auto text-[10px] text-slate-500">Opens in browser</span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5">
              <span className="flex-1 text-xs font-mono text-slate-300 truncate">
                {webLink || "Loading…"}
              </span>
              <button
                onClick={() => handleCopy(webLink, setCopiedWeb, "Website link copied!")}
                disabled={!webLink}
                className="shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40"
              >
                {copiedWeb
                  ? <Check className="w-4 h-4 text-emerald-400" />
                  : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
            <button
              onClick={() => handleCopy(webLink, setCopiedWeb, "Website link copied!")}
              disabled={!webLink}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors disabled:opacity-50"
            >
              {copiedWeb ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedWeb ? "Copied!" : "Copy Website Link"}
            </button>
          </div>

          {/* App deeplink */}
          <div className="rounded-2xl bg-white/5 border border-emerald-500/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wide">App Link</p>
              <span className="ml-auto text-[10px] text-slate-500">Opens Telebit app</span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5">
              <span className="flex-1 text-xs font-mono text-slate-300 truncate">
                {deeplink
                  ? deeplink.replace(/#Intent.*/, "…")
                  : "Loading…"}
              </span>
              <button
                onClick={() => handleCopy(deeplink, setCopiedApp, "App link copied!")}
                disabled={!deeplink}
                className="shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40"
              >
                {copiedApp
                  ? <Check className="w-4 h-4 text-emerald-400" />
                  : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
            <button
              onClick={() => handleCopy(deeplink, setCopiedApp, "App link copied!")}
              disabled={!deeplink}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors disabled:opacity-50"
            >
              {copiedApp ? <Check className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
              {copiedApp ? "Copied!" : "Copy App Link"}
            </button>
          </div>

        </div>

        {/* Referral code */}
        <div className="mt-3 rounded-2xl bg-white/5 border border-white/10 px-4 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Referral Code</p>
            <p className="text-xl font-black tracking-widest text-white font-mono">
              {user?.referralCode ?? "———"}
            </p>
          </div>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-300 transition-colors"
          >
            {codeCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {codeCopied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* ── Network levels ─────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-24">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Network · 10 Levels</p>
          {totalMembers > 0 && (
            <p className="text-[11px] text-muted-foreground">{totalMembers} total members</p>
          )}
        </div>

        {loadNetwork ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : (
          <div className="space-y-2.5">
            {(network?.levels ?? Array.from({ length: 10 }, (_, i) => ({ level: i + 1, count: 0, members: [] }))).map((lvl) => (
              <LevelRow
                key={lvl.level}
                level={lvl.level}
                count={lvl.count}
                members={lvl.members}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loadNetwork && totalMembers === 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/20 py-10 text-center">
            <UserPlus className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-muted-foreground">No network members yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Share your invite link to start building your team</p>
          </div>
        )}
      </div>
    </div>
  );
}
