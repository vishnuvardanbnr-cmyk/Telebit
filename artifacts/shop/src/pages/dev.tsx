import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Save, ArrowUpRight, Lock, Code2, DollarSign, Wallet, RefreshCw } from "lucide-react";

const BASE = import.meta.env.BASE_URL;
const API = `${BASE}api`;

type DevSettings = {
  depositFeeFlat: string;
  depositFeePercent: string;
  withdrawFeeFlat: string;
  withdrawFeePercent: string;
  devWallet: string;
  devAccumulatedFees: string;
};

function Field({
  label, hint, value, onChange, secret = false,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; secret?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</label>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
      <div className="relative">
        <input
          type={secret && !show ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:border-violet-500 transition-colors"
          placeholder={secret ? "••••••••" : undefined}
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DevPanelPage() {
  const [secret, setSecret] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");

  const [settings, setSettings] = useState<DevSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // New password change
  const [newPassword, setNewPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);

  const loadSettings = useCallback(async (s: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/dev/settings`, {
        headers: { "x-dev-secret": s },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Failed to load");
      }
      const data = await res.json();
      setSettings(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = async () => {
    setAuthError("");
    const res = await fetch(`${API}/dev/settings`, {
      headers: { "x-dev-secret": secretInput },
    });
    if (res.ok) {
      setSecret(secretInput);
      setAuthed(true);
      const data = await res.json();
      setSettings(data);
    } else {
      setAuthError("Invalid password");
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const body: any = { ...settings };
      if (newPassword.trim()) body.devPanelPassword = newPassword.trim();
      const res = await fetch(`${API}/dev/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-dev-secret": secret },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Settings saved");
      if (newPassword.trim()) {
        setSecret(newPassword.trim());
        setNewPassword("");
        toast.info("Password updated — using new password for this session");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTransfer = async () => {
    if (!settings?.devWallet) {
      toast.error("Configure dev wallet address first");
      return;
    }
    const accumulated = parseFloat(settings.devAccumulatedFees || "0");
    if (accumulated <= 0) {
      toast.error("No accumulated fees to transfer");
      return;
    }
    setTransferring(true);
    try {
      const res = await fetch(`${API}/dev/transfer`, {
        method: "POST",
        headers: { "x-dev-secret": secret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transfer failed");
      toast.success(`Transferred ${accumulated.toFixed(4)} USDT → ${settings.devWallet.slice(0, 10)}…`);
      await loadSettings(secret);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTransferring(false);
    }
  };

  const set = (key: keyof DevSettings) => (v: string) =>
    setSettings((prev) => prev ? { ...prev, [key]: v } : prev);

  // ── Password gate ────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-2">
              <Code2 className="w-7 h-7 text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Dev Panel</h1>
            <p className="text-sm text-slate-500">Telebit internal tools</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm pl-10 pr-3 py-2.5 rounded-lg focus:outline-none focus:border-violet-500 transition-colors"
                  placeholder="Enter dev password"
                  autoFocus
                />
              </div>
              {authError && <p className="text-xs text-red-400">{authError}</p>}
            </div>
            <button
              onClick={handleLogin}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-2.5 rounded-xl transition-colors"
            >
              Unlock
            </button>
          </div>
          <p className="text-center text-[11px] text-slate-600">Default: telebit-dev-2024</p>
        </div>
      </div>
    );
  }

  // ── Main panel ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-4 py-8">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Code2 className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Dev Panel</h1>
            <p className="text-xs text-slate-500">Fee control &amp; dev wallet management</p>
          </div>
          <button
            onClick={() => loadSettings(secret)}
            disabled={loading}
            className="ml-auto p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Accumulated fees card */}
        <div className="rounded-2xl bg-gradient-to-br from-violet-900/30 to-slate-900/60 border border-violet-500/20 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-bold text-violet-300 uppercase tracking-wider">Accumulated Dev Fees</span>
          </div>
          <div className="text-3xl font-bold tabular-nums">
            {parseFloat(settings?.devAccumulatedFees || "0").toFixed(4)}
            <span className="text-lg text-slate-400 ml-1">USDT</span>
          </div>
          <p className="text-xs text-slate-500">
            Fees collected from deposits &amp; withdrawals. Transfer on-chain to your dev wallet below.
          </p>
          <button
            onClick={handleTransfer}
            disabled={transferring || parseFloat(settings?.devAccumulatedFees || "0") <= 0}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm py-3 rounded-xl transition-colors"
          >
            {transferring ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUpRight className="w-4 h-4" />
            )}
            {transferring ? "Transferring…" : "Transfer to Dev Wallet"}
          </button>
        </div>

        {/* Dev wallet */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-emerald-300 uppercase tracking-wider">Dev Wallet</span>
          </div>
          {settings && (
            <Field
              label="BEP-20 Wallet Address"
              hint="Accumulated fees will be sent to this address"
              value={settings.devWallet}
              onChange={set("devWallet")}
            />
          )}
        </div>

        {/* Fee settings */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-300 uppercase tracking-wider">Fee Settings</span>
          </div>
          {settings && (
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Deposit Fee (flat USDT)"
                hint="Fixed amount deducted per deposit"
                value={settings.depositFeeFlat}
                onChange={set("depositFeeFlat")}
              />
              <Field
                label="Deposit Fee (%)"
                hint="Percentage of deposit amount"
                value={settings.depositFeePercent}
                onChange={set("depositFeePercent")}
              />
              <Field
                label="Withdraw Fee (flat USDT)"
                hint="Fixed amount deducted per withdrawal"
                value={settings.withdrawFeeFlat}
                onChange={set("withdrawFeeFlat")}
              />
              <Field
                label="Withdraw Fee (%)"
                hint="Percentage of withdrawal amount"
                value={settings.withdrawFeePercent}
                onChange={set("withdrawFeePercent")}
              />
            </div>
          )}
        </div>

        {/* Change password */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Change Password</span>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">New Password</label>
            <div className="relative">
              <input
                type={showNewPw ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 font-mono text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:border-violet-500 transition-colors pr-9"
                placeholder="Leave blank to keep current"
              />
              <button
                type="button"
                onClick={() => setShowNewPw((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || !settings}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-2xl transition-colors"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : "Save All Settings"}
        </button>

        <p className="text-center text-[10px] text-slate-700 pb-4">
          Telebit Dev Panel · Not visible to admin users
        </p>
      </div>
    </div>
  );
}
