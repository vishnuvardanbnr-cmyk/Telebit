import { useState } from "react";
import { useLocation, Redirect, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { FlaskConical, Mail, Lock, User, Eye, EyeOff, Gift } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ShopSignInPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { isSignedIn, isLoading } = useAuth();

  const params = new URLSearchParams(search);
  const referralCode = params.get("ref") ?? undefined;

  const [mode, setMode] = useState<"login" | "register">(referralCode ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [refInput, setRefInput] = useState(referralCode ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  if (!isLoading && isSignedIn) return <Redirect to="/" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) { setError("Email is required."); return; }
    if (!password) { setError("Password is required."); return; }
    if (mode === "register" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (mode === "register" && !refInput.trim()) {
      setError("A referral code is required to register.");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: Record<string, string> = { email: email.trim(), password };
      if (mode === "register") {
        if (fullName.trim()) body.fullName = fullName.trim();
        const ref = refInput.trim().toUpperCase();
        if (ref) body.referralCode = ref;
      }

      const res = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({})) as { error?: string; user?: any };
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      if (data.user) queryClient.setQueryData(["getMe"], data.user);
      setLocation("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
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
      const data = await res.json().catch(() => ({})) as { error?: string; user?: any };
      if (!res.ok) throw new Error(data.error || "Demo login failed");
      if (data.user) queryClient.setQueryData(["getMe"], data.user);
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
                <h1 className="text-xl font-bold text-foreground text-center">
                  {mode === "login" ? "Sign In to Telebit" : "Create Account"}
                </h1>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  {mode === "login"
                    ? "Welcome back to Telebit Shop"
                    : "Join Telebit and start shopping"}
                </p>
              </div>

              {referralCode && mode === "register" && (
                <div className="mb-4 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-xs text-primary text-center font-medium">
                  🎁 You were invited! Referral code applied.
                </div>
              )}

              {/* Tab toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden mb-5 text-sm font-medium">
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(null); }}
                  className={`flex-1 py-2 transition-colors ${mode === "login" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("register"); setError(null); }}
                  className={`flex-1 py-2 transition-colors ${mode === "register" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  Register
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === "register" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        Full name (optional)
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Your name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                          autoComplete="name"
                          disabled={submitting}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        Referral code <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="e.g. ABC123"
                          value={refInput}
                          onChange={(e) => setRefInput(e.target.value.toUpperCase())}
                          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors font-mono tracking-widest"
                          autoComplete="off"
                          disabled={submitting}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                      autoComplete="email"
                      disabled={submitting}
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Password {mode === "register" && <span className="font-normal">(min 6 characters)</span>}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive text-center">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      {mode === "login" ? "Signing in…" : "Creating account…"}
                    </>
                  ) : (
                    mode === "login" ? "Sign In" : "Create Account"
                  )}
                </button>
              </form>

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
