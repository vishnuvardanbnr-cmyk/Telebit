import { useEffect, useRef, useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useGetTelegramConfig } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { ShoppingBag, Send, FlaskConical } from "lucide-react";

const BASE = import.meta.env.BASE_URL;

declare global {
  interface Window {
    onTelegramAuthShop?: (user: TelegramUser) => void;
  }
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export default function ShopSignInPage() {
  const [, setLocation] = useLocation();
  const { isSignedIn, isLoading } = useAuth();
  const { data: config, isLoading: configLoading } = useGetTelegramConfig();
  const widgetRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    if (!config?.configured || !config.botUsername || !widgetRef.current) return;

    widgetRef.current.innerHTML = "";

    window.onTelegramAuthShop = async (tgUser: TelegramUser) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${BASE}api/auth/telegram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(tgUser),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Authentication failed");
        }
        setLocation("/products");
      } catch (e: any) {
        setError(e.message || "Authentication failed. Please try again.");
        setLoading(false);
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", config.botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuthShop(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;
    widgetRef.current.appendChild(script);

    return () => { delete window.onTelegramAuthShop; };
  }, [config, setLocation]);

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}api/auth/demo`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Demo login failed");
      }
      setLocation("/products");
    } catch (e: any) {
      setError(e.message || "Demo login failed. Please try again.");
    } finally {
      setDemoLoading(false);
    }
  };

  if (!isLoading && isSignedIn) return <Redirect to="/products" />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-2 font-semibold text-foreground text-lg">
          <ShoppingBag className="h-5 w-5 text-primary" />
          Telebit Shop
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
            <div className="h-1 bg-primary w-full" />
            <div className="p-6 sm:p-8">
              <div className="flex flex-col items-center mb-6">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <ShoppingBag className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-xl font-bold text-foreground text-center">Sign In to Shop</h1>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  Use your Telegram account to continue
                </p>
              </div>

              <div className="flex flex-col items-center gap-4">
                {configLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading…
                  </div>
                ) : !config?.configured ? (
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                      <Send className="h-5 w-5 text-amber-600" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">Telegram login not configured</p>
                    <p className="text-xs text-muted-foreground">
                      An admin needs to configure the Telegram bot in the Exchange Admin Panel.
                    </p>
                  </div>
                ) : loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground">Authenticating…</p>
                  </div>
                ) : (
                  <>
                    <div ref={widgetRef} className="flex justify-center min-h-[52px]" />
                    {error && (
                      <div className="w-full bg-destructive/10 border border-destructive/20 rounded px-3 py-2 text-xs text-destructive text-center">
                        {error}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Demo login */}
              <button
                onClick={handleDemoLogin}
                disabled={demoLoading}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-all text-primary font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {demoLoading ? (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FlaskConical className="w-4 h-4" />
                )}
                {demoLoading ? "Signing in…" : "Try Demo Account"}
              </button>
              <p className="text-center text-[11px] text-muted-foreground mt-2">
                100 USDT balance · no Telegram required
              </p>

              {error && !loading && (
                <div className="mt-3 bg-destructive/10 border border-destructive/20 rounded px-3 py-2 text-xs text-destructive text-center">
                  {error}
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            By signing in you agree to our terms of service.
          </p>
        </div>
      </main>
    </div>
  );
}
