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
  Settings,
  ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useClerk();
  const [location] = useLocation();
  const { data: user, isLoading } = useGetMe();

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: Wallet },
    { name: "Deposit", href: "/deposit", icon: ArrowDownToLine },
    { name: "Withdraw", href: "/withdraw", icon: ArrowUpFromLine },
    { name: "P2P Transfer", href: "/p2p", icon: Send },
    { name: "History", href: "/history", icon: History },
  ];

  if (user?.isAdmin) {
    navItems.push({ name: "Admin Panel", href: "/admin", icon: ShieldAlert });
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background md:flex-row">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link href="/" className="flex items-center gap-2 font-mono font-bold uppercase tracking-widest text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineLinejoin="round" className="h-6 w-6">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M8 11h8" />
              <path d="M12 7v8" />
            </svg>
            CryptoVault
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-4">
          <nav className="grid gap-1 px-4">
            {navItems.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-none px-3 py-2 text-sm font-mono tracking-wider transition-colors uppercase",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="border-t border-border p-4">
          {isLoading ? (
            <div className="h-10 animate-pulse bg-muted"></div>
          ) : user ? (
            <div className="flex flex-col space-y-2 mb-4">
              <div className="font-mono text-xs text-muted-foreground uppercase">User</div>
              <div className="text-sm font-mono truncate">{user.email}</div>
              <div className="text-xs font-mono text-muted-foreground truncate">ID: {user.referralCode}</div>
            </div>
          ) : null}
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 rounded-none px-3 py-2 text-sm font-mono tracking-wider text-muted-foreground hover:bg-accent hover:text-accent-foreground uppercase"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Mobile TopNav */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <Link href="/" className="flex items-center gap-2 font-mono font-bold uppercase tracking-widest text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineLinejoin="round" className="h-5 w-5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M8 11h8" />
            <path d="M12 7v8" />
          </svg>
          CV
        </Link>
        <div className="flex items-center gap-4">
          <nav className="flex gap-4">
            <Link href="/dashboard" className="text-muted-foreground hover:text-primary"><Wallet className="h-5 w-5" /></Link>
            <Link href="/history" className="text-muted-foreground hover:text-primary"><History className="h-5 w-5" /></Link>
            <button onClick={() => signOut()} className="text-muted-foreground hover:text-destructive"><LogOut className="h-5 w-5" /></button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}