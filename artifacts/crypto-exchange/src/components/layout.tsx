import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import {
  LogOut,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  History,
  ShieldAlert,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useClerk();
  const [location] = useLocation();
  const { data: user, isLoading } = useGetMe();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: Wallet },
    { name: "Deposit", href: "/deposit", icon: ArrowDownToLine },
    { name: "Withdraw", href: "/withdraw", icon: ArrowUpFromLine },
    { name: "P2P", href: "/p2p", icon: Send },
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
        <div className="border-t border-border p-3">
          {isLoading ? (
            <div className="h-10 animate-pulse bg-muted rounded-md" />
          ) : user ? (
            <div className="px-3 py-2 mb-1">
              <div className="text-xs text-muted-foreground mb-0.5 truncate">{user.email}</div>
              <div className="text-xs text-muted-foreground/60 font-mono truncate">#{user.referralCode}</div>
            </div>
          ) : null}
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Log Out
          </button>
        </div>
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
        <div className="border-t border-border p-3">
          {user && (
            <div className="px-3 py-2 mb-1">
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>
          )}
          <button
            onClick={() => { signOut(); setMobileOpen(false); }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Log Out
          </button>
        </div>
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

        {/* Page content — bottom padding on mobile to clear the footer nav */}
        <main className="flex-1 overflow-auto p-4 pb-20 md:p-6 md:pb-6 lg:p-8">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom footer nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-card border-t border-border">
        <div className="grid grid-cols-5 h-16">
          {navItems.slice(0, 5).map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
