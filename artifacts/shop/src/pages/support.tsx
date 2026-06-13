import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  MessageCircle, Plus, Send, ChevronLeft,
  Clock, CheckCircle2, AlertCircle, Loader2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL;

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}api/support${path}`, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

type Ticket = {
  id: number; subject: string; status: string;
  createdAt: string; updatedAt: string;
};
type Message = {
  id: number; ticketId: number; senderName: string;
  isAdmin: boolean; message: string; createdAt: string;
};

const STATUS = {
  open:        { label: "Open",        color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200",   icon: AlertCircle },
  in_progress: { label: "In Progress", color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200",  icon: Clock },
  closed:      { label: "Closed",      color: "text-slate-500",  bg: "bg-slate-100", border: "border-slate-200",  icon: CheckCircle2 },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SupportPage() {
  const { data: user } = useGetMe();
  const [view, setView] = useState<"list" | "chat" | "new">("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTickets = useCallback(async () => {
    try {
      const d = await apiFetch("/tickets");
      setTickets(d.data ?? []);
    } catch { /* ignore */ }
    finally { setLoadingTickets(false); }
  }, []);

  const loadChat = useCallback(async (id: number, silent = false) => {
    if (!silent) setLoadingChat(true);
    try {
      const d = await apiFetch(`/tickets/${id}`);
      setActiveTicket(d.ticket);
      setMessages(d.messages ?? []);
    } catch { /* ignore */ }
    finally { setLoadingChat(false); }
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => {
    if (view === "chat" && activeTicket) {
      pollRef.current = setInterval(() => loadChat(activeTicket.id, true), 4000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [view, activeTicket?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openTicket = async (ticket: Ticket) => {
    setActiveTicket(ticket);
    setView("chat");
    await loadChat(ticket.id);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !activeTicket || activeTicket.status === "closed") return;
    setSending(true);
    try {
      const msg = await apiFetch(`/tickets/${activeTicket.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      setMessages(prev => [...prev, msg]);
      setInput("");
      setActiveTicket(prev => prev ? { ...prev, updatedAt: new Date().toISOString() } : prev);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send");
    } finally { setSending(false); }
  };

  const createTicket = async () => {
    if (!newSubject.trim()) { toast.error("Subject is required"); return; }
    setCreating(true);
    try {
      const ticket = await apiFetch("/tickets", {
        method: "POST",
        body: JSON.stringify({ subject: newSubject.trim(), message: newMessage.trim() || undefined }),
      });
      setTickets(prev => [ticket, ...prev]);
      setNewSubject(""); setNewMessage("");
      toast.success("Ticket created! We'll respond shortly.");
      openTicket(ticket);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create ticket");
    } finally { setCreating(false); }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-24">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(view === "chat" || view === "new") && (
            <button
              onClick={() => { setView("list"); setActiveTicket(null); loadTickets(); }}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {view === "list" ? "Support" : view === "new" ? "New Ticket" : activeTicket?.subject}
            </h1>
            {view === "list" && (
              <p className="text-xs text-muted-foreground mt-0.5">We're here to help — avg response &lt; 24h</p>
            )}
          </div>
        </div>
        {view === "list" && (
          <Button size="sm" onClick={() => setView("new")} className="gap-1.5">
            <Plus className="w-4 h-4" /> New Ticket
          </Button>
        )}
      </div>

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <>
          {loadingTickets ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white flex flex-col items-center gap-3 py-14 text-center px-6">
              <MessageCircle className="w-10 h-10 text-muted-foreground/20" />
              <p className="text-sm font-semibold text-foreground">No tickets yet</p>
              <p className="text-xs text-muted-foreground">Create a ticket and our team will help you out.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map(ticket => {
                const cfg = STATUS[ticket.status as keyof typeof STATUS] ?? STATUS.open;
                const Icon = cfg.icon;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => openTicket(ticket)}
                    className="w-full text-left rounded-2xl border border-border bg-white px-4 py-3.5 flex items-center gap-3 hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", cfg.bg)}>
                      <Icon className={cn("w-4 h-4", cfg.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(ticket.updatedAt)}</p>
                    </div>
                    <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0", cfg.bg, cfg.color, cfg.border)}>
                      {cfg.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── NEW TICKET VIEW ── */}
      {view === "new" && (
        <div className="rounded-2xl border border-border bg-white p-5 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Subject *</label>
            <input
              type="text"
              value={newSubject}
              onChange={e => setNewSubject(e.target.value)}
              placeholder="Briefly describe your issue"
              className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Message <span className="font-normal normal-case">(optional)</span></label>
            <textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              rows={4}
              placeholder="Provide more details..."
              className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
          <Button onClick={createTicket} disabled={creating || !newSubject.trim()} className="w-full gap-2">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            {creating ? "Creating…" : "Submit Ticket"}
          </Button>
        </div>
      )}

      {/* ── CHAT VIEW ── */}
      {view === "chat" && activeTicket && (
        <div className="flex flex-col" style={{ height: "calc(100dvh - 220px)", minHeight: "400px" }}>
          {/* Status bar */}
          {(() => {
            const cfg = STATUS[activeTicket.status as keyof typeof STATUS] ?? STATUS.open;
            const Icon = cfg.icon;
            return (
              <div className="rounded-xl border border-border bg-white px-4 py-2.5 mb-3 flex items-center gap-2.5">
                <Icon className={cn("w-4 h-4 shrink-0", cfg.color)} />
                <span className={cn("text-xs font-bold", cfg.color)}>{cfg.label}</span>
                <span className="text-xs text-muted-foreground ml-auto">#{activeTicket.id}</span>
              </div>
            );
          })()}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
            {loadingChat ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-3/4 rounded-2xl" />)}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">No messages yet — send one below.</p>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={cn("flex", msg.isAdmin ? "justify-start" : "justify-end")}>
                  <div className={cn(
                    "max-w-xs rounded-2xl px-4 py-2.5 text-sm",
                    msg.isAdmin
                      ? "bg-muted border border-border rounded-tl-sm"
                      : "bg-primary text-primary-foreground rounded-tr-sm"
                  )}>
                    <p className={cn("text-[10px] font-bold mb-1 opacity-60")}>
                      {msg.isAdmin ? msg.senderName : "You"}
                    </p>
                    <p style={{ wordBreak: "break-word" }}>{msg.message}</p>
                    <p className="text-[10px] mt-1 opacity-50 text-right">{fmtTime(msg.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {activeTicket.status === "closed" ? (
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
              This ticket is closed.
              <button
                className="ml-2 text-primary font-semibold text-sm hover:underline"
                onClick={async () => {
                  try {
                    const d = await apiFetch(`/tickets/${activeTicket.id}/messages`, {
                      method: "POST",
                      body: JSON.stringify({ message: "Please reopen this ticket." }),
                    });
                    setMessages(prev => [...prev, d]);
                    toast.success("Message sent — we'll reopen your ticket.");
                  } catch { toast.error("Unable to send message"); }
                }}
              >
                Contact us to reopen
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Type your message…"
                className="flex-1 rounded-xl border border-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-40 transition-opacity shrink-0"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
