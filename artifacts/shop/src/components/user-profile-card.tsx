import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSubAccounts, useCreateSubAccount, useSwitchSubAccount,
  getGetMeQueryKey, SubAccount, User,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { fmtUsdt } from "@/lib/utils";
import { Copy, Plus, Users, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  user: User;
  children?: React.ReactNode;
}

export function Avatar({ src, name, size = 12 }: { src?: string | null; name?: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = (name ?? "U").split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  const sizePx = size * 4;
  const style = { width: sizePx + "px", height: sizePx + "px", minWidth: sizePx + "px" };

  if (src && !err) {
    return (
      <div style={style} className="rounded-full overflow-hidden border border-primary/20 bg-primary/10 shrink-0">
        <img src={src} alt={name ?? ""} className="w-full h-full object-cover" onError={() => setErr(true)} />
      </div>
    );
  }
  return (
    <div style={style} className="rounded-full overflow-hidden border border-primary/20 bg-primary/10 shrink-0 flex items-center justify-center">
      <span className="font-bold text-primary" style={{ fontSize: Math.max(10, sizePx * 0.4) + "px" }}>{initials}</span>
    </div>
  );
}

function CreateDialog({ open, onClose, alias, setAlias, fund, setFund, onSubmit, loading }: {
  open: boolean; onClose: () => void;
  alias: string; setAlias: (v: string) => void;
  fund: string; setFund: (v: string) => void;
  onSubmit: () => void; loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">New Sub-Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground uppercase font-medium tracking-wide">Alias</label>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="e.g. Trading Account"
              className="w-full mt-1 px-3 py-2 border border-input bg-background text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase font-medium tracking-wide">Initial Fund (USDT, optional)</label>
            <input
              type="number"
              value={fund}
              onChange={(e) => setFund(e.target.value)}
              placeholder="0.00"
              min="0"
              className="w-full mt-1 px-3 py-2 border border-input bg-background text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose} className="rounded-full text-xs">Cancel</Button>
          <Button onClick={onSubmit} disabled={loading || !alias.trim()} className="rounded-full text-xs">
            {loading ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubAccountsPanel({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const { data: accounts, isLoading } = useListSubAccounts();
  const createSub = useCreateSubAccount();
  const switchSub = useSwitchSubAccount();

  const [createOpen, setCreateOpen] = useState(false);
  const [alias, setAlias] = useState("");
  const [fund, setFund] = useState("");

  const handleCreate = () => {
    if (!alias.trim()) { toast.error("Alias is required"); return; }
    createSub.mutate(
      { data: { alias: alias.trim(), initialFund: fund ? parseFloat(fund) : undefined } },
      {
        onSuccess: () => {
          toast.success("Sub-account created");
          setCreateOpen(false); setAlias(""); setFund("");
          qc.invalidateQueries({ queryKey: ["listSubAccounts"] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed to create"),
      }
    );
  };

  const handleSwitch = (acc: SubAccount) => {
    if (acc.isCurrentAccount) return;
    switchSub.mutate(
      { accountId: acc.id },
      {
        onSuccess: (newUser) => {
          qc.setQueryData(getGetMeQueryKey(), newUser);
          qc.invalidateQueries();
          toast.success(`Switched to ${acc.fullName}`);
        },
        onError: () => toast.error("Failed to switch"),
      }
    );
  };

  if (isLoading) return <Skeleton className="h-8 w-full mt-3 rounded-lg" />;

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Sub-Accounts</span>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 text-[10px] text-primary font-semibold hover:underline"
        >
          <Plus className="h-3 w-3" /> New
        </button>
      </div>

      {accounts && accounts.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => handleSwitch(acc)}
              disabled={acc.isCurrentAccount || switchSub.isPending}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] transition-all ${
                acc.isCurrentAccount
                  ? "border-primary bg-primary/10 text-primary font-semibold cursor-default"
                  : "border-border bg-background text-muted-foreground hover:border-primary/60 hover:text-foreground"
              }`}
            >
              <Avatar src={acc.telegramPhotoUrl} name={acc.fullName} size={4} />
              {acc.fullName}
              {acc.isCurrentAccount && <Check className="h-3 w-3" />}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">No sub-accounts yet. Tap New to create one.</p>
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} alias={alias} setAlias={setAlias} fund={fund} setFund={setFund} onSubmit={handleCreate} loading={createSub.isPending} />
    </div>
  );
}

export function UserProfileCard({ user, children }: Props) {
  return (
    <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar src={user.telegramPhotoUrl} name={user.fullName} size={12} />
            <div>
              <div className="font-bold text-lg leading-tight">
                {user.fullName || user.email?.split("@")[0] || "User"}
              </div>
              {user.telegramUsername && (
                <div className="text-xs text-primary/70 mt-0.5">@{user.telegramUsername}</div>
              )}
              <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[160px]">{user.email}</div>
              {user.referralCode && (
                <button
                  className="flex items-center gap-1 mt-1.5 text-[11px] text-primary font-medium hover:underline"
                  onClick={() => { navigator.clipboard.writeText(user.referralCode ?? ""); toast.success("Referral code copied"); }}
                >
                  Ref: {user.referralCode} <Copy className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-muted-foreground uppercase mb-0.5">Balance</div>
            <div className="font-black text-2xl text-primary leading-tight">{fmtUsdt(user.walletBalance)}</div>
            <div className="text-[11px] text-muted-foreground">USDT</div>
          </div>
        </div>

        {user.telegramChatId && <SubAccountsPanel currentUserId={user.id} />}

        {children}
      </CardContent>
    </Card>
  );
}
