import { useState, useEffect, useCallback } from "react";
import { useLocation, Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { FlaskConical } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

declare global {
  interface Window {
    onTelegramWidgetAuth?: (user: TelegramAuthUser) => void;
  }
}

interface TelegramAuthUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

function TelegramLoginButton({ botUsername, onAuth, disabled }: {
  botUsername: string;
  onAuth: (user: TelegramAuthUser) => void;
  disabled?: boolean;
}) {
  useEffect(() => {
    window.onTelegramWidgetAuth = onAuth;

    const container = document.getElementById("tg-login-container");
    if (!container) return;
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramWidgetAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-radius", "8");
    script.async = true;
    container.appendChild(script);

    return () => {
      delete window.onTelegramWidgetAuth;
    };
  }, [botUsername, onAuth]);

  return (
    <div
      id="tg-login-container"
      className={`flex justify-center ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    />
  );
}

export default function ShopSignInPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isSignedIn, isLoading } = useAuth();

  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [botLoading, setBotLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  if (!isLoading && isSignedIn) return <Redirect to="/" />;

  useEffect(() => {
    fetch(`${BASE}/api/auth/bot-info`, { credentials: "include" })
      .then(r => r.json())
      .then((d: any) => { if (d.botUsername) setBotUsername(d.botUsername); })
      .catch(() => {})
      .finally(() => setBotLoading(false));
  }, []);

  const handleTelegramAuth = useCallback(async (tgUser: TelegramAuthUser) => {
    setLogging(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/auth/telegram/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(tgUser),
      });
      const body = await res.json().catch(() => ({})) as { error?: string; user?: any };
      if (!res.ok) throw new Error(body.error || "Login failed");
      if (body.user) queryClient.setQueryData(["getMe"], body.user);
      setLocation("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLogging(false);
    }
  }, [queryClient, setLocation]);

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/auth/demo`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({})) as { error?: string; user?: any };
      if (!res.ok) throw new Error(body.error || "Demo login failed");
      if (body.user) queryClient.setQueryData(["getMe"], body.user);
      setLocation("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center px-4 sm:px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-2 font-semibold text-foreground text-lg">
          <img src="/logo.png" alt="Telebit" className="h-6 w-6 rounded-md object-cover" />
          Telebit Shop
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
            <div className="h-1 bg-primary w-full" />
            <div className="p-6 sm:p-8">
              <div className="flex flex-col items-center mb-6">
                <div className="w-14 h-14 rounded-2xl overflow-hidden mb-4 shadow-md">
                  <img src="/logo.png" alt="Telebit" className="w-full h-full object-cover" />
                </div>
                <h1 className="text-xl font-bold text-foreground text-center">Sign In to Shop</h1>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  One tap with your Telegram account — no password needed
                </p>
              </div>

              {logging ? (
                <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Signing you in…
                </div>
              ) : botLoading ? (
                <div className="w-full h-12 bg-muted/40 rounded-lg animate-pulse" />
              ) : botUsername ? (
                <TelegramLoginButton
                  botUsername={botUsername}
                  onAuth={handleTelegramAuth}
                  disabled={logging}
                />
              ) : (
                <div className="w-full text-center text-xs text-muted-foreground bg-muted/30 rounded-lg py-5 px-4">
                  <p className="font-medium mb-1">Telegram login not configured</p>
                  <p>An admin needs to set the Bot Username in Settings.</p>
                </div>
              )}

              {error && (
                <div className="mt-3 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive text-center">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <button
                onClick={handleDemoLogin}
                disabled={demoLoading}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-all text-primary font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {demoLoading
                  ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  : <FlaskConical className="w-4 h-4" />}
                {demoLoading ? "Signing in…" : "Try Demo Account"}
              </button>
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
