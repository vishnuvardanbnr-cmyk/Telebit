import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AdminSetupPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}/api/auth/admin-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email }),
      });
      const data = await res.json() as { success?: boolean; message?: string; error?: string };
      if (res.ok && data.success) {
        setResult({ ok: true, msg: data.message ?? "Admin granted!" });
      } else {
        setResult({ ok: false, msg: data.error ?? "Something went wrong" });
      }
    } catch {
      setResult({ ok: false, msg: "Network error — check console" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm border border-border rounded-2xl bg-card shadow-lg p-8 space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Admin Setup</h1>
          <p className="text-xs text-muted-foreground">
            One-time setup to grant admin access. Requires the <code className="bg-muted px-1 rounded text-[11px]">SESSION_SECRET</code> from your Replit Secrets panel.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider">Setup Token</label>
            <p className="text-[11px] text-muted-foreground">Your SESSION_SECRET from Replit → Secrets</p>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Paste SESSION_SECRET here"
                className="pr-9 font-mono text-xs rounded-xl"
                required
              />
              <button
                type="button"
                onClick={() => setShowToken(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider">Account Email</label>
            <p className="text-[11px] text-muted-foreground">Email of the account to make admin</p>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="demo@telebit.app"
              className="font-mono text-xs rounded-xl"
              required
            />
          </div>

          <Button type="submit" disabled={loading || !token || !email} className="w-full rounded-xl h-11 font-bold">
            {loading ? "Setting up…" : "Grant Admin Access"}
          </Button>
        </form>

        {result && (
          <div className={`flex items-start gap-3 rounded-xl p-3 text-sm ${result.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
            {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{result.msg}{result.ok && " — refresh and sign in again."}</span>
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground">
          <a href="/sign-in" className="underline hover:text-foreground">← Back to sign in</a>
        </p>
      </div>
    </div>
  );
}
