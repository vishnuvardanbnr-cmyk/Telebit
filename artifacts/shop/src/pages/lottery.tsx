import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trophy, Ticket, Zap, CheckCircle2, Sparkles, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL;

async function apiFetch(path: string) {
  const res = await fetch(`${BASE}api/lottery${path}`, { credentials: "include" });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

type LotteryStatus = "draft" | "active" | "completed" | "cancelled";
type LotteryType = "random" | "custom";

type Lottery = {
  id: string; title: string; subtitle: string | null; description: string | null;
  type: LotteryType; status: LotteryStatus; ticketPrice: string; maxTickets: number;
  soldTickets: number; prizePool: string; currency: string; drawDate: string | null;
  winnerTicket: string | null; createdAt: string;
};

type MyTicket = {
  id: string; lotteryId: string; ticketNumber: string; status: "purchased" | "winning" | "losing";
  purchasedAt: string; lotteryTitle: string | null; lotteryStatus: string | null;
  prizePool: string | null; currency: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  active:    "bg-green-100 text-green-700",
  completed: "bg-muted text-muted-foreground",
  draft:     "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-600",
};

const TICKET_STYLE: Record<string, string> = {
  winning:   "bg-amber-50 text-amber-600 border-amber-200",
  losing:    "bg-muted text-muted-foreground border-border",
  purchased: "bg-primary/5 text-primary border-primary/20",
};

const PAGE_SIZE = 6;

function Pagination({
  page, total, pageSize, onChange,
}: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 mt-5">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
      ><ChevronLeft className="w-4 h-4" /></button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            "w-8 h-8 rounded-lg text-xs font-semibold border transition-colors",
            p === page ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/50",
          )}
        >{p}</button>
      ))}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
      ><ChevronRight className="w-4 h-4" /></button>
    </div>
  );
}

function LotteryCard({ lottery }: { lottery: Lottery }) {
  const fill = Math.round((lottery.soldTickets / lottery.maxTickets) * 100);
  const isActive = lottery.status === "active";
  const isCompleted = lottery.status === "completed";

  return (
    <div className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-border bg-gradient-to-r from-red-50/60 to-orange-50/30">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
              <Trophy className="w-4 h-4 text-red-500" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{lottery.title}</p>
              {lottery.subtitle && <p className="text-[11px] text-muted-foreground truncate font-medium">{lottery.subtitle}</p>}
            </div>
          </div>
          <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0", STATUS_STYLE[lottery.status] ?? "bg-muted text-muted-foreground")}>
            {lottery.status}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Prize", value: fmtUsdt(lottery.prizePool), sub: lottery.currency },
            { label: "Price", value: fmtUsdt(lottery.ticketPrice), sub: lottery.currency },
            { label: "Sold", value: `${lottery.soldTickets}/${lottery.maxTickets}`, sub: "tickets" },
          ].map(item => (
            <div key={item.label} className="rounded-xl p-2.5 text-center bg-muted/40 border border-border/50">
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">{item.label}</p>
              <p className="font-black text-sm mt-0.5 tabular-nums">{item.value}</p>
              <p className="text-[9px] text-muted-foreground font-medium">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* Progress */}
        {isActive && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                {lottery.type === "random" ? <><Zap className="w-3 h-3" />Random</> : <><Ticket className="w-3 h-3" />Pick number</>}
              </span>
              <span className="text-[10px] font-bold">{fill}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${fill}%` }} />
            </div>
          </div>
        )}

        {isCompleted && lottery.winnerTicket && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-xs text-emerald-700 font-bold">Winner: #{lottery.winnerTicket}</p>
          </div>
        )}

        {lottery.drawDate && isActive && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Draw: {new Date(lottery.drawDate).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
          </div>
        )}

        {isActive ? (
          <Link href={`/lottery/${lottery.id}`}>
            <button className="w-full h-10 text-sm font-bold rounded-xl flex items-center justify-center gap-2 text-white active:scale-[0.98] transition-all shadow-md"
              style={{ background: "linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)", boxShadow: "0 4px 14px -4px rgba(185,28,28,.35)" }}>
              <Sparkles className="w-4 h-4" />Buy Ticket
            </button>
          </Link>
        ) : (
          <Link href={`/lottery/${lottery.id}`}>
            <button className="w-full h-10 text-sm font-bold rounded-xl flex items-center justify-center text-muted-foreground border border-border bg-muted/30 hover:bg-muted/60 transition-all">
              View Results
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}

type Tab = "active" | "my-tickets" | "completed";

export default function Lottery() {
  const { data: user } = useGetMe();
  const [tab, setTab] = useState<Tab>("active");
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [myTickets, setMyTickets] = useState<MyTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const [ticketsPage, setTicketsPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    apiFetch("").then(setLotteries).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "my-tickets" && user) {
      apiFetch("/my-tickets").then(setMyTickets).catch(() => {});
    }
  }, [tab, user]);

  const active = lotteries.filter(l => l.status === "active");
  const completed = lotteries.filter(l => l.status === "completed");

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "active", label: "Active", count: active.length },
    { key: "my-tickets", label: "My Tickets", count: myTickets.length },
    { key: "completed", label: "Completed", count: completed.length },
  ];

  const pageOf = (items: unknown[], page: number) =>
    items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Lottery</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Buy tickets and win USDT prizes</p>
        </div>
        {user && (
          <div className="ml-auto text-right">
            <p className="text-[10px] text-muted-foreground">Balance</p>
            <p className="text-sm font-bold text-primary">{fmtUsdt(user.walletBalance)} USDT</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-muted/40 rounded-xl p-1 gap-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-semibold transition-all",
              tab === t.key ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Active lotteries */}
      {tab === "active" && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
            </div>
          ) : active.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border py-16 flex flex-col items-center gap-3 text-center">
              <Ticket className="w-10 h-10 text-muted-foreground/20" />
              <p className="text-sm font-semibold text-muted-foreground">No active lotteries</p>
              <p className="text-xs text-muted-foreground/60">Check back later for new draws</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(pageOf(active, activePage) as Lottery[]).map(l => <LotteryCard key={l.id} lottery={l} />)}
              </div>
              <Pagination page={activePage} total={active.length} pageSize={PAGE_SIZE} onChange={setActivePage} />
            </>
          )}
        </>
      )}

      {/* My tickets */}
      {tab === "my-tickets" && (
        <>
          {myTickets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border py-16 flex flex-col items-center gap-3 text-center">
              <Ticket className="w-10 h-10 text-muted-foreground/20" />
              <p className="text-sm font-semibold text-muted-foreground">No tickets yet</p>
              <p className="text-xs text-muted-foreground/60">Purchase from an active lottery</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(pageOf(myTickets, ticketsPage) as MyTicket[]).map(ticket => (
                  <Link key={ticket.id} href={`/lottery/${ticket.lotteryId}`}>
                    <div className="bg-white rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-4 flex items-center gap-3">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-mono font-black text-base border", TICKET_STYLE[ticket.status] ?? TICKET_STYLE.purchased)}>
                          {ticket.ticketNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{ticket.lotteryTitle ?? "Lottery"}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(ticket.purchasedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn(
                            "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                            ticket.status === "winning" ? "bg-amber-100 text-amber-700" :
                            ticket.status === "losing" ? "bg-muted text-muted-foreground" :
                            "bg-primary/10 text-primary",
                          )}>
                            {ticket.status === "winning" ? "Winner!" : ticket.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <Pagination page={ticketsPage} total={myTickets.length} pageSize={PAGE_SIZE} onChange={setTicketsPage} />
            </>
          )}
        </>
      )}

      {/* Completed */}
      {tab === "completed" && (
        <>
          {completed.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border py-16 flex flex-col items-center gap-3 text-center">
              <Trophy className="w-10 h-10 text-muted-foreground/20" />
              <p className="text-sm font-semibold text-muted-foreground">No completed lotteries</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(pageOf(completed, completedPage) as Lottery[]).map(l => <LotteryCard key={l.id} lottery={l} />)}
              </div>
              <Pagination page={completedPage} total={completed.length} pageSize={PAGE_SIZE} onChange={setCompletedPage} />
            </>
          )}
        </>
      )}
    </div>
  );
}
