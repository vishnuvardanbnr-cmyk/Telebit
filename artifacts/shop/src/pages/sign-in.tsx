import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { ShoppingBag, Send, FlaskConical, Phone, ArrowLeft } from "lucide-react";

type Step = "phone" | "code";

export default function ShopSignInPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isSignedIn, isLoading } = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<{ botUsername?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  if (!isLoading && isSignedIn) return <Redirect to="/" />;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetch(`/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string; hint?: string; botUsername?: string };
      if (!res.ok) {
        if (res.status === 404 && body.botUsername) {
          setHint({ botUsername: body.botUsername });
        }
        throw new Error(body.error || "Failed to send code");
      }
      setStep("code");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, code }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string; user?: any };
      if (!res.ok) throw new Error(body.error || "Verification failed");
      if (body.user) queryClient.setQueryData(["getMe"], body.user);
      setLocation("/");
    } catch (e: any) {
      setError(e.message);
      setVerifying(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/demo`, {
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
                  {step === "phone" ? "Enter your phone number to receive a code on Telegram" : "Enter the code sent to your Telegram"}
                </p>
              </div>

              {step === "phone" ? (
                <form onSubmit={handleSendOtp} className="flex flex-col gap-3">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+1 555 000 0000"
                      required
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
                  </div>

                  {error && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded px-3 py-2 text-xs text-destructive text-center">
                      {error}
                    </div>
                  )}

                  {hint?.botUsername && (
                    <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2.5 text-xs text-amber-800 text-center">
                      <p className="font-medium mb-1">Phone not registered yet</p>
                      <p>Open Telegram and start the bot first:</p>
                      <a
                        href={`https://t.me/${hint.botUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1.5 font-semibold text-blue-600 underline"
                      >
                        <Send className="h-3 w-3" />
                        @{hint.botUsername}
                      </a>
                      <p className="mt-1">Then tap "Share phone number" and come back.</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={sending || !phone}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sending ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {sending ? "Sending…" : "Send Code via Telegram"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerify} className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => { setStep("phone"); setCode(""); setError(null); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to phone
                  </button>

                  <p className="text-xs text-muted-foreground text-center">
                    Sent to Telegram for <span className="font-medium text-foreground">{phone}</span>
                  </p>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="6-digit code"
                    required
                    autoFocus
                    className="w-full text-center tracking-[0.4em] text-xl font-bold px-3 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground placeholder:tracking-normal placeholder:text-sm placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />

                  {error && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded px-3 py-2 text-xs text-destructive text-center">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={verifying || code.length < 6}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {verifying ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : null}
                    {verifying ? "Verifying…" : "Verify Code"}
                  </button>

                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sending}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors text-center"
                  >
                    {sending ? "Resending…" : "Didn't receive a code? Resend"}
                  </button>
                </form>
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
                {demoLoading ? (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FlaskConical className="w-4 h-4" />
                )}
                {demoLoading ? "Signing in…" : "Try Demo Account"}
              </button>
              <p className="text-center text-[11px] text-muted-foreground mt-1.5">
                100 USDT balance · no phone required
              </p>
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
