import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSubAccounts, useCreateSubAccount, useSwitchSubAccount,
  getGetMeQueryKey, SubAccount, User,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { formatUsdt } from "@/lib/format";
import { User as UserIcon, Copy, ChevronDown, Plus, Users, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  user: User;
  children?: React.ReactNode;
}

function Avatar({ src, name, size = 12 }: { src?: string | null; name?: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = (name ?? "U").split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  const cls = `w-${size} h-${size} rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-primary/20 bg-primary/10`;

  if (src && !err) {
    return (
      <div className={cls}>
        <img src={src} alt={name ?? ""} className="w-full h-full object-cover" onError={() => setErr(true)} />
      </div>
    );
  }
  return (
    <div className={cls}>
      <span className="font-mono font-bold text-primary" style={{ fontSize: size * 4 + "px" }}>{initials}</span>
    </div>
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
          setCreateOpen(false);
          setAlias(""); setFund("");
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
        onError: () => toast.error("Failed to switch account"),
      }
    );
  };

  if (isLoading) return <Skeleton className="h-8 w-full mt-3 rounded-none" />;
  if (!accounts || accounts.length <= 1) {
    return (
      <div className="mt-3">
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
        >
          <Plus className="h-3 w-3" /> Add Sub-Account
        </button>
        <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} alias={alias} setAlias={setAlias} fund={fund} setFund={setFund} onSubmit={handleCreate} loading={createSub.isPending} />
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-1.5">
        <Users className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Accounts</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {accounts.map((acc) => (
          <button
            key={acc.id}
            onClick={() => handleSwitch(acc)}
            disabled={acc.isCurrentAccount || switchSub.isPending}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-none border text-[10px] font-mono transition-all ${
              acc.isCurrentAccount
                ? "border-primary bg-primary/10 text-primary font-bold cursor-default"
                : "border-border bg-background text-muted-foreground hover:border-primary/60 hover:text-foreground"
            }`}
          >
            <Avatar src={acc.telegramPhotoUrl} name={acc.fullName} size={4} />
            {acc.fullName}
            {acc.isCurrentAccount && <Check className="h-2.5 w-2.5" />}
          </button>
        ))}
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-none border border-dashed border-border text-[10px] font-mono text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="h-3 w-3" /> New
        </button>
      </div>
      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} alias={alias} setAlias={setAlias} fund={fund} setFund={setFund} onSubmit={handleCreate} loading={createSub.isPending} />
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
      <DialogContent className="max-w-sm rounded-none">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider text-sm">New Sub-Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Alias</label>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="e.g. Trading Account"
              className="w-full mt-1 px-3 py-2 border border-input bg-background font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary rounded-none"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Initial Fund (USDT, optional)</label>
            <input
              type="number"
              value={fund}
              onChange={(e) => setFund(e.target.value)}
              placeholder="0.00"
              min="0"
              className="w-full mt-1 px-3 py-2 border border-input bg-background font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary rounded-none"
            />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose} className="rounded-none font-mono uppercase text-xs">Cancel</Button>
          <Button onClick={onSubmit} disabled={loading || !alias.trim()} className="rounded-none font-mono uppercase text-xs">
            {loading ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserProfileCard({ user, children }: Props) {
  return (
    <Card className="rounded-none border-primary/40 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar src={user.telegramPhotoUrl} name={user.fullName} size={12} />
            <div>
              <div className="font-mono font-bold text-lg leading-tight">
                {user.fullName || user.email?.split("@")[0] || "User"}
              </div>
              {user.telegramUsername && (
                <div className="font-mono text-xs text-primary/70 mt-0.5">@{user.telegramUsername}</div>
              )}
              <div className="font-mono text-xs text-muted-foreground mt-0.5">{user.email}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Ref:</span>
                <span
                  className="font-mono text-xs text-primary font-bold cursor-pointer hover:underline"
                  onClick={() => { navigator.clipboard.writeText(user.referralCode ?? ""); toast.success("Referral code copied"); }}
                >
                  {user.referralCode}
                  <Copy className="h-3 w-3 inline ml-1 opacity-60" />
                </span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-[10px] text-muted-foreground uppercase mb-0.5">Balance</div>
            <div className="font-mono font-black text-2xl text-primary">{formatUsdt(user.walletBalance)}</div>
            <div className="font-mono text-xs text-muted-foreground">USDT</div>
          </div>
        </div>

        {user.telegramChatId && <SubAccountsPanel currentUserId={user.id} />}

        {children}
      </CardContent>
    </Card>
  );
}
