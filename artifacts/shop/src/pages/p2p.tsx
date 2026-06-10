import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Link } from "wouter";
import { ArrowLeftRight, Plus, X, ChevronLeft, ChevronRight, MessageSquare, CheckCircle2, AlertTriangle, Clock, Ban, RotateCcw, Send, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtUsdt } from "@/lib/utils";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL;

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}api/shop/p2p${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "paypal", label: "PayPal" },
  { value: "revolut", label: "Revolut" },
  { value: "wise", label: "Wise" },
  { value: "cash", label: "Cash" },
  { value: "crypto_transfer", label: "Crypto Transfer" },
  { value: "other", label: "Other" },
];

function pmLabel(value: string) {
  return PAYMENT_METHODS.find(p => p.value === value)?.label ?? value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

type AdStatus = "active" | "paused" | "completed" | "cancelled";
type OrderStatus = "pending" | "paid" | "released" | "cancelled" | "disputed" | "resolved";

type Ad = {
  id: string; userId: string; displayName: string;
  side: "buy" | "sell"; price: string; minAmount: string; maxAmount: string;
  availableAmount: string; paymentMethods: string[]; paymentWindow: number;
  terms?: string; status: AdStatus; completedOrders: number; createdAt: string;
};

type Order = {
  id: string; adId: string; buyerUserId: string; sellerUserId: string;
  amount: string; price: string; paymentMethod: string; paymentNote?: string;
  status: OrderStatus; paymentDeadline: string; paidAt?: string; releasedAt?: string;
  cancelledAt?: string; cancelReason?: string; disputeDescription?: string;
  buyerName: string; sellerName: string; adSide?: "buy" | "sell";
  createdAt: string; updatedAt: string;
};

type Message = {
  id: string; orderId: string; senderUserId: string; senderName: string;
  content: string; isSystem: boolean; createdAt: string;
};

type OrderDetail = Order & { ad?: Ad; messages: Message[] };

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; cls: string }> = {
    pending: { label: "Pending Payment", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    paid: { label: "Payment Sent", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    released: { label: "Completed", cls: "bg-green-50 text-green-700 border-green-200" },
    cancelled: { label: "Cancelled", cls: "bg-gray-50 text-gray-500 border-gray-200" },
    disputed: { label: "Disputed", cls: "bg-red-50 text-red-700 border-red-200" },
    resolved: { label: "Resolved", cls: "bg-green-50 text-green-700 border-green-200" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
  return <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", cls)}>{label}</span>;
}

// ─── Ad Card ──────────────────────────────────────────────────────────────────
function AdCard({ ad, myUserId, onOrder }: { ad: Ad; myUserId?: string; onOrder: (ad: Ad) => void }) {
  const isOwn = ad.userId === myUserId;
  const isBuyAd = ad.side === "buy";

  return (
    <div className="bg-white border border-border rounded-xl p-4 flex flex-col gap-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-foreground">{ad.displayName}</span>
            {ad.completedOrders > 0 && (
              <span className="text-[10px] text-muted-foreground">{ad.completedOrders} trades</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {ad.paymentMethods.slice(0, 3).map(pm => (
              <span key={pm} className="text-[10px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-md border border-border">
                {pmLabel(pm)}
              </span>
            ))}
            {ad.paymentMethods.length > 3 && (
              <span className="text-[10px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-md border border-border">
                +{ad.paymentMethods.length - 3}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-primary leading-tight">
            {parseFloat(ad.price).toLocaleString("en-US", { maximumFractionDigits: 4 })}
          </div>
          <div className="text-[10px] text-muted-foreground">price per USDT</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Available: <span className="font-medium text-foreground">{parseFloat(ad.availableAmount).toFixed(2)} USDT</span></span>
        <span>Limit: <span className="font-medium text-foreground">{parseFloat(ad.minAmount).toFixed(0)}–{parseFloat(ad.maxAmount).toFixed(0)} USDT</span></span>
      </div>

      {isOwn ? (
        <div className="text-center py-2 text-xs text-muted-foreground border border-dashed border-border rounded-lg">Your Ad</div>
      ) : (
        <button
          onClick={() => onOrder(ad)}
          className={cn(
            "w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90",
            isBuyAd ? "bg-emerald-500 hover:bg-emerald-600" : "bg-primary hover:bg-primary/90"
          )}
        >
          {isBuyAd ? "Sell USDT" : "Buy USDT"}
        </button>
      )}
    </div>
  );
}

// ─── Post Ad Modal ─────────────────────────────────────────────────────────────
function PostAdModal({ onClose, onPosted, walletBalance }: { onClose: () => void; onPosted: () => void; walletBalance: number }) {
  const [side, setSide] = useState<"buy" | "sell">("sell");
  const [price, setPrice] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [availableAmount, setAvailableAmount] = useState("");
  const [paymentWindow, setPaymentWindow] = useState(30);
  const [selectedPms, setSelectedPms] = useState<string[]>([]);
  const [terms, setTerms] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function togglePm(pm: string) {
    setSelectedPms(prev => prev.includes(pm) ? prev.filter(p => p !== pm) : [...prev, pm]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!price || !minAmount || !maxAmount || !availableAmount) { setErr("All amount fields are required"); return; }
    if (selectedPms.length === 0) { setErr("Select at least one payment method"); return; }
    if (side === "sell" && parseFloat(availableAmount) > walletBalance) {
      setErr(`Insufficient balance. You have ${walletBalance.toFixed(2)} USDT`); return;
    }
    setLoading(true);
    try {
      await api("/ads", {
        method: "POST",
        body: JSON.stringify({ side, price, minAmount, maxAmount, availableAmount, paymentMethods: selectedPms, paymentWindow, terms: terms || undefined }),
      });
      toast.success("Ad posted successfully");
      onPosted();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to post ad");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <h2 className="text-base font-bold">Post P2P Ad</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="flex gap-2">
            {(["sell", "buy"] as const).map(s => (
              <button key={s} type="button" onClick={() => setSide(s)}
                className={cn("flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors",
                  side === s
                    ? s === "sell" ? "border-primary bg-primary/10 text-primary" : "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-border text-muted-foreground"
                )}>
                {s === "sell" ? "I'm Selling USDT" : "I'm Buying USDT"}
              </button>
            ))}
          </div>

          {side === "sell" && (
            <div className="text-xs text-muted-foreground bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
              Balance: <span className="font-semibold text-foreground">{walletBalance.toFixed(2)} USDT</span> available to lock
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Price (per USDT)</label>
            <input type="number" step="0.0001" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 1.02" required
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Min Amount (USDT)</label>
              <input type="number" step="0.01" min="0" value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="10" required
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Max Amount (USDT)</label>
              <input type="number" step="0.01" min="0" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} placeholder="500" required
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
              Total Available (USDT){side === "sell" && <span className="text-red-400 ml-1">*will be locked</span>}
            </label>
            <input type="number" step="0.01" min="0" value={availableAmount} onChange={e => setAvailableAmount(e.target.value)} placeholder="1000" required
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Payment Methods</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map(pm => (
                <button key={pm.value} type="button" onClick={() => togglePm(pm.value)}
                  className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors",
                    selectedPms.includes(pm.value)
                      ? "bg-primary text-white border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  )}>
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Payment Window (minutes)</label>
            <select value={paymentWindow} onChange={e => setPaymentWindow(Number(e.target.value))}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
              {[15, 30, 45, 60, 90, 120].map(v => <option key={v} value={v}>{v} minutes</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Trade Terms (optional)</label>
            <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={2} maxLength={500} placeholder="Any specific requirements for this trade..."
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
          </div>

          {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-opacity disabled:opacity-60">
            {loading ? "Posting…" : side === "sell" ? "Post Sell Ad" : "Post Buy Ad"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Place Order Modal ────────────────────────────────────────────────────────
function PlaceOrderModal({ ad, onClose, onPlaced, walletBalance }: { ad: Ad; onClose: () => void; onPlaced: (order: Order) => void; walletBalance: number }) {
  const [amount, setAmount] = useState(ad.minAmount);
  const [paymentMethod, setPaymentMethod] = useState(ad.paymentMethods[0] ?? "");
  const [paymentNote, setPaymentNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const isBuyAd = ad.side === "buy";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const amt = parseFloat(amount);
    if (isBuyAd && amt > walletBalance) {
      setErr(`Insufficient balance. You have ${walletBalance.toFixed(2)} USDT`); return;
    }
    setLoading(true);
    try {
      const order = await api("/orders", {
        method: "POST",
        body: JSON.stringify({ adId: ad.id, amount, paymentMethod, paymentNote: paymentNote || undefined }),
      });
      toast.success("Order placed successfully");
      onPlaced(order);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to place order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <h2 className="text-base font-bold">{isBuyAd ? "Sell USDT" : "Buy USDT"}</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-5 pt-4 pb-2 bg-muted/30">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Advertiser</span>
            <span className="font-medium">{ad.displayName}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Price</span>
            <span className="font-semibold text-primary">{parseFloat(ad.price).toLocaleString()} / USDT</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Limit</span>
            <span>{parseFloat(ad.minAmount).toFixed(0)} – {parseFloat(ad.maxAmount).toFixed(0)} USDT</span>
          </div>
          {ad.terms && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/60">{ad.terms}</p>}
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {isBuyAd && (
            <div className="text-xs text-muted-foreground bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
              Your balance: <span className="font-semibold text-foreground">{walletBalance.toFixed(2)} USDT</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Amount (USDT)</label>
            <input type="number" step="0.01" min={ad.minAmount} max={Math.min(parseFloat(ad.maxAmount), parseFloat(ad.availableAmount)).toString()} value={amount} onChange={e => setAmount(e.target.value)} required
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Payment Method</label>
            <div className="flex flex-wrap gap-2">
              {ad.paymentMethods.map(pm => (
                <button key={pm} type="button" onClick={() => setPaymentMethod(pm)}
                  className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors",
                    paymentMethod === pm ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                  )}>
                  {pmLabel(pm)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Note to {isBuyAd ? "buyer" : "seller"} (optional)</label>
            <textarea value={paymentNote} onChange={e => setPaymentNote(e.target.value)} rows={2} maxLength={500} placeholder="Optional message..."
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
          </div>

          {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}

          <button type="submit" disabled={loading}
            className={cn("w-full py-3 rounded-xl font-semibold text-sm text-white transition-opacity disabled:opacity-60",
              isBuyAd ? "bg-emerald-500 hover:bg-emerald-600" : "bg-primary hover:bg-primary/90")}>
            {loading ? "Placing order…" : isBuyAd ? "Sell USDT" : "Buy USDT"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Trade Room Modal ─────────────────────────────────────────────────────────
function TradeRoomModal({ order: initialOrder, myUserId, onClose, onUpdated }: {
  order: Order; myUserId: string; onClose: () => void; onUpdated: () => void;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBuyer = initialOrder.buyerUserId === myUserId;
  const isSeller = initialOrder.sellerUserId === myUserId;

  async function loadOrder() {
    try {
      const data = await api(`/orders/${initialOrder.id}`);
      setOrder(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrder();
    pollRef.current = setInterval(() => { void loadOrder(); }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [initialOrder.id]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [order?.messages.length]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!msgText.trim() || sending) return;
    setSending(true);
    try {
      await api(`/orders/${initialOrder.id}/messages`, { method: "POST", body: JSON.stringify({ content: msgText.trim() }) });
      setMsgText("");
      await loadOrder();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function doAction(endpoint: string, body?: object, successMsg?: string) {
    setActionLoading(true);
    try {
      await api(`/orders/${initialOrder.id}/${endpoint}`, { method: "POST", body: JSON.stringify(body ?? {}) });
      toast.success(successMsg ?? "Done");
      await loadOrder();
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  const status = order?.status ?? initialOrder.status;
  const deadline = new Date(order?.paymentDeadline ?? initialOrder.paymentDeadline);
  const now = new Date();
  const minutesLeft = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 60000));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Trade Room</span>
            <StatusBadge status={status} />
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {/* Order summary */}
        {order && (
          <div className="px-4 py-3 border-b border-border bg-muted/30 shrink-0">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{isBuyer ? `Buying from ${order.sellerName}` : `Selling to ${order.buyerName}`}</span>
              <span className="font-bold text-primary">{parseFloat(order.amount).toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Via {pmLabel(order.paymentMethod)}</span>
              {status === "pending" && (
                <span className={cn("flex items-center gap-1", minutesLeft < 5 ? "text-red-500" : "text-muted-foreground")}>
                  <Clock className="h-3 w-3" />
                  {minutesLeft}m left
                </span>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-3/4 rounded-xl" />)}</div>
          ) : order?.messages.map(msg => (
            <div key={msg.id} className={cn(
              "flex",
              msg.isSystem ? "justify-center" : msg.senderUserId === myUserId ? "justify-end" : "justify-start"
            )}>
              {msg.isSystem ? (
                <div className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full max-w-xs text-center leading-snug">
                  {msg.content}
                </div>
              ) : (
                <div className={cn("max-w-[70%] rounded-2xl px-3 py-2 text-sm",
                  msg.senderUserId === myUserId
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-muted/60 text-foreground rounded-bl-sm"
                )}>
                  {msg.senderUserId !== myUserId && (
                    <div className="text-[10px] font-semibold mb-0.5 opacity-70">{msg.senderName}</div>
                  )}
                  {msg.content}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Actions */}
        {order && !["released", "cancelled", "resolved"].includes(status) && (
          <div className="px-4 py-3 border-t border-border space-y-2 shrink-0">
            {isBuyer && status === "pending" && (
              <button onClick={() => doAction("pay", {}, "Payment marked as sent")} disabled={actionLoading}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {actionLoading ? "Processing…" : "I've Paid — Mark as Sent"}
              </button>
            )}
            {isSeller && status === "paid" && (
              <button onClick={() => doAction("release", {}, "USDT released to buyer")} disabled={actionLoading}
                className="w-full py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 disabled:opacity-60 flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {actionLoading ? "Processing…" : "Payment Received — Release USDT"}
              </button>
            )}
            {status === "paid" && !showDispute && (
              <button onClick={() => setShowDispute(true)}
                className="w-full py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 flex items-center justify-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Open Dispute
              </button>
            )}
            {showDispute && (
              <div className="space-y-2">
                <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)} rows={2}
                  placeholder="Describe the issue..."
                  className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-300 resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => setShowDispute(false)} className="flex-1 py-2 border border-border rounded-xl text-sm text-muted-foreground hover:bg-muted/50">Cancel</button>
                  <button onClick={() => { if (disputeReason.trim()) { void doAction("dispute", { reason: disputeReason }, "Dispute opened"); setShowDispute(false); } }}
                    disabled={!disputeReason.trim() || actionLoading}
                    className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-60">
                    Submit Dispute
                  </button>
                </div>
              </div>
            )}
            {(status === "pending") && (
              <div className="flex gap-2 mt-1">
                <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Cancel reason (optional)"
                  className="flex-1 border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-primary" />
                <button onClick={() => doAction("cancel", { reason: cancelReason || undefined }, "Order cancelled")} disabled={actionLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted/50 hover:border-red-200 hover:text-red-600">
                  <Ban className="h-3.5 w-3.5" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Message input */}
        {!["released", "cancelled"].includes(status) && (
          <form onSubmit={sendMessage} className="flex gap-2 px-4 py-3 border-t border-border shrink-0">
            <input value={msgText} onChange={e => setMsgText(e.target.value)} placeholder="Type a message…"
              className="flex-1 border border-border rounded-full px-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            <button type="submit" disabled={!msgText.trim() || sending}
              className="p-2 bg-primary text-white rounded-full hover:bg-primary/90 disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Orders List Modal ────────────────────────────────────────────────────────
function MyOrdersModal({ myUserId, onClose, onOpenOrder }: { myUserId: string; onClose: () => void; onOpenOrder: (order: Order) => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/my-orders").then(d => setOrders(d.orders ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold">My Orders</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {loading ? (
            <>{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</>
          ) : orders.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No orders yet</div>
          ) : orders.map(order => {
            const isBuyer = order.buyerUserId === myUserId;
            const counterparty = isBuyer ? order.sellerName : order.buyerName;
            const active = ["pending", "paid", "disputed"].includes(order.status);
            return (
              <button key={order.id} onClick={() => { onOpenOrder(order); onClose(); }}
                className="w-full text-left bg-white border border-border rounded-xl p-3.5 hover:border-primary/40 hover:bg-primary/5 transition-all">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold">{isBuyer ? "Buying" : "Selling"} {parseFloat(order.amount).toFixed(2)} USDT</span>
                  <StatusBadge status={order.status} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{isBuyer ? `From ${counterparty}` : `To ${counterparty}`}</span>
                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
                {active && (
                  <div className="mt-2 text-xs text-primary font-medium">Tap to continue →</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main P2P Page ────────────────────────────────────────────────────────────
export default function P2PPage() {
  const { user: dbUser, isSignedIn: user } = useAuth();
  const walletBalance = parseFloat(String(dbUser?.walletBalance ?? "0"));

  const [side, setSide] = useState<"buy" | "sell">("sell");
  const [ads, setAds] = useState<Ad[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const [showPostAd, setShowPostAd] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [showMyOrders, setShowMyOrders] = useState(false);

  const LIMIT = 20;
  const totalPages = Math.ceil(total / LIMIT);

  async function loadAds(p: number, s: "buy" | "sell") {
    setLoading(true);
    try {
      const data = await api(`/ads?side=${s}&offset=${p * LIMIT}`);
      setAds(data.ads ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(0);
    void loadAds(0, side);
  }, [side]);

  function changePage(newPage: number) {
    setPage(newPage);
    void loadAds(newPage, side);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">P2P Market</h1>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <>
              <button
                onClick={() => setShowMyOrders(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                My Orders
              </button>
              <button
                onClick={() => setShowPostAd(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary rounded-lg px-3 py-1.5 hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Post Ad
              </button>
            </>
          )}
        </div>
      </div>

      {/* Balance strip */}
      {user && dbUser && (
        <div className="flex items-center justify-between bg-muted/40 border border-border rounded-xl px-4 py-2.5 mb-5 text-sm">
          <span className="text-muted-foreground">Your USDT Balance</span>
          <span className="font-bold">{fmtUsdt(dbUser.walletBalance)} USDT</span>
        </div>
      )}

      {/* Buy / Sell tabs */}
      <div className="flex gap-2 mb-4">
        {(["sell", "buy"] as const).map(s => (
          <button key={s} onClick={() => setSide(s)}
            className={cn("flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all",
              side === s
                ? s === "sell" ? "border-primary bg-primary/10 text-primary" : "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-border text-muted-foreground hover:border-muted-foreground"
            )}>
            {s === "sell" ? "Buy USDT (Sell ads)" : "Sell USDT (Buy ads)"}
          </button>
        ))}
      </div>

      {/* Ad listing */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>
      ) : ads.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ArrowLeftRight className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-foreground">No ads available</p>
          <p className="text-sm mt-1">Be the first to post a {side === "sell" ? "sell" : "buy"} ad</p>
          {user && (
            <button onClick={() => setShowPostAd(true)} className="mt-4 px-5 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90">
              Post Ad
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map(ad => (
            <AdCard key={ad.id} ad={ad} myUserId={dbUser?.id} onOrder={ad => {
              if (!user) { toast.error("Please sign in to trade"); return; }
              setSelectedAd(ad);
            }} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => changePage(page - 1)} disabled={page === 0}
            className="flex items-center gap-1 px-4 py-2 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <button onClick={() => changePage(page + 1)} disabled={page >= totalPages - 1}
            className="flex items-center gap-1 px-4 py-2 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-40">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Modals */}
      {showPostAd && (
        <PostAdModal
          walletBalance={walletBalance}
          onClose={() => setShowPostAd(false)}
          onPosted={() => { void loadAds(page, side); }}
        />
      )}

      {selectedAd && user && dbUser && (
        <PlaceOrderModal
          ad={selectedAd}
          walletBalance={walletBalance}
          onClose={() => setSelectedAd(null)}
          onPlaced={order => { setSelectedAd(null); setActiveOrder(order); void loadAds(page, side); }}
        />
      )}

      {activeOrder && user && dbUser && (
        <TradeRoomModal
          order={activeOrder}
          myUserId={dbUser.id}
          onClose={() => setActiveOrder(null)}
          onUpdated={() => { void loadAds(page, side); }}
        />
      )}

      {showMyOrders && user && dbUser && (
        <MyOrdersModal
          myUserId={dbUser.id}
          onClose={() => setShowMyOrders(false)}
          onOpenOrder={order => { setActiveOrder(order); }}
        />
      )}
    </div>
  );
}
