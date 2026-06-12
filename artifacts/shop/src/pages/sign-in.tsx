import { useState, useEffect } from "react";
import { useLocation, Redirect, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { FlaskConical, Phone, Key, Send } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ShopSignInPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { isSignedIn, isLoading } = useAuth();

  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) { setError("Please enter your phone number."); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: trimmed }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string; hint?: string; botUsername?: string };
      if (!res.ok) {
        if (body.hint) throw new Error(`${body.error} — ${body.hint}`);
        throw new Error(body.error || "Failed to send code");
      }
      setStep("code");
      setCode("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.replace(/\s/g, "");
    if (trimmed.length !== 6) { setError("Please enter the 6-digit code."); return; }
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: phone.trim(), code: trimmed }),
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
                  Enter your Telegram phone number to receive a one-time code
                </p>
              </div>

              {referralCode && (
                <div className="mb-4 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-xs text-primary text-center font-medium">
                  🎁 You were invited! Referral code applied.
                </div>
              )}

              {step === "phone" ? (
                <form onSubmit={handleSendOtp} className="space-y-3">
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
                    {botUsername && (
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        You must have started{" "}
                        <a
                          href={`https://t.me/${botUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-2"
                        >
                          @{botUsername}
                        </a>{" "}
                        and shared your number with it first.
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={sending || !phone.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Sending code…
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Code via Telegram
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerify} className="space-y-3">
                  <div className="text-center mb-2">
                    <p className="text-sm text-muted-foreground">
                      Code sent to <span className="font-semibold text-foreground">{phone}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Check your Telegram for the 6-digit code</p>
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
                        pattern="\d{6}"
                        maxLength={6}
                        placeholder="123456"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-mono tracking-widest placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                        autoComplete="one-time-code"
                        disabled={verifying}
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={verifying || code.length !== 6}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifying ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Verifying…
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
