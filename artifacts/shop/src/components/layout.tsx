import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { ShoppingCart, Heart, Package, ShieldCheck, LogOut, Menu, X } from "lucide-react";
import { useGetCart, useGetMe } from "@workspace/api-client-react";
import { useClerk } from "@clerk/react";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const { data: dbUser } = useGetMe({ query: { enabled: !!user, queryKey: ["/api/users/me", !!user] } });
  const { data: cart } = useGetCart({ query: { enabled: !!user, queryKey: ["/api/shop/cart", !!user] } });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="max-w-7xl mx-auto flex h-14 items-center px-4 sm:px-6">
          {/* Logo */}
          <Link href="/products" className="flex items-center gap-2 font-semibold text-foreground mr-6 shrink-0">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline text-sm font-bold tracking-tight">CryptoVault Shop</span>
            <span className="sm:hidden text-sm font-bold tracking-tight">CV Shop</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-5 text-sm mr-auto">
            <Link href="/products" className={cn("transition-colors font-medium", location.startsWith("/products") ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              Catalog
            </Link>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {user ? (
              <>
                {/* Wallet balance — desktop only */}
                <div className="hidden md:flex items-center gap-1.5 text-xs bg-muted/60 rounded-full px-3 py-1.5">
                  <span className="text-muted-foreground">Balance:</span>
                  <span className="font-semibold text-foreground">{fmtUsdt(dbUser?.walletBalance)} USDT</span>
                </div>

                {dbUser?.isAdmin && (
                  <Link href="/admin" className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-md hover:bg-muted/50">
                    <ShieldCheck className="h-4 w-4" />
                  </Link>
                )}

                <Link href="/wishlist" className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-md hover:bg-muted/50">
                  <Heart className="h-4 w-4" />
                </Link>

                <Link href="/orders" className="hidden sm:flex text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-md hover:bg-muted/50">
                  <Package className="h-4 w-4" />
                </Link>

                <Link href="/cart" className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-md hover:bg-muted/50 relative">
                  <ShoppingCart className="h-4 w-4" />
                  {!!cart?.itemCount && (
                    <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                      {cart.itemCount > 9 ? "9+" : cart.itemCount}
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

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && user && (
          <div className="md:hidden border-t border-border bg-white">
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
              {/* Balance pill */}
              <div className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-md text-sm mb-2">
                <span className="text-muted-foreground">Wallet Balance</span>
                <span className="font-semibold">{fmtUsdt(dbUser?.walletBalance)} USDT</span>
              </div>
              {[
                { href: "/products", label: "Catalog" },
                { href: "/cart", label: "Cart", badge: cart?.itemCount },
                { href: "/wishlist", label: "Wishlist" },
                { href: "/orders", label: "My Orders" },
                ...(dbUser?.isAdmin ? [{ href: "/admin", label: "Admin Panel" }] : []),
              ].map(({ href, label, badge }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    location.startsWith(href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {label}
                  {badge ? <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span> : null}
                </Link>
              ))}
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

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border bg-white py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <p className="font-medium">CryptoVault Shop</p>
          <p>Spend your USDT. Zero off-ramping.</p>
        </div>
      </footer>
    </div>
  );
}
