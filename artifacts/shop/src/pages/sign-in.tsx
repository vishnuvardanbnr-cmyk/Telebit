import { useState, useEffect } from "react";
import { useLocation, Redirect, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { FlaskConical, Phone, Key, Send } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: { user?: { id: number; first_name: string; last_name?: string; username?: string }; start_param?: string };
        ready: () => void;
        expand: () => void;
        close: () => void;
        platform: string;
      };
    };
  }
}

function isTelegramWebApp(): boolean {
  return !!(window.Telegram?.WebApp?.initData);
}

export default function ShopSignInPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { isSignedIn, isLoading } = useAuth();

  const [mtprotoReady, setMtprotoReady] = useState<boolean | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [webAppLoading, setWebAppLoading] = useState(false);

  const params = new URLSearchParams(search);
  const referralCode = params.get("ref") ?? undefined;

  // ── Try Telegram WebApp auto-login on mount ──
  useEffect(() => {
    const twa = window.Telegram?.WebApp;
    if (!twa?.initData) return;

    // Tell Telegram the app is ready and expand to full screen
    twa.ready();
    twa.expand();

    setWebAppLoading(true);
    setError(null);

    const startParam = twa.initDataUnsafe?.start_param ?? referralCode;

    fetch(`${BASE}/api/auth/webapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ initData: twa.initData, referralCode: startParam }),
    })
      .then((r) => r.json())
      .then((body: { error?: string; user?: any }) => {
        if (body.error) throw new Error(body.error);
        if (body.user) queryClient.setQueryData(["getMe"], body.user);
        setLocation("/");
      })
      .catch((e: any) => {
        setError(e.message ?? "Telegram login failed");
        setWebAppLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch(`${BASE}/api/auth/mtproto/config`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: any) => setMtprotoReady(!!d.configured))
      .catch(() => setMtprotoReady(false));
  }, []);

  if (!isLoading && isSignedIn) return <Redirect to="/" />;

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) { setError("Please enter your phone number."); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/auth/mtproto/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: trimmed }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to send code");
      setStep("code");
      setCode("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.replace(/\s/g, "");
    if (!trimmed) { setError("Please enter the code."); return; }
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/auth/mtproto/sign-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: phone.trim(), code: trimmed, referralCode }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string; user?: any };
      if (!res.ok) throw new Error(body.error || "Verification failed");
      if (body.user) queryClient.setQueryData(["getMe"], body.user);
      setLocation("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setVerifying(false);
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

  // ── Full-screen loader shown while WebApp auto-login is in progress ──
  if (webAppLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md">
          <img src="/logo.png" alt="Telebit" className="w-full h-full object-cover" />
        </div>
        <p className="font-bold text-lg text-foreground">Telebit Shop</p>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Signing you in via Telegram…</p>
        {error && (
          <div className="mt-2 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2 text-xs text-destructive text-center max-w-xs">
            {error}
          </div>
        )}
      </div>
    );
  }

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
                  {step === "phone"
                    ? "Enter your Telegram phone number"
                    : "Check your Telegram app for the code"}
                </p>
              </div>

              {referralCode && (
                <div className="mb-4 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-xs text-primary text-center font-medium">
                  🎁 You were invited! Referral code applied.
                </div>
              )}

              {mtprotoReady === false ? (
                <div className="text-center text-xs text-muted-foreground bg-muted/30 rounded-lg py-5 px-4 mb-4">
                  <p className="font-medium mb-1">Telegram login not configured</p>
                  <p>TELEGRAM_API_ID and TELEGRAM_API_HASH are required.</p>
                </div>
              ) : step === "phone" ? (
                <form onSubmit={handleSendCode} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Phone number (with country code)
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="tel"
                        placeholder="+1 234 567 8900"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                        autoComplete="tel"
                        disabled={sending}
                        autoFocus
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Use the same number registered on your Telegram account.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={sending || !phone.trim() || mtprotoReady === null}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Code
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignIn} className="space-y-3">
                  <div className="text-center mb-2">
                    <p className="text-sm text-muted-foreground">
                      Code sent to <span className="font-semibold text-foreground">{phone}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Open your Telegram app — the code arrived as a message.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Enter the code
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={8}
                        placeholder="12345"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-mono tracking-widest placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                        autoComplete="one-time-code"
                        disabled={verifying}
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={verifying || !code}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifying ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Signing in…
                      </>
                    ) : (
                      "Verify & Sign In"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep("phone"); setError(null); setCode(""); }}
                    className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1 transition-colors"
                  >
                    ← Use a different number
                  </button>
                </form>
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
