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
import { Check, ChevronDown, Plus, Users } from "lucide-react";
import { toast } from "sonner";

function Img({ src, name, size = 28 }: { src?: string | null; name?: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = (name ?? "U").slice(0, 2).toUpperCase();
  const s = { width: size, height: size, minWidth: size };
  if (src && !err) {
    return (
      <div style={s} className="rounded-full overflow-hidden bg-primary/10 border border-primary/20 shrink-0">
        <img src={src} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} />
      </div>
    );
  }
  return (
    <div style={s} className="rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary">
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

export function AccountSwitcher({ user }: { user: User }) {
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

  if (!user.telegramChatId) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/60 hover:bg-muted text-xs font-medium transition-colors"
      >
        <Img src={user.telegramPhotoUrl} name={user.fullName} size={20} />
        <span className="hidden sm:inline max-w-[80px] truncate">{user.fullName || user.telegramUsername || "Account"}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-primary/5">
            <div className="flex items-center gap-2.5">
              <Img src={user.telegramPhotoUrl} name={user.fullName} size={36} />
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{user.fullName}</p>
                {user.telegramUsername && <p className="text-[11px] text-primary/70">@{user.telegramUsername}</p>}
              </div>
            </div>
          </div>

          {/* Accounts list */}
          {accounts && accounts.length > 1 && (
            <div className="py-1.5">
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
                  <Img src={acc.telegramPhotoUrl} name={acc.fullName} size={28} />
                  <span className="flex-1 text-left font-medium truncate">{acc.fullName}</span>
                  {acc.isCurrentAccount && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              ))}
            </div>
          )}

          {/* Create new */}
          <div className="border-t border-border py-1.5">
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
        </div>
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
