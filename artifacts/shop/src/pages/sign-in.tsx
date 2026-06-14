import { useState, useEffect, useRef } from "react";
import { useLocation, Redirect, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Mail, Lock, User, Eye, EyeOff, Gift, CheckCircle2, XCircle, Loader2, ShieldCheck, KeyRound } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ShopSignInPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { isSignedIn, isLoading } = useAuth();

  const params = new URLSearchParams(search);
  const referralCode = params.get("ref") ?? undefined;
  const refFromUrl = !!referralCode;

  const [mode, setMode] = useState<"login" | "register" | "forgot">(referralCode ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [refInput, setRefInput] = useState(referralCode ?? "");
  const [refStatus, setRefStatus] = useState<"idle" | "checking" | "valid" | "invalid">(
    referralCode ? "checking" : "idle"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // OTP state
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);

  // Forgot password state
  const [forgotStep, setForgotStep] = useState<"email" | "otp" | "done">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  // Settings from server
  const [emailVerifEnabled, setEmailVerifEnabled] = useState(false);
  const [loginOtpEnabled, setLoginOtpEnabled] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/settings`, { credentials: "include" })
      .then((r) => r.json())
      .then((s: any) => {
        setEmailVerifEnabled(!!s.emailVerificationEnabled);
        setLoginOtpEnabled(!!s.loginOtpEnabled);
      })
      .catch(() => {});

    fetch(`${BASE}/api/auth/first-user`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: any) => {
        if (d.isFirstUser) {
          setIsFirstUser(true);
          setMode("register");
        }
      })
      .catch(() => {});
  }, []);

  // Reset OTP step when switching modes
  useEffect(() => {
    setOtpStep(false);
    setOtpCode("");
    setError(null);
  }, [mode]);

  const checkRef = (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setRefStatus("idle"); return; }
    setRefStatus("checking");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE}/api/auth/check-referral?code=${encodeURIComponent(trimmed)}`, { credentials: "include" });
        const data = await res.json() as { valid: boolean };
        setRefStatus(data.valid ? "valid" : "invalid");
      } catch {
        setRefStatus("idle");
      }
    }, 500);
  };

  useEffect(() => {
    if (referralCode) checkRef(referralCode);
  }, []);

  if (!isLoading && isSignedIn) return <Redirect to="/" />;

  const handleRefChange = (val: string) => {
    const upper = val.toUpperCase();
    setRefInput(upper);
    checkRef(upper);
  };

  const handleSendOtp = async () => {
    if (!email.trim()) { setError("Email is required."); return; }
    setSendingOtp(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/auth/send-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), purpose: "register" }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to send verification code");
      setOtpStep(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) { setError("Email is required."); return; }
    if (mode === "register" && !fullName.trim()) { setError("Full name is required."); return; }
    if (!password) { setError("Password is required."); return; }
    if (mode === "register" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (mode === "register" && !isFirstUser && !refInput.trim()) {
      setError("A referral code is required to register.");
      return;
    }
    if (mode === "register" && !isFirstUser && refStatus === "invalid") {
      setError("The referral code is invalid. Please check and try again.");
      return;
    }
    if (mode === "register" && !isFirstUser && refStatus === "checking") {
      setError("Please wait while we verify your referral code.");
      return;
    }

    // Register Step 1: send OTP if email verification is enabled
    if (mode === "register" && emailVerifEnabled && !otpStep) {
      await handleSendOtp();
      return;
    }

    // Validate OTP code when in OTP step
    if (otpStep && !otpCode.trim()) {
      setError("Please enter the verification code sent to your email.");
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
        if (otpStep && otpCode.trim()) body.otpCode = otpCode.trim();
      }
      if (mode === "login" && otpStep && otpCode.trim()) {
        body.otpCode = otpCode.trim();
      }

      const res = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({})) as { error?: string; user?: any; otpRequired?: boolean };

      // Login OTP: server sent OTP and is awaiting it
      if (mode === "login" && data.otpRequired) {
        setOtpStep(true);
        return;
      }

      if (!res.ok) throw new Error(data.error || "Something went wrong");
      if (data.user) queryClient.setQueryData(["getMe"], data.user);
      setLocation("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Forgot password handlers ──────────────────────────────────────────────

  const handleForgotSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) { setForgotError("Email is required."); return; }
    setForgotSubmitting(true);
    setForgotError(null);
    try {
      const res = await fetch(`${BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to send reset code");
      setForgotStep("otp");
    } catch (e: any) {
      setForgotError(e.message);
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotOtp.length < 6) { setForgotError("Please enter the 6-digit code."); return; }
    if (!newPassword || newPassword.length < 6) { setForgotError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setForgotError("Passwords do not match."); return; }
    setForgotSubmitting(true);
    setForgotError(null);
    try {
      const res = await fetch(`${BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          otpCode: forgotOtp.trim(),
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      setForgotStep("done");
    } catch (e: any) {
      setForgotError(e.message);
    } finally {
      setForgotSubmitting(false);
    }
  };

  const resetForgotFlow = () => {
    setForgotStep("email");
    setForgotEmail("");
    setForgotOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setForgotError(null);
  };

  const enterForgot = () => {
    resetForgotFlow();
    setMode("forgot");
  };

  const refStatusIcon = () => {
    if (refStatus === "checking") return <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />;
    if (refStatus === "valid") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (refStatus === "invalid") return <XCircle className="w-4 h-4 text-destructive" />;
    return null;
  };

  const refBorderClass = () => {
    if (refStatus === "valid") return "border-green-500 focus:ring-green-500/50 focus:border-green-500";
    if (refStatus === "invalid") return "border-destructive focus:ring-destructive/50 focus:border-destructive";
    return "border-border focus:ring-primary/50 focus:border-primary";
  };

  const submitLabel = () => {
    if (submitting) {
      if (mode === "login") return otpStep ? "Verifying…" : "Signing in…";
      return otpStep ? "Creating account…" : emailVerifEnabled ? "Sending code…" : "Creating account…";
    }
    if (mode === "login") return otpStep ? "Verify & Sign In" : "Sign In";
    return otpStep ? "Create Account" : emailVerifEnabled ? "Send Verification Code" : "Create Account";
  };

  const headerTitle = () => {
    if (mode === "forgot") return "Reset Password";
    if (mode === "login") return "Sign In to Televerse";
    return "Create Account";
  };

  const headerSubtitle = () => {
    if (mode === "forgot") {
      if (forgotStep === "email") return "Enter your email to receive a reset code";
      if (forgotStep === "otp") return "Enter the code and choose a new password";
      return "Your password has been reset";
    }
    if (mode === "login") return "Welcome back to Televerse Shop";
    return "Join Televerse and start shopping";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center px-4 sm:px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-2 font-semibold text-foreground text-lg">
          <img src="/logo.png" alt="Televerse" className="h-6 w-6 rounded-md object-cover" />
          Televerse Shop
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
            <div className="h-1 bg-primary w-full" />

            <div className="p-6 sm:p-8">
              <div className="flex flex-col items-center mb-6">
                <div className="w-14 h-14 rounded-2xl overflow-hidden mb-4 shadow-md">
                  <img src="/logo.png" alt="Televerse" className="w-full h-full object-cover" />
                </div>
                <h1 className="text-xl font-bold text-foreground text-center">
                  {headerTitle()}
                </h1>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  {headerSubtitle()}
                </p>
              </div>

              {isFirstUser && mode === "register" && !otpStep && (
                <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400 text-center font-medium">
                  🛡️ No accounts yet — this account will be set as <strong>admin</strong>.
                </div>
              )}

              {refFromUrl && !isFirstUser && mode === "register" && !otpStep && (
                <div className="mb-4 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-xs text-primary text-center font-medium">
                  🎁 You were invited! Referral code applied.
                </div>
              )}

              {/* Tab bar — hidden in forgot mode */}
              {mode !== "forgot" && !otpStep && (
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
              )}

              {/* ── Forgot Password Flow ── */}
              {mode === "forgot" ? (
                <>
                  {forgotStep === "email" && (
                    <form onSubmit={handleForgotSendCode} className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          Email address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type="email"
                            placeholder="you@example.com"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                            autoComplete="email"
                            autoFocus
                            disabled={forgotSubmitting}
                          />
                        </div>
                      </div>

                      {forgotError && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive text-center">
                          {forgotError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={forgotSubmitting || !forgotEmail.trim()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {forgotSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                            Sending code…
                          </>
                        ) : "Send Reset Code"}
                      </button>

                      <button
                        type="button"
                        onClick={() => { setMode("login"); resetForgotFlow(); }}
                        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                      >
                        ← Back to Sign In
                      </button>
                    </form>
                  )}

                  {forgotStep === "otp" && (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Mail className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-sm text-foreground">Check your email</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          We sent a reset code to <strong className="text-foreground">{forgotEmail}</strong>
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          Reset code <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="000000"
                            value={forgotOtp}
                            onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors font-mono tracking-[0.4em] text-center"
                            autoComplete="one-time-code"
                            maxLength={6}
                            autoFocus
                            disabled={forgotSubmitting}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">Code expires in 5 minutes.</p>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          New password <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type={showNewPassword ? "text" : "password"}
                            placeholder="Min 6 characters"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                            autoComplete="new-password"
                            disabled={forgotSubmitting}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          Confirm password <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Repeat password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                            autoComplete="new-password"
                            disabled={forgotSubmitting}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {forgotError && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive text-center">
                          {forgotError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={forgotSubmitting || forgotOtp.length < 6 || !newPassword || !confirmPassword}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {forgotSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                            Resetting…
                          </>
                        ) : "Reset Password"}
                      </button>

                      <button
                        type="button"
                        onClick={() => { setForgotStep("email"); setForgotOtp(""); setForgotError(null); }}
                        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                      >
                        ← Back
                      </button>
                    </form>
                  )}

                  {forgotStep === "done" && (
                    <div className="space-y-4 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                          <KeyRound className="w-6 h-6 text-green-500" />
                        </div>
                        <p className="text-sm text-foreground font-medium">Password reset successfully!</p>
                        <p className="text-xs text-muted-foreground">You can now sign in with your new password.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setMode("login"); resetForgotFlow(); }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
                      >
                        Sign In
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* ── OTP Step ── */}
                  {otpStep ? (
                    <div className="space-y-4">
                      <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Mail className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-sm text-foreground">Check your email</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          We sent a 6-digit code to <strong className="text-foreground">{email}</strong>
                        </p>
                      </div>

                      <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                            Verification code <span className="text-destructive">*</span>
                          </label>
                          <div className="relative">
                            <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="000000"
                              value={otpCode}
                              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors font-mono tracking-[0.4em] text-center"
                              autoComplete="one-time-code"
                              maxLength={6}
                              autoFocus
                              disabled={submitting}
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Code expires in 5 minutes.
                          </p>
                        </div>

                        {error && (
                          <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive text-center">
                            {error}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={submitting || otpCode.length < 6}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitting ? (
                            <>
                              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                              {mode === "login" ? "Verifying…" : "Creating account…"}
                            </>
                          ) : (
                            mode === "login" ? "Verify & Sign In" : "Create Account"
                          )}
                        </button>
                      </form>

                      <button
                        type="button"
                        onClick={() => { setOtpStep(false); setOtpCode(""); setError(null); }}
                        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                      >
                        ← Back
                      </button>
                    </div>
                  ) : (
                    /* ── Normal Form ── */
                    <form onSubmit={handleSubmit} className="space-y-3">
                      {mode === "register" && (
                        <>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                              Full name <span className="text-destructive">*</span>
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
                                disabled={submitting || sendingOtp}
                              />
                            </div>
                          </div>

                          {!isFirstUser && <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                              Referral code <span className="text-destructive">*</span>
                            </label>
                            <div className="relative">
                              <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <input
                                type="text"
                                placeholder="e.g. ABC123"
                                value={refInput}
                                onChange={(e) => handleRefChange(e.target.value)}
                                readOnly={refFromUrl}
                                className={`w-full pl-9 pr-10 py-2.5 rounded-lg border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-colors font-mono tracking-widest ${refBorderClass()} ${refFromUrl ? "opacity-75 cursor-not-allowed select-none" : ""}`}
                                autoComplete="off"
                                disabled={submitting || sendingOtp}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                {refStatusIcon()}
                              </span>
                            </div>
                            {refStatus === "valid" && (
                              <p className="text-[11px] text-green-600 mt-1">✓ Valid referral code</p>
                            )}
                            {refStatus === "invalid" && (
                              <p className="text-[11px] text-destructive mt-1">✗ Referral code not found</p>
                            )}
                          </div>}
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
                            disabled={submitting || sendingOtp}
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
                            disabled={submitting || sendingOtp}
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
                        {mode === "login" && (
                          <div className="text-right mt-1">
                            <button
                              type="button"
                              onClick={enterForgot}
                              className="text-[11px] text-primary hover:underline"
                            >
                              Forgot password?
                            </button>
                          </div>
                        )}
                      </div>

                      {error && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive text-center">
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={submitting || sendingOtp || (mode === "register" && (refStatus === "invalid" || refStatus === "checking"))}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                      >
                        {(submitting || sendingOtp) ? (
                          <>
                            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                            {submitLabel()}
                          </>
                        ) : (
                          submitLabel()
                        )}
                      </button>
                    </form>
                  )}
                </>
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
