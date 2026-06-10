import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingCart, Trophy, ArrowLeftRight, ShieldCheck, LogOut, Menu, X, LayoutGrid, Zap, Wallet, Home } from "lucide-react";
import { useGetCart } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isSignedIn, signOut } = useAuth();
  const [location] = useLocation();
  const { data: cart } = useGetCart({ query: { enabled: isSignedIn, queryKey: ["/api/shop/cart", isSignedIn] } });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const cartCount = cart?.itemCount ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="max-w-7xl mx-auto flex h-14 items-center px-4 sm:px-6">
          {/* Logo */}
          <Link href="/products" className="flex items-center gap-2 font-semibold text-foreground mr-6 shrink-0">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline text-sm font-bold tracking-tight">Telebit Shop</span>
            <span className="sm:hidden text-sm font-bold tracking-tight">Telebit</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-5 text-sm mr-auto">
            <Link href="/" className={cn("transition-colors font-medium", location === "/" ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              Home
            </Link>
            <Link href="/products" className={cn("transition-colors font-medium", location.startsWith("/products") ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              Catalog
            </Link>
            <a href="/exchange/dashboard" className="transition-colors font-medium text-muted-foreground hover:text-foreground flex items-center gap-1">
              Exchange ↗
            </a>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {isSignedIn ? (
              <>
                {/* Wallet balance — desktop only */}
                <div className="hidden md:flex items-center gap-1.5 text-xs bg-muted/60 rounded-full px-3 py-1.5">
                  <span className="text-muted-foreground">Balance:</span>
                  <span className="font-semibold text-foreground">{fmtUsdt(user?.walletBalance)} USDT</span>
                </div>

                {user?.isAdmin && (
                  <Link href="/admin" className="hidden md:flex text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-md hover:bg-muted/50">
                    <ShieldCheck className="h-4 w-4" />
                  </Link>
                )}

                <Link href="/cart" className="md:hidden text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-md hover:bg-muted/50 relative">
                  <ShoppingCart className="h-5 w-5" />
                  {!!cartCount && (
                    <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </Link>

                <Link href="/cart" className="hidden md:flex text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-md hover:bg-muted/50 relative">
                  <ShoppingCart className="h-4 w-4" />
                  {!!cartCount && (
                    <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </Link>

                {/* Mobile hamburger */}
                <button
                  className="md:hidden p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>

                {/* Desktop logout */}
                <button
                  onClick={() => signOut()}
                  className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted/50"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <Link
                href="/sign-in"
                className="text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && isSignedIn && (
          <div className="md:hidden border-t border-border bg-white">
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-md text-sm mb-2">
                <span className="text-muted-foreground">Wallet Balance</span>
                <span className="font-semibold">{fmtUsdt(user?.walletBalance)} USDT</span>
              </div>
              {user?.isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    location.startsWith("/admin") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Admin Panel
                </Link>
              )}
              <button
                onClick={() => { signOut(); setMobileMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 pb-16 md:pb-0">
        {children}
      </main>

      {/* Desktop footer */}
      <footer className="hidden md:block border-t border-border bg-white py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <p className="font-medium">Telebit Shop</p>
          <p>Spend your USDT. Zero off-ramping.</p>
        </div>
      </footer>

      {/* Mobile bottom footer nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-card border-t border-border">
        <div className={cn("grid h-16", isSignedIn ? "grid-cols-5" : "grid-cols-1")}>
          {isSignedIn ? (
            <>
              <Link
                href="/"
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  location === "/" ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Home className={cn("h-5 w-5", location === "/" && "stroke-[2.5px]")} />
                <span>Home</span>
              </Link>

              <Link
                href="/wallet"
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  location.startsWith("/wallet") ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Wallet className={cn("h-5 w-5", location.startsWith("/wallet") && "stroke-[2.5px]")} />
                <span>Wallet</span>
              </Link>

              <Link
                href="/lottery"
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  location.startsWith("/lottery") ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Trophy className={cn("h-5 w-5", location.startsWith("/lottery") && "stroke-[2.5px]")} />
                <span>Lottery</span>
              </Link>

              <Link
                href="/p2p"
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  location.startsWith("/p2p") ? "text-primary" : "text-muted-foreground"
                )}
              >
                <ArrowLeftRight className={cn("h-5 w-5", location.startsWith("/p2p") && "stroke-[2.5px]")} />
                <span>P2P</span>
              </Link>

              <Link
                href="/services"
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  location.startsWith("/services") ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Zap className={cn("h-5 w-5", location.startsWith("/services") && "stroke-[2.5px]")} />
                <span>Services</span>
              </Link>
            </>
          ) : (
            <Link
              href="/sign-in"
              className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground"
            >
              <ShoppingCart className="h-5 w-5" />
              <span>Sign In to Shop</span>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
