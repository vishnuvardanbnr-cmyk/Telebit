import { useState, useEffect } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { Copy, Check, Users, Link as LinkIcon, Gift, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ReferralStats {
  count: number;
  users: { id: string; fullName: string | null; telegramUsername: string | null; joinedAt: string }[];
}

export default function InvitePage() {
  const { data: user } = useGetMe();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const inviteLink = user
    ? `${window.location.origin}${BASE}/sign-in?ref=${user.referralCode}`
    : "";

  useEffect(() => {
    fetch(`${BASE}/api/users/me/referrals`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      toast.success("Invite link copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyCode = () => {
    if (!user?.referralCode) return;
    navigator.clipboard.writeText(user.referralCode).then(() => {
      toast.success("Referral code copied!");
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-5 max-w-2xl pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Gift className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Invite Friends</h1>
          <p className="text-xs text-muted-foreground">Share your link and earn referral rewards</p>
        </div>
      </div>

      {/* Invite link card */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-primary" />
            Your Invite Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-3 py-2.5">
            <span className="flex-1 text-xs font-mono text-muted-foreground truncate">
              {inviteLink || "Loading…"}
            </span>
            <button
              onClick={handleCopyLink}
              disabled={!inviteLink}
              className="flex-shrink-0 p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-40"
              title="Copy link"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>

          <button
            onClick={handleCopyLink}
            disabled={!inviteLink}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy Invite Link"}
          </button>
        </CardContent>
      </Card>

      {/* Referral code card */}
      <Card className="border border-border">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Your referral code</p>
              <p className="text-2xl font-bold tracking-widest text-foreground font-mono">
                {user?.referralCode ?? "———"}
              </p>
            </div>
            <button
              onClick={handleCopyCode}
              disabled={!user?.referralCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-xs font-medium text-muted-foreground disabled:opacity-40"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Stats card */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Referral Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-8 bg-muted/40 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">Total invited</span>
                <span className="text-sm font-bold text-foreground">{stats?.count ?? 0}</span>
              </div>

              {stats && stats.users.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Members</p>
                  {stats.users.map((u) => (
                    <div key={u.id} className="flex items-center gap-2.5 py-2 px-3 rounded-lg bg-muted/30">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <UserPlus className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {u.fullName || (u.telegramUsername ? `@${u.telegramUsername}` : "Anonymous")}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Joined {new Date(u.joinedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-center py-6 text-muted-foreground">
                  <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No referrals yet</p>
                  <p className="text-xs mt-1 opacity-70">Share your link to start earning rewards</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
