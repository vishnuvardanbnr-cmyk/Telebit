import { Link } from "wouter";
import { UserButton, useUser, SignInButton } from "@clerk/react";
import { ShoppingCart, Heart, Package, ShieldCheck, LogOut } from "lucide-react";
import { useGetCart, useGetMe } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { data: dbUser } = useGetMe({ query: { enabled: !!user } });
  const { data: cart } = useGetCart({ query: { enabled: !!user } });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-mono">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-8">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <span className="hidden font-bold sm:inline-block tracking-tighter uppercase">
                CryptoVault Shop
              </span>
            </Link>
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <Link href="/products" className="transition-colors hover:text-foreground/80 text-foreground/60 uppercase">
                Catalog
              </Link>
            </nav>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
            </div>
            <nav className="flex items-center space-x-4">
              {user ? (
                <>
                  <div className="hidden md:flex items-center text-xs text-muted-foreground mr-4">
                    <span className="uppercase mr-2">Wallet:</span>
                    <span className="text-foreground">{dbUser?.walletBalance || "0.00"} USDT</span>
                  </div>
                  
                  {dbUser?.isAdmin && (
                    <Link href="/admin" className="text-foreground/60 hover:text-foreground">
                      <ShieldCheck className="h-5 w-5" />
                    </Link>
                  )}
                  
                  <Link href="/wishlist" className="text-foreground/60 hover:text-foreground">
                    <Heart className="h-5 w-5" />
                  </Link>

                  <Link href="/orders" className="text-foreground/60 hover:text-foreground">
                    <Package className="h-5 w-5" />
                  </Link>

                  <Link href="/cart" className="text-foreground/60 hover:text-foreground relative">
                    <ShoppingCart className="h-5 w-5" />
                    {cart?.itemCount ? (
                      <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {cart.itemCount}
                      </span>
                    ) : null}
                  </Link>

                  <UserButton 
                    appearance={{
                      elements: {
                        userButtonAvatarBox: "rounded-none w-8 h-8",
                      }
                    }}
                  />
                </>
              ) : (
                <SignInButton mode="modal">
                  <button className="text-sm font-medium uppercase tracking-wider hover:text-primary transition-colors">
                    Sign In
                  </button>
                </SignInButton>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border bg-card py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row px-4 md:px-8">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left uppercase tracking-wider">
            Built by CryptoVault. Institutional-grade commerce.
          </p>
        </div>
      </footer>
    </div>
  );
}
