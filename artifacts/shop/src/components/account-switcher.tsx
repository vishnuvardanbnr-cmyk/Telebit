import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSubAccounts,
  useCreateSubAccount,
  useSwitchSubAccount,
  getGetMeQueryKey,
  SubAccount,
  User,
} from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Plus, LogOut, ShieldCheck } from "lucide-react";
import { fmtUsdt } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "wouter";

function Avatar({ src, name, size = 28 }: { src?: string | null; name?: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = (name ?? "U").replace(/\s+/g, " ").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "U";
  const s = { width: size, height: size, minWidth: size };
  if (src && !err) {
    return (
      <div style={s} className="rounded-full overflow-hidden bg-primary/10 border border-primary/20 shrink-0">
        <img src={src} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} />
      </div>
    );
  }
  return (
    <div style={{ ...s, fontSize: size * 0.35 }} className="rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shrink-0 text-white font-bold">
      {initials}
    </div>
  );
}

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const createSub = useCreateSubAccount();
  const [alias, setAlias] = useState("");
  const [fund, setFund] = useState("");

  const handleCreate = () => {
    if (!alias.trim()) { toast.error("Alias required"); return; }
    createSub.mutate(
      { data: { alias: alias.trim(), initialFund: fund ? parseFloat(fund) : undefined } },
      {
        onSuccess: () => {
          toast.success("Sub-account created");
          setAlias(""); setFund(""); onClose();
          qc.invalidateQueries({ queryKey: ["listSubAccounts"] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">New Sub-Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground uppercase font-medium tracking-wide">Alias</label>
            <input value={alias} onChange={e => setAlias(e.target.value)} placeholder="e.g. Trading Account"
              className="w-full mt-1 px-3 py-2 border border-input bg-background text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase font-medium tracking-wide">Initial Fund (USDT, optional)</label>
            <input type="number" value={fund} onChange={e => setFund(e.target.value)} placeholder="0.00" min="0"
              className="w-full mt-1 px-3 py-2 border border-input bg-background text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </div>
        <DialogFooter className="mt-1">
          <Button variant="outline" onClick={onClose} className="rounded-full text-xs">Cancel</Button>
          <Button onClick={handleCreate} disabled={createSub.isPending || !alias.trim()} className="rounded-full text-xs">
            {createSub.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AccountSwitcher({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const qc = useQueryClient();
  const { data: accounts } = useListSubAccounts({ query: { enabled: !!user.telegramChatId, queryKey: ["listSubAccounts", user.id] } });
  const switchSub = useSwitchSubAccount();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSwitch = (acc: SubAccount) => {
    if (acc.isCurrentAccount) return;
    switchSub.mutate(
      { accountId: acc.id },
      {
        onSuccess: newUser => {
          qc.setQueryData(getGetMeQueryKey(), newUser);
          qc.invalidateQueries();
          toast.success(`Switched to ${acc.fullName}`);
          setOpen(false);
        },
        onError: () => toast.error("Failed to switch"),
      }
    );
  };

  const displayName = user.fullName || user.telegramUsername || user.email?.split("@")[0] || "Account";

  return (
    <div className="relative" ref={ref}>
      {/* Trigger pill */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/60 hover:bg-muted transition-colors"
      >
        <Avatar src={user.telegramPhotoUrl} name={displayName} size={26} />
        <span className="hidden sm:block text-xs font-semibold max-w-[90px] truncate text-foreground">{displayName}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-68 bg-white border border-border rounded-2xl shadow-xl z-50 overflow-hidden" style={{ width: 270 }}>
          {/* Profile header */}
          <div className="px-4 py-3.5 bg-gradient-to-br from-primary/5 to-primary/10 border-b border-border">
            <div className="flex items-center gap-3">
              <Avatar src={user.telegramPhotoUrl} name={displayName} size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm truncate">{displayName}</p>
                {user.telegramUsername
                  ? <p className="text-[11px] text-primary/70">@{user.telegramUsername}</p>
                  : <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                }
              </div>
            </div>
            {/* Balance chip */}
            <div className="mt-2.5 flex items-center justify-between bg-white/70 rounded-xl px-3 py-2">
              <span className="text-[11px] text-muted-foreground font-medium">Wallet Balance</span>
              <span className="text-xs font-extrabold text-foreground">{fmtUsdt(user.walletBalance)} USDT</span>
            </div>
          </div>

          {/* Sub-account switcher (Telegram users with multiple accounts) */}
          {accounts && accounts.length > 1 && (
            <div className="py-1.5 border-b border-border">
              <p className="px-4 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Switch Account</p>
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => handleSwitch(acc)}
                  disabled={acc.isCurrentAccount || switchSub.isPending}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                    acc.isCurrentAccount
                      ? "bg-primary/5 text-primary cursor-default"
                      : "hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <Avatar src={acc.telegramPhotoUrl} name={acc.fullName} size={28} />
                  <span className="flex-1 text-left font-medium truncate">{acc.fullName}</span>
                  {acc.isCurrentAccount && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              ))}
            </div>
          )}

          {/* Add sub-account (Telegram users only) */}
          {user.telegramChatId && (
            <div className="py-1.5 border-b border-border">
              <button
                onClick={() => { setOpen(false); setCreateOpen(true); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              >
                <div className="w-7 h-7 rounded-full border border-dashed border-border flex items-center justify-center">
                  <Plus className="h-3.5 w-3.5" />
                </div>
                Add Sub-Account
              </button>
            </div>
          )}

          {/* Bottom actions */}
          <div className="py-1.5">
            {user.isAdmin && (
              <Link href="/admin" onClick={() => setOpen(false)}>
                <div className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer">
                  <ShieldCheck className="h-4 w-4" />
                  Admin Panel
                </div>
              </Link>
            )}
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
