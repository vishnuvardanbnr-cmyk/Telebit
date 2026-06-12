import { useState, useEffect } from "react";
import { useLocation, Redirect, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { FlaskConical, ExternalLink, MessageCircle, Key } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ShopSignInPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { isSignedIn, isLoading } = useAuth();

  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const params = new URLSearchParams(search);
  const referralCode = params.get("ref") ?? undefined;

  useEffect(() => {
    fetch(`${BASE}/api/auth/bot-info`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: any) => { if (d.botUsername) setBotUsername(d.botUsername); })
      .catch(() => {});
  }, []);

  if (!isLoading && isSignedIn) return <Redirect to="/" />;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.replace(/\s/g, "");
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setError("Please enter the 6-digit code from the bot.");
      return;
    }
    setLogging(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/auth/tg-code/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: trimmed, referralCode }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string; user?: any };
      if (!res.ok) throw new Error(body.error || "Verification failed");
      if (body.user) queryClient.setQueryData(["getMe"], body.user);
      setLocation("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLogging(false);
    }
  };

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
              {/* Logo + title */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-14 h-14 rounded-2xl overflow-hidden mb-4 shadow-md">
                  <img src="/logo.png" alt="Telebit" className="w-full h-full object-cover" />
                </div>
                <h1 className="text-xl font-bold text-foreground text-center">Sign In to Shop</h1>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  Get a one-time code from our Telegram bot — no password needed
                </p>
              </div>

              {referralCode && (
                <div className="mb-4 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-xs text-primary text-center font-medium">
                  🎁 You were invited! Referral code applied.
                </div>
              )}

              {/* Steps */}
              <div className="space-y-3 mb-5">
                {/* Step 1 */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Open the Telebit Bot</p>
                    {botUsername ? (
                      <a
                        href={`https://t.me/${botUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1.5 rounded-md bg-[#229ED9] hover:bg-[#1a8bbf] text-white text-xs font-semibold transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Open @{botUsername}
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground mt-1 block">
                        Bot not configured — ask an admin to set it up.
                      </span>
                    )}
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Send any message</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      The bot will reply with a 6-digit login code.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground mb-2">Enter the code below</p>
                    <form onSubmit={handleVerify} className="space-y-2">
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="\d{6}"
                          maxLength={6}
                          placeholder="123456"
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-mono tracking-widest placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                          autoComplete="one-time-code"
                          disabled={logging}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={logging || code.length !== 6}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {logging ? (
                          <>
                            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                            Verifying…
                          </>
                        ) : (
                          "Verify & Sign In"
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive text-center">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 my-4">
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
