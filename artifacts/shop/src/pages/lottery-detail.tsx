import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Trophy, Ticket, Zap, ArrowLeft, Loader2, Sparkles, CheckCircle2, Clock,
} from "lucide-react";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL;

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}api/lottery${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

type Lottery = {
  id: string; title: string; subtitle: string | null; description: string | null;
  type: "random" | "custom"; status: "draft" | "active" | "completed" | "cancelled";
  ticketPrice: string; maxTickets: number; soldTickets: number; prizePool: string;
  currency: string; drawDate: string | null; winnerTicket: string | null; createdAt: string;
};

type SoldTicket = {
  id: string; ticketNumber: string; status: "purchased" | "winning" | "losing";
  purchasedAt: string;
};

export default function LotteryDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useGetMe();

  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [tickets, setTickets] = useState<SoldTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [customNumber, setCustomNumber] = useState("");

  const fetchLottery = () => {
    apiFetch(`/${id}`).then(setLottery).catch(() => setLottery(null)).finally(() => setLoading(false));
  };
  const fetchTickets = () => {
    apiFetch(`/${id}/tickets`).then(setTickets).catch(() => {});
  };

  useEffect(() => {
    fetchLottery();
    fetchTickets();
    const interval = setInterval(fetchTickets, 6000);
    return () => clearInterval(interval);
  }, [id]);

  const handlePurchase = async () => {
    if (!user || !lottery) return;
    if (lottery.type === "custom") {
      if (!/^\d{3}$/.test(customNumber) || parseInt(customNumber) < 100 || parseInt(customNumber) > 999) {
        toast.error("Enter a valid 3-digit number (100–999)"); return;
      }
    }
    setPurchasing(true);
    try {
      const data = await apiFetch(`/${id}/purchase`, {
        method: "POST",
        body: JSON.stringify({ ticketNumber: lottery.type === "custom" ? customNumber : undefined }),
      });
      toast.success(`Ticket purchased! Your number: #${data.ticketNumber}`);
      setCustomNumber("");
      fetchLottery();
      fetchTickets();
    } catch (err: any) {
      toast.error(err.message ?? "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-5 w-32 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!lottery) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground mb-4">Lottery not found</p>
        <Link href="/lottery"><Button variant="outline" size="sm">Back to Lottery</Button></Link>
      </div>
    );
  }

  const fill = Math.round((lottery.soldTickets / lottery.maxTickets) * 100);
  const isActive = lottery.status === "active";
  const balance = parseFloat(user?.walletBalance ?? "0");
  const price = parseFloat(lottery.ticketPrice);
  const canAfford = balance >= price;

  const PurchaseCard = () => (
    <div className="space-y-4">
      {lottery.type === "custom" && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">
            Your Lucky Number (100–999)
          </label>
          <Input
            placeholder="e.g. 247"
            value={customNumber}
            onChange={e => setCustomNumber(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className="font-mono text-center text-2xl tracking-widest h-14 rounded-xl"
            maxLength={3}
          />
        </div>
      )}

      <div className="rounded-xl bg-muted/40 border border-border/50 p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Ticket Price</span>
          <span className="font-bold">{fmtUsdt(lottery.ticketPrice)} {lottery.currency}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Your Balance</span>
          <span className={cn("font-bold", canAfford ? "text-green-600" : "text-red-500")}>
            {fmtUsdt(user?.walletBalance ?? "0")} USDT
          </span>
        </div>
      </div>

      {!canAfford && <p className="text-xs text-red-500 font-semibold text-center">Insufficient balance — top up your wallet</p>}

      <button
        onClick={handlePurchase}
        disabled={purchasing || !canAfford || !user}
        className="w-full h-11 text-sm font-bold rounded-xl flex items-center justify-center gap-2 text-white active:scale-[0.98] transition-all disabled:opacity-50 shadow-md"
        style={{ background: "linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)", boxShadow: "0 4px 14px -4px rgba(185,28,28,.35)" }}
      >
        {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {purchasing ? "Purchasing…" : "Buy Ticket"}
      </button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Back */}
      <Link href="/lottery">
        <button className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> All Lotteries
        </button>
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">{lottery.title}</h1>
        {lottery.subtitle && <p className="text-sm font-medium text-muted-foreground mt-0.5">{lottery.subtitle}</p>}
        {lottery.description && <p className="text-xs text-muted-foreground mt-1">{lottery.description}</p>}
      </div>

      {/* Mobile purchase card */}
      {isActive && (
        <div className="lg:hidden bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buy Ticket</p>
            <p className="text-[11px] text-muted-foreground">
              {lottery.type === "random" ? "A random 3-digit number (100–999) will be assigned" : "Choose your own 3-digit lucky number (100–999)"}
            </p>
          </div>
          <div className="p-4"><PurchaseCard /></div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: details + tickets */}
        <div className="lg:col-span-2 space-y-5">
          {/* Stats */}
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Prize Pool", value: fmtUsdt(lottery.prizePool), sub: lottery.currency, highlight: true },
                { label: "Ticket Price", value: fmtUsdt(lottery.ticketPrice), sub: lottery.currency },
                { label: "Sold", value: String(lottery.soldTickets), sub: `of ${lottery.maxTickets}` },
                { label: "Type", value: lottery.type, sub: lottery.type === "random" ? "auto-assign" : "pick number", icon: lottery.type === "random" ? <Zap className="w-3.5 h-3.5 text-amber-500" /> : <Ticket className="w-3.5 h-3.5 text-red-500" /> },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3 text-center bg-muted/40 border border-border/50">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">{item.label}</p>
                  {'icon' in item ? (
                    <div className="flex items-center justify-center gap-1 mt-1.5">
                      {item.icon}
                      <p className="font-bold text-sm capitalize">{item.value}</p>
                    </div>
                  ) : (
                    <p className={cn("text-xl font-black mt-1 tabular-nums", item.highlight ? "text-amber-600" : "")}>{item.value}</p>
                  )}
                  <p className="text-[9px] text-muted-foreground font-medium mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Sales Progress</span>
                <span className="text-[10px] font-black">{fill}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${fill}%` }} />
              </div>
            </div>

            {lottery.drawDate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>Draw scheduled: {new Date(lottery.drawDate).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
            )}

            {lottery.status === "completed" && lottery.winnerTicket && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
                <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-700">Draw Complete!</p>
                  <p className="text-xs text-emerald-600">Winning Ticket: <span className="font-mono font-black">#{lottery.winnerTicket}</span></p>
                </div>
              </div>
            )}
          </div>

          {/* Sold tickets */}
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Sold Tickets ({tickets.length})
              </p>
            </div>
            <div className="p-5">
              {tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tickets sold yet. Be the first!</p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto">
                  {tickets.map(t => (
                    <div
                      key={t.id}
                      className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold border",
                        t.status === "winning" ? "bg-amber-50 text-amber-600 border-amber-200" :
                        t.status === "losing"  ? "bg-muted/50 text-muted-foreground border-border" :
                        "bg-primary/5 text-primary border-primary/20",
                      )}
                    >
                      {t.ticketNumber}
                      {t.status === "winning" && <CheckCircle2 className="w-3 h-3 ml-1" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: desktop purchase card */}
        <div className="hidden lg:block">
          {isActive ? (
            <div className="sticky top-20 bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-muted/20">
                <p className="text-sm font-semibold">Buy a Ticket</p>
                <p className="text-xs text-muted-foreground">
                  {lottery.type === "random" ? "A random number (100–999) will be assigned" : "Pick your lucky 3-digit number (100–999)"}
                </p>
              </div>
              <div className="p-5"><PurchaseCard /></div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border shadow-sm p-5 text-center">
              <span className="text-xs font-semibold uppercase px-3 py-1 rounded-full bg-muted text-muted-foreground">
                {lottery.status}
              </span>
              <p className="text-sm text-muted-foreground mt-3 font-medium">
                {lottery.status === "completed" ? "This lottery has ended" : "Not accepting tickets"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
