import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LogOut, Wallet, ArrowDownToLine, ArrowUpFromLine, Send, History,
  ShieldAlert, Menu, X, LayoutGrid, Coins, ChevronDown, Check, Plus, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSubAccounts, useCreateSubAccount, useSwitchSubAccount,
  getGetMeQueryKey, SubAccount,
} from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function Img({ src, name, size = 28 }: { src?: string | null; name?: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = (name ?? "U").slice(0, 2).toUpperCase();
  const s = { width: size, height: size, minWidth: size };
  if (src && !err)
    return <div style={s} className="rounded-full overflow-hidden bg-primary/10 border border-primary/20 shrink-0"><img src={src} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} /></div>;
  return <div style={{ ...s, fontSize: Math.max(8, size * 0.38) + "px" }} className="rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 font-bold text-primary">{initials}</div>;
}

function SidebarUserPanel() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const { data: accounts } = useListSubAccounts({ query: { enabled: !!user?.telegramChatId, queryKey: ["listSubAccounts", user?.id] } });
  const switchSub = useSwitchSubAccount();
  const createSub = useCreateSubAccount();
  const [expanded, setExpanded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [alias, setAlias] = useState("");
  const [fund, setFund] = useState("");

  const handleSwitch = (acc: SubAccount) => {
    if (acc.isCurrentAccount) return;
    switchSub.mutate(
      { accountId: acc.id },
      {
        onSuccess: newUser => {
          qc.setQueryData(getGetMeQueryKey(), newUser);
          qc.invalidateQueries();
          toast.success(`Switched to ${acc.fullName}`);
          setExpanded(false);
        },
        onError: () => toast.error("Failed to switch"),
      }
    );
  };

  const handleCreate = () => {
    if (!alias.trim()) { toast.error("Alias required"); return; }
    createSub.mutate(
      { data: { alias: alias.trim(), initialFund: fund ? parseFloat(fund) : undefined } },
      {
        onSuccess: () => {
          toast.success("Sub-account created");
          setAlias(""); setFund(""); setCreateOpen(false);
          qc.invalidateQueries({ queryKey: ["listSubAccounts"] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed"),
      }
    );
  };

  if (!user) return null;

  return (
    <div className="border-t border-border p-3">
      {/* User row */}
      <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
        <Img src={user.telegramPhotoUrl} name={user.fullName || user.email} size={32} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate leading-tight">{user.fullName || user.email?.split("@")[0]}</p>
          {user.telegramUsername
            ? <p className="text-[10px] text-primary/70 truncate">@{user.telegramUsername}</p>
            : <p className="text-[10px] text-muted-foreground truncate">#{user.referralCode}</p>
          }
        </div>
      </div>

      {/* Sub-account toggle — only if Telegram linked */}
      {user.telegramChatId && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors mb-1"
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">Switch Account</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>

          {expanded && accounts && (
            <div className="ml-2 mb-1 space-y-0.5">
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => handleSwitch(acc)}
                  disabled={acc.isCurrentAccount || switchSub.isPending}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                    acc.isCurrentAccount
                      ? "bg-primary/10 text-primary font-semibold cursor-default"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Img src={acc.telegramPhotoUrl} name={acc.fullName} size={20} />
                  <span className="flex-1 truncate text-left">{acc.fullName}</span>
                  {acc.isCurrentAccount && <Check className="h-3 w-3 shrink-0" />}
                </button>
              ))}
              <button
                onClick={() => setCreateOpen(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <div className="w-5 h-5 rounded-full border border-dashed border-border flex items-center justify-center shrink-0">
                  <Plus className="h-2.5 w-2.5" />
                </div>
                Add sub-account
              </button>
            </div>
          )}
        </div>
      )}

      {/* Logout */}
      <button
        onClick={() => signOut()}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        Log Out
      </button>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={v => !v && setCreateOpen(false)}>
        <DialogContent className="max-w-sm rounded-none">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase text-sm tracking-wider">New Sub-Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Alias</label>
              <input value={alias} onChange={e => setAlias(e.target.value)} placeholder="e.g. Trading Account"
                className="w-full mt-1 px-3 py-2 border border-input bg-background font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary rounded-none" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Initial Fund (USDT, optional)</label>
              <input type="number" value={fund} onChange={e => setFund(e.target.value)} placeholder="0.00" min="0"
                className="w-full mt-1 px-3 py-2 border border-input bg-background font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary rounded-none" />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-none font-mono uppercase text-xs">Cancel</Button>
            <Button onClick={handleCreate} disabled={createSub.isPending || !alias.trim()} className="rounded-none font-mono uppercase text-xs">
              {createSub.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, signOut } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: Wallet },
    { name: "Deposit", href: "/deposit", icon: ArrowDownToLine },
    { name: "Withdraw", href: "/withdraw", icon: ArrowUpFromLine },
    { name: "P2P", href: "/p2p", icon: Send },
    { name: "V2 Tokens", href: "/nft/buy", icon: Coins },
    { name: "NFT Pools", href: "/nft/pools", icon: LayoutGrid },
    { name: "Holdings", href: "/nft/holdings", icon: Coins },
    { name: "Services", href: "/services", icon: LayoutGrid },
    { name: "History", href: "/history", icon: History },
  ];

  if (user?.isAdmin) {
    navItems.push({ name: "Admin", href: "/admin", icon: ShieldAlert });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 lg:w-64 flex-col border-r border-border bg-card shrink-0">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link href="/" className="flex items-center gap-2 font-semibold text-primary text-base">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M8 11h8" /><path d="M12 7v8" />
            </svg>
            Telebit
          </Link>
        </div>
        <nav className="flex-1 overflow-auto py-4 px-3">
          <div className="grid gap-0.5">
            {navItems.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
        {isLoading ? <div className="border-t border-border p-3"><div className="h-10 animate-pulse bg-muted rounded-md" /></div> : <SidebarUserPanel />}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile slide-out drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border flex flex-col transform transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-5">
          <Link href="/" className="flex items-center gap-2 font-semibold text-primary" onClick={() => setMobileOpen(false)}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M8 11h8" /><path d="M12 7v8" />
            </svg>
            Telebit
          </Link>
          <button onClick={() => setMobileOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-auto py-4 px-3">
          <div className="grid gap-0.5">
            {navItems.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
        <SidebarUserPanel />
      </aside>

      {/* Right-side content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="flex items-center gap-2 font-semibold text-primary text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M8 11h8" /><path d="M12 7v8" />
            </svg>
            Telebit
          </Link>
          <div className="w-7" />
        </header>

        <main className="flex-1 overflow-auto p-4 pb-20 md:p-6 md:pb-6 lg:p-8">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom footer nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-card border-t border-border">
        <div className="grid grid-cols-6 h-16">
          {navItems.slice(0, 6).map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[9px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive && "stroke-[2.5px]")} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
