import { useState, useRef, useCallback, useEffect } from "react";
import {
  useAdminGetShopStats,
  useAdminListProducts,
  useAdminListOrders,
  useAdminCreateProduct,
  useAdminUpdateProduct,
  useAdminDeleteProduct,
  useAdminUpdateOrderStatus,
  useAdminCreateCategory,
  useListCategories,
  useAdminListUsers,
  useAdminToggleUserBlock,
  useAdminAddUserBalance,
  useAdminListPackages,
  useAdminCreatePackage,
  useAdminUpdatePackage,
  useAdminGetReferralLevels,
  useAdminUpdateReferralLevels,
  useAdminListIncome,
  useAdminGetExcessWallet,
  useAdminListRankAchievements,
  useAdminCheckUserRank,
  useListRanks,
  useAdminListShareRequests,
  useAdminMarkShareTransferred,
  useAdminGetServerStatus,
  useAdminGetWalletStats,
  useAdminRegenerateAddresses,
  useAdminResetForLive,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Package, DollarSign, ShoppingCart, Tag, Edit, Trash2, Users, Ticket, ArrowLeftRight, Star, Ban, CheckCircle, Play, AlertTriangle, Settings, Eye, EyeOff, PlusCircle, Mail, TrendingUp, Share2, BarChart2, Crown, Loader2, CheckCircle2, Leaf, Clock, Shield, RefreshCcw, Wrench, Server, Wallet, ChevronDown, ChevronRight, MessageCircle, Send, ChevronLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const BASE = import.meta.env.BASE_URL;

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}api${path}`, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().min(1, "Description is required"),
  priceUsdt: z.string().min(1, "Price is required"),
  compareAtPrice: z.string().optional(),
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
  categoryId: z.string().min(1, "Category is required"),
  imageUrls: z.string().transform(str => str.split(',').map(s => s.trim()).filter(Boolean)),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false)
});

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  imageUrl: z.string().optional()
});

const lotterySchema = z.object({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(["random", "raffle"]).default("random"),
  ticketPrice: z.string().min(1, "Ticket price is required"),
  maxTickets: z.coerce.number().min(1),
  drawDate: z.string().optional(),
  showOnDashboard: z.boolean().default(false),
});

type ProductFormValues = z.infer<typeof productSchema>;
type LotteryFormValues = z.infer<typeof lotterySchema>;

// ─── Helper: status colors ────────────────────────────────────────────────────

function orderStatusColor(status: string) {
  switch (status) {
    case 'delivered': return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'shipped': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'confirmed': return 'bg-primary/10 text-primary border-primary/20';
    case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function p2pStatusColor(status: string) {
  switch (status) {
    case 'released': return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'paid': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'disputed': return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'resolved': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'cancelled': return 'bg-muted text-muted-foreground border-border';
    default: return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
  }
}

function lotteryStatusColor(status: string) {
  switch (status) {
    case 'active': return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'completed': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

type AdminUser = {
  id: string; email: string; fullName?: string | null; walletBalance: string;
  isAdmin: boolean; isBlocked: boolean; withdrawalBlocked: boolean; p2pBlocked: boolean; investmentBlocked: boolean;
  blockReason?: string | null; withdrawalBlockReason?: string | null; p2pBlockReason?: string | null; investmentBlockReason?: string | null;
  depositAddress: string; referralCode: string; earningsBalance: string; createdAt: string;
  totalDeposited?: string; totalWithdrawn?: string;
};

function BlockingDrawer({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fields, setFields] = useState({
    isBlocked: user.isBlocked,
    withdrawalBlocked: user.withdrawalBlocked,
    p2pBlocked: user.p2pBlocked,
    investmentBlocked: user.investmentBlocked,
    blockReason: user.blockReason ?? "",
    withdrawalBlockReason: user.withdrawalBlockReason ?? "",
    p2pBlockReason: user.p2pBlockReason ?? "",
    investmentBlockReason: user.investmentBlockReason ?? "",
  });

  const toggle = useAdminToggleUserBlock({
    mutation: {
      onSuccess: () => {
        toast({ title: "Block settings updated" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
        onClose();
      },
      onError: (err: any) => {
        toast({ title: "Failed", description: err?.message ?? "Unknown error", variant: "destructive" });
      }
    }
  });

  const BlockRow = ({ label, fieldKey, reasonKey }: { label: string; fieldKey: keyof typeof fields; reasonKey: keyof typeof fields }) => (
    <div className="space-y-2 p-3 border border-border bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        <button
          type="button"
          onClick={() => setFields(f => ({ ...f, [fieldKey]: !f[fieldKey] }))}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${fields[fieldKey] ? 'bg-destructive' : 'bg-muted-foreground/30'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${fields[fieldKey] ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {fields[fieldKey] && (
        <Input
          placeholder={`Reason for ${label.toLowerCase()}…`}
          value={fields[reasonKey] as string}
          onChange={(e) => setFields(f => ({ ...f, [reasonKey]: e.target.value }))}
          className="rounded-none text-xs h-8"
        />
      )}
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm rounded-none border-border">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm font-bold flex items-center gap-2">
            <Shield className="h-4 w-4" />Block Settings
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1 pt-1">
          <div className="bg-muted/50 border border-border p-2.5 mb-3">
            <p className="text-xs font-bold">{user.fullName ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground font-mono">{user.email}</p>
          </div>
          <BlockRow label="Full Account Block" fieldKey="isBlocked" reasonKey="blockReason" />
          <BlockRow label="Withdrawal Block" fieldKey="withdrawalBlocked" reasonKey="withdrawalBlockReason" />
          <BlockRow label="P2P Block" fieldKey="p2pBlocked" reasonKey="p2pBlockReason" />
          <BlockRow label="Investment Block" fieldKey="investmentBlocked" reasonKey="investmentBlockReason" />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1 rounded-none text-xs" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 rounded-none font-bold uppercase tracking-wider text-xs"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate({ userId: user.id, data: fields as any })}
          >
            {toggle.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: users, isLoading } = useAdminListUsers({});

  const [balanceTarget, setBalanceTarget] = useState<{ id: string; name: string; email: string; balance: string } | null>(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceNote, setBalanceNote] = useState("");
  const [blockTarget, setBlockTarget] = useState<AdminUser | null>(null);

  const addBalance = useAdminAddUserBalance({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Balance credited", description: `New balance: ${parseFloat(data.walletBalance).toFixed(2)} USDT` });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
        setBalanceTarget(null);
        setBalanceAmount("");
        setBalanceNote("");
      },
      onError: (err: any) => {
        toast({ title: "Failed", description: err?.message ?? "Unknown error", variant: "destructive" });
      }
    }
  });

  const submitAddBalance = () => {
    if (!balanceTarget) return;
    addBalance.mutate({ userId: balanceTarget.id, data: { amount: balanceAmount, note: balanceNote || undefined } });
  };

  const getOverallStatus = (user: AdminUser) => {
    if (user.isBlocked) return { label: "Blocked", cls: "bg-destructive/10 text-destructive border-destructive/20" };
    const flags = [user.withdrawalBlocked, user.p2pBlocked, user.investmentBlocked];
    const count = flags.filter(Boolean).length;
    if (count > 0) return { label: `${count} Restriction${count > 1 ? "s" : ""}`, cls: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" };
    return { label: "Active", cls: "bg-green-500/10 text-green-500 border-green-500/20" };
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold uppercase tracking-wider">User Management</h2>
      <div className="bg-card border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="font-bold uppercase tracking-wider text-xs">User</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Email</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Balance</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs text-center">Role</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs text-center">Status</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading users...</TableCell></TableRow>
            )}
            {(users as AdminUser[] | undefined)?.map((user) => {
              const status = getOverallStatus(user);
              return (
                <TableRow key={user.id} className="border-border">
                  <TableCell className="font-bold text-sm">{user.fullName ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono text-xs">{user.email}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-primary">{parseFloat(user.walletBalance).toFixed(2)} USDT</TableCell>
                  <TableCell className="text-center">
                    {user.isAdmin ? (
                      <Badge variant="outline" className="rounded-none text-[10px] uppercase tracking-widest bg-primary/10 text-primary border-primary/20">Admin</Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-none text-[10px] uppercase tracking-widest">User</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`rounded-none text-[10px] uppercase tracking-widest ${status.cls}`}>
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBalanceTarget({ id: user.id, name: user.fullName ?? user.email, email: user.email, balance: user.walletBalance })}
                        className="h-8 rounded-none text-xs font-bold uppercase tracking-wider text-green-600 hover:text-green-700 hover:bg-green-500/10"
                      >
                        <PlusCircle className="h-3 w-3 mr-1" />Add Balance
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBlockTarget(user)}
                        className="h-8 rounded-none text-xs font-bold uppercase tracking-wider text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                      >
                        <Shield className="h-3 w-3 mr-1" />Block
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {blockTarget && <BlockingDrawer user={blockTarget} onClose={() => setBlockTarget(null)} />}

      {/* Add Balance Dialog */}
      <Dialog open={!!balanceTarget} onOpenChange={(open) => { if (!open) { setBalanceTarget(null); setBalanceAmount(""); setBalanceNote(""); } }}>
        <DialogContent className="sm:max-w-sm rounded-none border-border">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider text-sm font-bold">Add Wallet Balance</DialogTitle>
          </DialogHeader>
          {balanceTarget && (
            <div className="space-y-4 pt-1">
              <div className="bg-muted/50 border border-border rounded-none p-3 space-y-0.5">
                <p className="text-xs font-bold">{balanceTarget.name}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{balanceTarget.email}</p>
                <p className="text-xs text-muted-foreground">Current balance: <span className="font-bold text-primary font-mono">{parseFloat(balanceTarget.balance).toFixed(2)} USDT</span></p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider">Amount (USDT)</label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  className="font-mono rounded-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider">Note <span className="font-normal text-muted-foreground normal-case tracking-normal">(optional)</span></label>
                <Input
                  placeholder="e.g. Manual deposit, bonus, correction…"
                  value={balanceNote}
                  onChange={(e) => setBalanceNote(e.target.value)}
                  className="rounded-none text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 rounded-none"
                  onClick={() => { setBalanceTarget(null); setBalanceAmount(""); setBalanceNote(""); }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-none font-bold uppercase tracking-wider"
                  disabled={!balanceAmount || parseFloat(balanceAmount) <= 0 || addBalance.isPending}
                  onClick={submitAddBalance}
                >
                  {addBalance.isPending ? "Crediting…" : `Credit ${balanceAmount ? parseFloat(balanceAmount).toFixed(2) : "0.00"} USDT`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Support Tab ──────────────────────────────────────────────────────────────

function SupportAdminTab() {
  const BASE = import.meta.env.BASE_URL;
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all"|"open"|"in_progress"|"closed">("all");
  const [active, setActive] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function api(path: string, opts?: RequestInit) {
    const res = await fetch(`${BASE}api/support${path}`, { ...opts, credentials: "include", headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) } });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error ?? "Request failed");
    return d;
  }

  const loadTickets = useCallback(async () => {
    try { const d = await api("/admin/tickets"); setTickets(d.data ?? []); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  const openTicket = async (t: any) => {
    setActive(t); setMessages([]);
    try { const d = await api(`/admin/tickets/${t.id}`); setMessages(d.messages ?? []); setActive(d.ticket); }
    catch { /* ignore */ }
  };

  useEffect(() => { loadTickets(); }, [loadTickets]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const updateStatus = async (status: string) => {
    if (!active) return;
    try {
      const d = await api(`/admin/tickets/${active.id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
      setActive(d); setTickets(prev => prev.map(t => t.id === d.id ? d : t));
    } catch { /* ignore */ }
  };

  const sendReply = async () => {
    const text = input.trim(); if (!text || !active) return;
    setSending(true);
    try {
      const msg = await api(`/admin/tickets/${active.id}/messages`, { method: "POST", body: JSON.stringify({ message: text }) });
      setMessages(prev => [...prev, msg]); setInput("");
      setActive((prev: any) => prev ? { ...prev, status: prev.status === "open" ? "in_progress" : prev.status } : prev);
      setTickets(prev => prev.map(t => t.id === active.id ? { ...t, status: active.status === "open" ? "in_progress" : active.status } : t));
    } catch { /* ignore */ } finally { setSending(false); }
  };

  const STATUS_CFG: Record<string, { label: string; cls: string }> = {
    open:        { label: "Open",        cls: "bg-blue-50 text-blue-600 border-blue-200" },
    in_progress: { label: "In Progress", cls: "bg-amber-50 text-amber-600 border-amber-200" },
    closed:      { label: "Closed",      cls: "bg-slate-100 text-slate-500 border-slate-200" },
  };

  const filtered = filter === "all" ? tickets : tickets.filter(t => t.status === filter);
  const open_count = tickets.filter(t => t.status === "open").length;

  if (active) {
    const cfg = STATUS_CFG[active.status] ?? STATUS_CFG.open;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => { setActive(null); loadTickets(); }} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <p className="font-bold text-sm">{active.subject}</p>
            <p className="text-xs text-muted-foreground">{active.userName} · {active.userEmail}</p>
          </div>
          <div className="flex gap-2 items-center">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
            {active.status !== "in_progress" && active.status !== "closed" && (
              <button onClick={() => updateStatus("in_progress")} className="text-xs px-3 py-1.5 rounded-lg font-bold bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100">In Progress</button>
            )}
            {active.status !== "closed" && (
              <button onClick={() => updateStatus("closed")} className="text-xs px-3 py-1.5 rounded-lg font-bold bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200">Close</button>
            )}
            {active.status === "closed" && (
              <button onClick={() => updateStatus("open")} className="text-xs px-3 py-1.5 rounded-lg font-bold bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100">Reopen</button>
            )}
          </div>
        </div>
        <div className="border border-border rounded-xl bg-white overflow-hidden flex flex-col" style={{ height: "500px" }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No messages yet.</p>}
            {messages.map((msg: any) => (
              <div key={msg.id} className={`flex ${msg.isAdmin ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-sm rounded-2xl px-4 py-2.5 text-sm ${msg.isAdmin ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted border border-border rounded-tl-sm"}`}>
                  <p className="text-[10px] font-bold mb-1 opacity-60">{msg.isAdmin ? "Support Team" : msg.senderName}</p>
                  <p style={{ wordBreak: "break-word" }}>{msg.message}</p>
                  <p className="text-[10px] mt-1 opacity-50 text-right">{new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {active.status === "closed" ? (
            <div className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground bg-muted/30">Ticket closed — reopen to reply</div>
          ) : (
            <div className="border-t border-border p-3 flex gap-2">
              <input
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                placeholder="Reply to user…"
                className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button onClick={sendReply} disabled={sending || !input.trim()} className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-40 shrink-0">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold uppercase tracking-wider">Support Tickets</h2>
        {open_count > 0 && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-600">{open_count} open</span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {(["all","open","in_progress","closed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${filter === f ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-muted-foreground hover:border-primary/20"}`}>
            {f === "all" ? `All (${tickets.length})` : f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center border border-border rounded-xl bg-card">
          <MessageCircle className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">No tickets</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t: any) => {
            const cfg = STATUS_CFG[t.status] ?? STATUS_CFG.open;
            return (
              <button key={t.id} onClick={() => openTicket(t)}
                className="w-full text-left rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3 hover:border-primary/30 hover:shadow-sm transition-all">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.userName} · {t.userEmail}</p>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${cfg.cls}`}>{cfg.label}</span>
                <p className="text-[11px] text-muted-foreground shrink-0">{new Date(t.updatedAt).toLocaleDateString()}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Maintenance Tab ──────────────────────────────────────────────────────────

function MaintenanceTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: serverStatus, refetch: refetchStatus, isFetching: fetchingStatus } = useAdminGetServerStatus();
  const { data: walletStats, refetch: refetchWallet } = useAdminGetWalletStats();

  const [regenConfirm, setRegenConfirm] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  const regen = useAdminRegenerateAddresses({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Addresses regenerated", description: data.message });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/wallet-stats"] });
        setRegenConfirm("");
        refetchWallet();
      },
      onError: (err: any) => {
        toast({ title: "Failed", description: err?.message ?? "Unknown error", variant: "destructive" });
      }
    }
  });

  const reset = useAdminResetForLive({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Reset complete", description: data.message });
        setResetConfirm(""); setResetEmail(""); setResetPassword("");
      },
      onError: (err: any) => {
        toast({ title: "Reset failed", description: err?.message ?? "Unknown error", variant: "destructive" });
      }
    }
  });

  const formatUptime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2">
        <Wrench className="h-5 w-5" />Maintenance
      </h2>

      {/* Server Status */}
      <Card className="rounded-none border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2"><Server className="h-4 w-4" />Server Status</span>
            <Button variant="ghost" size="sm" className="h-7 rounded-none text-xs" onClick={() => refetchStatus()} disabled={fetchingStatus}>
              <RefreshCcw className={`h-3 w-3 mr-1 ${fetchingStatus ? "animate-spin" : ""}`} />Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {serverStatus ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Heap Used", value: `${serverStatus.heapUsed} MB` },
                { label: "Heap Total", value: `${serverStatus.heapTotal} MB` },
                { label: "RSS", value: `${serverStatus.rss} MB` },
                { label: "Uptime", value: formatUptime(serverStatus.uptimeSeconds) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/40 border border-border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                  <p className="font-mono font-bold text-sm">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Click refresh to load server stats.</p>
          )}
        </CardContent>
      </Card>

      {/* Wallet Address Stats */}
      <Card className="rounded-none border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Wallet className="h-4 w-4" />Deposit Wallet Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {walletStats && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-muted/40 border border-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total Users</p>
                <p className="font-mono font-bold text-lg">{walletStats.totalUsers}</p>
              </div>
              <div className="bg-muted/40 border border-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">With Address</p>
                <p className="font-mono font-bold text-lg">{walletStats.totalWithAddress}</p>
              </div>
            </div>
          )}
          {walletStats?.recentChanges && walletStats.recentChanges.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2">Recent Address Changes</p>
              <div className="space-y-1">
                {walletStats.recentChanges.slice(0, 5).map((ch: any) => (
                  <div key={ch.id} className="bg-muted/20 border border-border p-2 text-[11px] font-mono">
                    <span className="text-muted-foreground">{new Date(ch.createdAt).toLocaleDateString()}</span>
                    {" · "}<span className="text-yellow-600">{ch.oldAddress?.slice(0, 10)}…</span>
                    {" → "}<span className="text-green-600">{ch.newAddress?.slice(0, 10)}…</span>
                    <span className="text-muted-foreground ml-2">({ch.reason})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regenerate Deposit Addresses */}
      <Card className="rounded-none border-orange-500/30 bg-orange-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-orange-600">
            <RefreshCcw className="h-4 w-4" />Regenerate Deposit Addresses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Generates new deposit wallet addresses for <strong>all non-admin users</strong> and logs the changes. 
            Old funds sent to previous addresses will still be swept but new deposits should go to the new addresses.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider">Type <span className="font-mono text-orange-600">REGENERATE</span> to confirm</label>
            <Input
              value={regenConfirm}
              onChange={(e) => setRegenConfirm(e.target.value)}
              placeholder="REGENERATE"
              className="rounded-none font-mono text-sm"
            />
          </div>
          <Button
            className="rounded-none font-bold uppercase tracking-wider text-xs bg-orange-600 hover:bg-orange-700"
            disabled={regenConfirm !== "REGENERATE" || regen.isPending}
            onClick={() => regen.mutate({ data: { confirm: "REGENERATE" } })}
          >
            {regen.isPending ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Regenerating…</> : <><RefreshCcw className="h-3 w-3 mr-1" />Regenerate All Addresses</>}
          </Button>
        </CardContent>
      </Card>

      {/* Reset For Live */}
      <Card className="rounded-none border-destructive/40 bg-destructive/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />Reset For Live
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive space-y-1">
            <p className="font-bold uppercase tracking-wider">⚠ Irreversible Nuclear Action</p>
            <p>This will permanently delete ALL non-admin users, deposits, withdrawals, packages, income, P2P history, and OTP codes. Admin credentials will be reset to the new values provided.</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider">New Admin Email</label>
              <Input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="admin@example.com"
                className="rounded-none text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider">New Admin Password</label>
              <div className="relative">
                <Input
                  type={showResetPassword ? "text" : "password"}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="rounded-none text-sm pr-10"
                />
                <button type="button" onClick={() => setShowResetPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider">Type <span className="font-mono text-destructive">RESET FOR LIVE</span> to confirm</label>
              <Input
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder="RESET FOR LIVE"
                className="rounded-none font-mono text-sm"
              />
            </div>
          </div>
          <Button
            variant="destructive"
            className="rounded-none font-bold uppercase tracking-wider text-xs w-full"
            disabled={resetConfirm !== "RESET FOR LIVE" || !resetEmail || resetPassword.length < 6 || reset.isPending}
            onClick={() => reset.mutate({ data: { confirm: "RESET FOR LIVE", newEmail: resetEmail, newPassword: resetPassword } })}
          >
            {reset.isPending ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Resetting…</> : <><AlertTriangle className="h-3 w-3 mr-1" />Execute Reset For Live</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function LotteryTab() {
  const { toast } = useToast();
  const [lotteries, setLotteries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLottery, setEditingLottery] = useState<any>(null);
  const [isDrawing, setIsDrawing] = useState<string | null>(null);

  const loadLotteries = async () => {
    try {
      const data = await apiFetch("/admin/lottery");
      setLotteries(data);
    } catch {
      toast({ title: "Failed to load lotteries", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLotteries(); }, []);

  const form = useForm<LotteryFormValues>({
    resolver: zodResolver(lotterySchema),
    defaultValues: { title: "", subtitle: "", description: "", type: "random", ticketPrice: "", maxTickets: 100, drawDate: "", showOnDashboard: false }
  });

  const openDialog = (lottery?: any) => {
    setEditingLottery(lottery ?? null);
    if (lottery) {
      form.reset({
        title: lottery.title,
        subtitle: lottery.subtitle ?? "",
        description: lottery.description ?? "",
        type: lottery.type ?? "random",
        ticketPrice: lottery.ticketPrice,
        maxTickets: lottery.maxTickets,
        drawDate: lottery.drawDate ? new Date(lottery.drawDate).toISOString().slice(0, 16) : "",
        showOnDashboard: lottery.showOnDashboard ?? false,
      });
    } else {
      form.reset({ title: "", subtitle: "", description: "", type: "random", ticketPrice: "", maxTickets: 100, drawDate: "", showOnDashboard: false });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: LotteryFormValues) => {
    try {
      const body = { ...data, drawDate: data.drawDate || undefined };
      if (editingLottery) {
        await apiFetch(`/admin/lottery/${editingLottery.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        toast({ title: "Lottery updated" });
      } else {
        await apiFetch("/admin/lottery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        toast({ title: "Lottery created" });
      }
      setIsDialogOpen(false);
      loadLotteries();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const changeStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/admin/lottery/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      toast({ title: `Lottery ${status}` });
      loadLotteries();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const drawWinner = async (id: string) => {
    setIsDrawing(id);
    try {
      const result = await apiFetch(`/admin/lottery/${id}/draw`, { method: "POST" });
      toast({ title: `Winner drawn: Ticket #${result.winnerTicket?.ticketNumber ?? "?"}` });
      loadLotteries();
    } catch (e: any) {
      toast({ title: "Draw failed", description: e.message, variant: "destructive" });
    } finally {
      setIsDrawing(null);
    }
  };

  const deleteLottery = async (id: string) => {
    try {
      await apiFetch(`/admin/lottery/${id}`, { method: "DELETE" });
      toast({ title: "Lottery deleted" });
      loadLotteries();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold uppercase tracking-wider">Lottery Management</h2>
        <Button onClick={() => openDialog()} className="rounded-none font-bold uppercase tracking-wider text-xs">Create Lottery</Button>
      </div>

      <div className="bg-card border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="font-bold uppercase tracking-wider text-xs">Title</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Price</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Tickets</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Draw Date</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs text-center">Status</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>}
            {lotteries.map((l) => (
              <TableRow key={l.id} className="border-border">
                <TableCell className="font-bold text-sm">{l.title}</TableCell>
                <TableCell className="text-right font-mono text-primary font-bold">{l.ticketPrice} USDT</TableCell>
                <TableCell className="text-right font-mono">{l.ticketsSold ?? 0} / {l.maxTickets}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.drawDate ? new Date(l.drawDate).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={`rounded-none text-[10px] uppercase tracking-widest ${lotteryStatusColor(l.status)}`}>{l.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {l.status === "draft" && (
                      <Button variant="ghost" size="sm" onClick={() => changeStatus(l.id, "active")} className="h-8 rounded-none text-xs text-green-600 font-bold uppercase tracking-wider">
                        <Play className="h-3 w-3 mr-1" />Activate
                      </Button>
                    )}
                    {l.status === "active" && (
                      <Button variant="ghost" size="sm" onClick={() => drawWinner(l.id)} disabled={isDrawing === l.id} className="h-8 rounded-none text-xs text-primary font-bold uppercase tracking-wider">
                        <Ticket className="h-3 w-3 mr-1" />{isDrawing === l.id ? "Drawing..." : "Draw"}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openDialog(l)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteLottery(l.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px] rounded-none border-border bg-background max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider font-black">{editingLottery ? "Edit Lottery" : "Create Lottery"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Title</FormLabel>
                  <FormControl><Input className="rounded-none bg-card" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="subtitle" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Subtitle</FormLabel>
                  <FormControl><Input className="rounded-none bg-card" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Description</FormLabel>
                  <FormControl><Textarea className="rounded-none bg-card" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="ticketPrice" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Price (USDT)</FormLabel>
                    <FormControl><Input type="number" step="0.01" className="rounded-none bg-card font-mono" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="maxTickets" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Max Tickets</FormLabel>
                    <FormControl><Input type="number" className="rounded-none bg-card font-mono" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="rounded-none bg-card"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent className="rounded-none">
                        <SelectItem value="random">Random</SelectItem>
                        <SelectItem value="raffle">Raffle</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="drawDate" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Draw Date</FormLabel>
                  <FormControl><Input type="datetime-local" className="rounded-none bg-card" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" className="w-full rounded-none font-bold uppercase tracking-wider">
                {editingLottery ? "Update Lottery" : "Create Lottery"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function P2PTab() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"ads" | "orders">("orders");
  const [ads, setAds] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveDialog, setResolveDialog] = useState<any>(null);
  const [resolution, setResolution] = useState("");
  const [releaseToSeller, setReleaseToSeller] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [adsData, ordersData] = await Promise.all([
        apiFetch("/shop/admin/p2p/ads"),
        apiFetch("/shop/admin/p2p/orders"),
      ]);
      setAds(adsData);
      setOrders(ordersData);
    } catch {
      toast({ title: "Failed to load P2P data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resolveDispute = async () => {
    try {
      await apiFetch(`/shop/admin/p2p/orders/${resolveDialog.id}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, releaseToSeller }),
      });
      toast({ title: "Dispute resolved" });
      setResolveDialog(null);
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold uppercase tracking-wider">P2P Marketplace</h2>
        <div className="flex gap-2">
          <Button variant={activeTab === "orders" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("orders")} className="rounded-none text-xs font-bold uppercase tracking-wider">Orders</Button>
          <Button variant={activeTab === "ads" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("ads")} className="rounded-none text-xs font-bold uppercase tracking-wider">Ads</Button>
        </div>
      </div>

      {activeTab === "orders" && (
        <div className="bg-card border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-bold uppercase tracking-wider text-xs">ID</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs">Buyer</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs">Seller</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Amount</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs">Payment</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs text-center">Status</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>}
              {orders.map((o) => (
                <TableRow key={o.id} className="border-border">
                  <TableCell className="font-mono text-xs">{o.id.split("-")[0].toUpperCase()}</TableCell>
                  <TableCell className="text-sm font-bold">{o.buyerName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{o.sellerName}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-primary">{parseFloat(o.amount).toFixed(2)} USDT</TableCell>
                  <TableCell className="text-xs text-muted-foreground uppercase tracking-wider">{o.paymentMethod?.replace(/_/g, " ") ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`rounded-none text-[10px] uppercase tracking-widest ${p2pStatusColor(o.status)}`}>{o.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {o.status === "disputed" && (
                      <Button variant="ghost" size="sm" onClick={() => { setResolveDialog(o); setResolution(""); setReleaseToSeller(false); }}
                        className="h-8 rounded-none text-xs text-destructive font-bold uppercase tracking-wider">
                        <AlertTriangle className="h-3 w-3 mr-1" />Resolve
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {activeTab === "ads" && (
        <div className="bg-card border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-bold uppercase tracking-wider text-xs">Owner</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs text-center">Side</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Price</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Available</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Completed</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>}
              {ads.map((a) => (
                <TableRow key={a.id} className="border-border">
                  <TableCell className="font-bold text-sm">{a.displayName}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`rounded-none text-[10px] uppercase tracking-widest ${a.side === "buy" ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}`}>{a.side}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-primary">{parseFloat(a.price).toFixed(2)} USDT</TableCell>
                  <TableCell className="text-right font-mono">{parseFloat(a.availableAmount).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{a.completedOrders}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`rounded-none text-[10px] uppercase tracking-widest ${a.status === "active" ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-muted text-muted-foreground"}`}>{a.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!resolveDialog} onOpenChange={() => setResolveDialog(null)}>
        <DialogContent className="sm:max-w-[480px] rounded-none border-border bg-background">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider font-black text-destructive">Resolve Dispute</DialogTitle>
          </DialogHeader>
          {resolveDialog && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/50 p-3 border border-border rounded-none text-sm space-y-1">
                <div><span className="font-bold uppercase tracking-wider text-xs text-muted-foreground">Buyer:</span> {resolveDialog.buyerName}</div>
                <div><span className="font-bold uppercase tracking-wider text-xs text-muted-foreground">Seller:</span> {resolveDialog.sellerName}</div>
                <div><span className="font-bold uppercase tracking-wider text-xs text-muted-foreground">Amount:</span> <span className="font-mono text-primary font-bold">{parseFloat(resolveDialog.amount).toFixed(2)} USDT</span></div>
                {resolveDialog.disputeDescription && <div className="text-muted-foreground text-xs pt-1">{resolveDialog.disputeDescription}</div>}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Release funds to:</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={!releaseToSeller ? "default" : "outline"} onClick={() => setReleaseToSeller(false)} className="rounded-none font-bold uppercase tracking-wider text-xs">
                    Buyer (Refund)
                  </Button>
                  <Button variant={releaseToSeller ? "default" : "outline"} onClick={() => setReleaseToSeller(true)} className="rounded-none font-bold uppercase tracking-wider text-xs">
                    Seller (Release)
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Resolution notes</p>
                <Textarea className="rounded-none bg-card" placeholder="Explain the resolution decision..." value={resolution} onChange={e => setResolution(e.target.value)} />
              </div>
              <Button onClick={resolveDispute} className="w-full rounded-none font-bold uppercase tracking-wider">
                Confirm Resolution
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReviewsTab() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await apiFetch("/shop/admin/reviews");
      setReviews(data);
    } catch {
      toast({ title: "Failed to load reviews", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const deleteReview = async (id: string) => {
    try {
      await apiFetch(`/shop/admin/reviews/${id}`, { method: "DELETE" });
      toast({ title: "Review deleted" });
      setReviews(reviews.filter(r => r.id !== id));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold uppercase tracking-wider">Review Moderation</h2>
      <div className="bg-card border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="font-bold uppercase tracking-wider text-xs">Product</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">User</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs text-center">Rating</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Review</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Date</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>}
            {reviews.map((r) => (
              <TableRow key={r.id} className="border-border">
                <TableCell className="font-bold text-sm max-w-[150px] truncate">{r.productName ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.userFullName ?? "Anonymous"}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3 w-3 ${i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">{r.title ? <span className="font-bold text-foreground">{r.title}</span> : ""} {r.body ?? ""}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => deleteReview(r.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && reviews.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No reviews yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

type AdminSettings = {
  telegramBotToken: string;
  telegramBotUsername: string;
  bscRpcUrl: string;
  adminMasterWallet: string;
  adminWallet2: string;
  adminWallet1Percent: string;
  gasWalletPrivateKey?: string;
  withdrawWalletPrivateKey?: string;
  withdrawFeeMode: string;
  withdrawalMode: string;
  withdrawalEnabled: boolean;
  minDepositUsdt: string;
  shareValueUsdt: string;
  sharesPerPackage: string;
  smtpEnabled: boolean;
  emailVerificationEnabled: boolean;
  loginOtpEnabled: boolean;
  welcomeEmailEnabled: boolean;
  orderConfirmEmailEnabled: boolean;
  depositCreditEmailEnabled: boolean;
  withdrawalStatusEmailEnabled: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFromEmail: string;
  smtpFromName: string;
};


function SettingField({ label, hint, value, onChange, secret = false }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; secret?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wider text-foreground">{label}</label>
      {hint && <p className="text-xs text-muted-foreground -mt-0.5">{hint}</p>}
      <div className="relative">
        <Input
          type={secret && !show ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-none bg-card font-mono text-xs pr-9"
          placeholder={secret ? "••••••••" : undefined}
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

function SettingsTab() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiFetch("/admin/settings");
      setCfg(data);
    } catch (err: any) {
      const msg = err?.status === 403 ? "Access denied — your account does not have admin privileges." : (err?.message ?? "Failed to load settings");
      setLoadError(msg);
      toast({ title: "Failed to load settings", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const set = (key: keyof AdminSettings) => (v: string | boolean) =>
    setCfg((prev) => prev ? { ...prev, [key]: v } : prev);

  const registerWebhook = async () => {
    if (!cfg) return;
    setRegisteringWebhook(true);
    try {
      // Save settings first so the DB has the latest bot token
      await apiFetch("/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      // Then register webhook
      const webhookUrl = `${window.location.origin}/api/auth/bot-webhook`;
      const result = await apiFetch("/auth/bot-webhook/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      }) as { success: boolean; description?: string };
      toast({
        title: "Settings saved & webhook registered!",
        description: result.description ?? webhookUrl,
      });
    } catch (err: any) {
      let msg = err?.message ?? "Unknown error";
      try { const parsed = JSON.parse(msg); msg = parsed.error ?? msg; } catch {}
      toast({ title: "Webhook registration failed", description: msg, variant: "destructive" });
    } finally {
      setRegisteringWebhook(false);
    }
  };

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      await apiFetch("/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="space-y-4 py-8">
      {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-muted/40 rounded animate-pulse" />)}
    </div>
  );

  if (loadError || !cfg) return (
    <div className="py-12 flex flex-col items-center gap-4 text-center">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-destructive" />
      </div>
      <div>
        <p className="font-bold text-sm uppercase tracking-wider">Settings unavailable</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">{loadError ?? "Could not load platform settings."}</p>
      </div>
      <Button variant="outline" size="sm" className="rounded-none text-xs uppercase tracking-wider font-bold" onClick={load}>
        Retry
      </Button>
    </div>
  );

  return (
    <div className="space-y-8 max-w-2xl">
      <h2 className="text-xl font-bold uppercase tracking-wider">Platform Settings</h2>

      {/* Telegram */}
      <div className="bg-card border border-border p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded bg-[#2AABEE]/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#2AABEE]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.67 7.86c-.12.56-.46.7-.93.43l-2.58-1.9-1.24 1.2c-.14.14-.26.26-.52.26l.18-2.62 4.74-4.28c.21-.18-.04-.28-.32-.1l-5.86 3.69-2.52-.79c-.55-.17-.56-.55.11-.81l9.84-3.79c.46-.17.86.11.77.85z"/></svg>
          </div>
          <h3 className="font-bold uppercase tracking-wider text-sm">Telegram Bot</h3>
        </div>
        <SettingField
          label="Bot Token"
          hint="From @BotFather — used for Telegram login and notifications"
          value={cfg.telegramBotToken}
          onChange={set("telegramBotToken")}
          secret
        />
        <SettingField
          label="Bot Username"
          hint="Without the @ symbol, e.g. TelebitShopBot"
          value={cfg.telegramBotUsername}
          onChange={set("telegramBotUsername")}
        />
        <div className="pt-1 flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!cfg.telegramBotToken || registeringWebhook}
            onClick={registerWebhook}
            className="w-full rounded-none text-xs font-bold uppercase tracking-wider border-[#2AABEE]/40 text-[#2AABEE] hover:bg-[#2AABEE]/10"
          >
            {registeringWebhook ? "Registering…" : "⚡ Register Webhook with Telegram"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Run this once after saving your bot token — or any time your domain changes. Requires the token to be saved first.
          </p>
        </div>
      </div>

      {/* Blockchain */}
      <div className="bg-card border border-border p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded bg-amber-500/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <h3 className="font-bold uppercase tracking-wider text-sm">Blockchain (BSC)</h3>
        </div>
        <SettingField
          label="BSC RPC URL"
          hint="Binance Smart Chain RPC endpoint"
          value={cfg.bscRpcUrl}
          onChange={set("bscRpcUrl")}
        />
        <div className="grid grid-cols-1 gap-4 border border-border rounded p-3 bg-muted/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Deposit Split — Wallet 1 receives {cfg.adminWallet1Percent ?? "80"}%, Wallet 2 receives {100 - parseInt(cfg.adminWallet1Percent ?? "80")}%</p>
          <SettingField
            label="Admin Wallet 1 (Primary)"
            hint={`Receives ${cfg.adminWallet1Percent ?? "80"}% of every deposit sweep`}
            value={cfg.adminMasterWallet}
            onChange={set("adminMasterWallet")}
          />
          <SettingField
            label="Admin Wallet 2"
            hint={`Receives remaining ${100 - parseInt(cfg.adminWallet1Percent ?? "80")}% — leave empty to send 100% to Wallet 1`}
            value={cfg.adminWallet2}
            onChange={set("adminWallet2")}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider">Wallet 1 Split %</label>
            <p className="text-xs text-muted-foreground">Percentage of deposit sent to Wallet 1 (Wallet 2 gets the rest)</p>
            <input
              type="number"
              min={1}
              max={99}
              value={cfg.adminWallet1Percent ?? "80"}
              onChange={(e) => set("adminWallet1Percent")(e.target.value)}
              className="w-full rounded-none bg-card border border-input font-mono text-xs px-3 h-9 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
        <SettingField
          label="Gas Wallet Private Key"
          hint="Funds BNB gas for sweep transactions (0.001 BNB single wallet, 0.002 BNB when split is configured)"
          value={cfg.gasWalletPrivateKey ?? ""}
          onChange={set("gasWalletPrivateKey" as keyof AdminSettings)}
          secret
        />
        <SettingField
          label="Withdrawal Wallet Private Key"
          hint="Signs approved USDT withdrawal transactions"
          value={cfg.withdrawWalletPrivateKey ?? ""}
          onChange={set("withdrawWalletPrivateKey" as keyof AdminSettings)}
          secret
        />
      </div>

      {/* Share Guarantee */}
      <div className="bg-card border border-border p-5 space-y-4">
        <h3 className="font-bold uppercase tracking-wider text-sm">Ethnol Bio Fuel — Share Guarantee</h3>
        <p className="text-xs text-muted-foreground">Displayed on the user dashboard. Each package purchase rewards the buyer with shares at the current value below.</p>
        <div className="grid grid-cols-2 gap-4">
          <SettingField label="Shares per Package Purchase" value={cfg.sharesPerPackage} onChange={set("sharesPerPackage")} />
          <SettingField label="Current Share Value (USDT)" value={cfg.shareValueUsdt} onChange={set("shareValueUsdt")} />
        </div>
      </div>

      {/* Fees & Limits */}
      <div className="bg-card border border-border p-5 space-y-4">
        <h3 className="font-bold uppercase tracking-wider text-sm">Limits &amp; Withdrawal Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <SettingField label="Min Deposit (USDT)" value={cfg.minDepositUsdt} onChange={set("minDepositUsdt")} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider">Withdrawal Fee Mode</label>
          <Select value={cfg.withdrawFeeMode} onValueChange={set("withdrawFeeMode")}>
            <SelectTrigger className="rounded-none h-9 text-xs font-bold uppercase tracking-wider w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="deduct_from_amount" className="text-xs uppercase tracking-wider font-bold">Deduct from amount</SelectItem>
              <SelectItem value="deduct_from_balance" className="text-xs uppercase tracking-wider font-bold">Deduct from balance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider">Withdrawal Mode</label>
          <Select value={cfg.withdrawalMode} onValueChange={set("withdrawalMode")}>
            <SelectTrigger className="rounded-none h-9 text-xs font-bold uppercase tracking-wider w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="manual" className="text-xs uppercase tracking-wider font-bold">Manual (admin approves)</SelectItem>
              <SelectItem value="auto" className="text-xs uppercase tracking-wider font-bold">Automatic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">Withdrawals Enabled</p>
            <p className="text-xs text-muted-foreground">Allow users to submit withdrawal requests</p>
          </div>
          <button
            type="button"
            onClick={() => set("withdrawalEnabled")(!cfg.withdrawalEnabled)}
            className={`relative w-10 h-5 rounded-full transition-colors ${cfg.withdrawalEnabled ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg.withdrawalEnabled ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </div>

      {/* Email & SMTP */}
      <div className="bg-card border border-border p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded bg-blue-500/10 flex items-center justify-center">
            <Mail className="w-4 h-4 text-blue-500" />
          </div>
          <h3 className="font-bold uppercase tracking-wider text-sm">Email &amp; SMTP</h3>
        </div>

        {/* Master SMTP switch */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">SMTP Enabled</p>
            <p className="text-xs text-muted-foreground">Master switch — must be ON for any email to send</p>
          </div>
          <button
            type="button"
            onClick={() => set("smtpEnabled")(!cfg.smtpEnabled)}
            className={`relative w-10 h-5 rounded-full transition-colors ${cfg.smtpEnabled ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg.smtpEnabled ? "translate-x-5" : ""}`} />
          </button>
        </div>

        {/* SMTP credentials */}
        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">SMTP Credentials</p>
          <div className="grid grid-cols-2 gap-4">
            <SettingField
              label="SMTP Host"
              hint="e.g. smtp.gmail.com"
              value={cfg.smtpHost ?? ""}
              onChange={set("smtpHost")}
            />
            <SettingField
              label="SMTP Port"
              hint="587 (TLS) or 465 (SSL)"
              value={cfg.smtpPort ?? "587"}
              onChange={set("smtpPort")}
            />
          </div>
          <SettingField
            label="SMTP Username"
            hint="Usually your full email address"
            value={cfg.smtpUser ?? ""}
            onChange={set("smtpUser")}
          />
          <SettingField
            label="SMTP Password"
            hint="App password or account password"
            value={cfg.smtpPass ?? ""}
            onChange={set("smtpPass")}
            secret
          />
          <div className="grid grid-cols-2 gap-4">
            <SettingField
              label="From Email"
              hint="Sender address"
              value={cfg.smtpFromEmail ?? ""}
              onChange={set("smtpFromEmail")}
            />
            <SettingField
              label="From Name"
              hint="Display name"
              value={cfg.smtpFromName ?? "Telebit Shop"}
              onChange={set("smtpFromName")}
            />
          </div>
        </div>

        {/* Email feature toggles */}
        <div className="border-t border-border pt-4 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Email Features</p>
          {(
            [
              {
                key: "emailVerificationEnabled" as const,
                label: "Email Verification on Register",
                desc: "Require OTP code to create a new account",
              },
              {
                key: "loginOtpEnabled" as const,
                label: "OTP Required on Login",
                desc: "Send email code after password check on sign-in",
              },
              {
                key: "welcomeEmailEnabled" as const,
                label: "Welcome Email",
                desc: "Send a welcome email when a new user registers",
              },
              {
                key: "orderConfirmEmailEnabled" as const,
                label: "Order Confirmation Email",
                desc: "Notify customer when their order is placed",
              },
              {
                key: "depositCreditEmailEnabled" as const,
                label: "Deposit Credited Email",
                desc: "Notify user when a USDT deposit is confirmed",
              },
              {
                key: "withdrawalStatusEmailEnabled" as const,
                label: "Withdrawal Status Email",
                desc: "Notify user when a withdrawal is approved or rejected",
              },
            ] as Array<{ key: keyof AdminSettings; label: string; desc: string }>
          ).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2.5 px-1 border-b border-border/50 last:border-0">
              <div>
                <p className="text-xs font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <button
                type="button"
                onClick={() => set(key)(!(cfg[key] as boolean))}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ml-4 ${cfg[key] ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg[key] ? "translate-x-5" : ""}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Button
        onClick={save}
        disabled={saving}
        className="rounded-none font-bold uppercase tracking-wider w-full sm:w-auto px-10"
      >
        {saving ? "Saving…" : "Save Settings"}
      </Button>
    </div>
  );
}

// ─── Packages Admin Tab ───────────────────────────────────────────────────────

const packageSchema = z.object({
  name: z.string().min(1, "Name is required"),
  priceUsdt: z.string().min(1, "Price is required"),
  roiPercent: z.string().min(1, "ROI % is required"),
  roiDays: z.coerce.number().min(1, "Days must be ≥ 1"),
  isActive: z.boolean().default(true),
});
type PackageFormValues = z.infer<typeof packageSchema>;

function PackagesTab() {
  const { toast } = useToast();
  const { data: packages, isLoading } = useAdminListPackages({});
  const createPackage = useAdminCreatePackage();
  const updatePackage = useAdminUpdatePackage();
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const form = useForm<PackageFormValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: { name: "", priceUsdt: "", roiPercent: "", roiDays: 30, isActive: true },
  });

  const openCreate = () => { setEditing(null); form.reset({ name: "", priceUsdt: "", roiPercent: "", roiDays: 30, isActive: true }); setOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    form.reset({ name: p.name, priceUsdt: p.priceUsdt, roiPercent: p.roiPercent, roiDays: p.roiDays, isActive: p.isActive });
    setOpen(true);
  };

  const onSubmit = (vals: PackageFormValues) => {
    if (editing) {
      updatePackage.mutate({ id: editing.id, data: vals as any }, {
        onSuccess: () => { toast({ title: "Package updated" }); setOpen(false); qc.invalidateQueries({ queryKey: ["/api/packages"] }); },
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      });
    } else {
      createPackage.mutate({ data: vals as any }, {
        onSuccess: () => { toast({ title: "Package created" }); setOpen(false); qc.invalidateQueries({ queryKey: ["/api/packages"] }); },
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold uppercase tracking-wider">Package Management</h2>
        <Button onClick={openCreate} className="rounded-none font-bold uppercase tracking-wider text-xs gap-2">
          <PlusCircle className="w-4 h-4" /> New Package
        </Button>
      </div>
      <div className="bg-card border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="font-bold uppercase tracking-wider text-xs">Name</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Price</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Daily Profit Share</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Days</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Status</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {packages?.map((p: any) => (
              <TableRow key={p.id} className="border-border">
                <TableCell className="font-semibold">{p.name}</TableCell>
                <TableCell className="font-mono">${p.priceUsdt}</TableCell>
                <TableCell className="font-mono">{p.roiPercent}%</TableCell>
                <TableCell>{p.roiDays}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={p.isActive ? "text-green-700 border-green-300 bg-green-50" : "text-muted-foreground"}>
                    {p.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)} className="rounded-none h-8 w-8">
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px] rounded-none border-border bg-background">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider font-black">{editing ? "Edit Package" : "New Package"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
              {(["name", "priceUsdt", "roiPercent"] as const).map((f) => (
                <FormField key={f} control={form.control} name={f} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">
                      {f === "name" ? "Package Name" : f === "priceUsdt" ? "Price (USDT)" : "Daily Profit Share %"}
                    </FormLabel>
                    <FormControl><Input className="rounded-none bg-card font-mono" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ))}
              <FormField control={form.control} name="roiDays" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider">Duration (days)</FormLabel>
                  <FormControl><Input type="number" className="rounded-none bg-card font-mono" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex items-center gap-3">
                <input type="checkbox" id="pkg-active" checked={form.watch("isActive")} onChange={(e) => form.setValue("isActive", e.target.checked)} />
                <label htmlFor="pkg-active" className="text-sm font-semibold">Active (visible to users)</label>
              </div>
              <Button type="submit" disabled={createPackage.isPending || updatePackage.isPending} className="w-full rounded-none font-bold uppercase tracking-wider">
                {editing ? "Update Package" : "Create Package"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Referral Levels Admin Tab ────────────────────────────────────────────────

function ReferralLevelsTab() {
  const { toast } = useToast();
  const { data: levels, isLoading } = useAdminGetReferralLevels({});
  const updateLevels = useAdminUpdateReferralLevels();
  const qc = useQueryClient();

  const [rows, setRows] = useState<{ level: number; percent: string; requiredDirects: number }[]>([]);

  useEffect(() => {
    if (levels) {
      setRows(levels.map((l: any) => ({ level: l.level, percent: String(l.percent), requiredDirects: l.requiredDirects })));
    } else if (!isLoading) {
      setRows(Array.from({ length: 10 }, (_, i) => ({ level: i + 1, percent: "0", requiredDirects: 0 })));
    }
  }, [levels, isLoading]);

  const setField = (idx: number, key: "percent" | "requiredDirects", val: string) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [key]: key === "requiredDirects" ? parseInt(val) || 0 : val } : r));
  };

  const save = () => {
    updateLevels.mutate({ data: { levels: rows.map((r) => ({ ...r, percent: r.percent })) } as any }, {
      onSuccess: () => { toast({ title: "Referral levels saved" }); qc.invalidateQueries({ queryKey: ["/api/admin/referral-levels"] }); },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold uppercase tracking-wider">Referral Level Config</h2>
        <Button onClick={save} disabled={updateLevels.isPending} className="rounded-none font-bold uppercase tracking-wider text-xs">
          {updateLevels.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : "Save All Levels"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Set referral commission % and required direct referrals for each of the 10 levels. Payouts trigger automatically on package purchase.</p>
      <div className="bg-card border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="font-bold uppercase tracking-wider text-xs w-16">Level</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Commission %</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Required Directs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {rows.map((r, idx) => (
              <TableRow key={r.level} className="border-border">
                <TableCell className="font-bold font-mono">L{r.level}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Input
                      value={r.percent}
                      onChange={(e) => setField(idx, "percent", e.target.value)}
                      className="rounded-none bg-background font-mono h-8 w-24 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={r.requiredDirects}
                    onChange={(e) => setField(idx, "requiredDirects", e.target.value)}
                    className="rounded-none bg-background font-mono h-8 w-24 text-xs"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Income Admin Tab ─────────────────────────────────────────────────────────

function IncomeAdminTab() {
  const { data: income, isLoading } = useAdminListIncome({});
  const { data: excess } = useAdminGetExcessWallet({});

  const incomeTypeColor: Record<string, string> = {
    roi: "bg-green-100 text-green-700",
    referral: "bg-blue-100 text-blue-700",
    royalty: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold uppercase tracking-wider">Income & Royalty</h2>

      {/* Excess wallet */}
      {excess && (
        <div className="bg-card border border-border p-4 space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Admin Excess Wallet</p>
          <p className="text-2xl font-black font-mono">{excess.pendingDistributions} pending distributions</p>
          <p className="text-xs text-muted-foreground">Royalty amounts credited when uplines are missing (admin keeps surplus)</p>
        </div>
      )}

      {/* Income log table */}
      <div className="bg-card border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="font-bold uppercase tracking-wider text-xs">Date</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">User</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Type</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Amount</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!isLoading && !income?.entries?.length && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No income records yet</TableCell></TableRow>
            )}
            {income?.entries?.map((e: any) => (
              <TableRow key={e.id} className="border-border">
                <TableCell className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="font-mono text-xs">{e.userId.split("-")[0]}</TableCell>
                <TableCell>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${incomeTypeColor[e.type] ?? "bg-muted text-muted-foreground"}`}>
                    {e.type.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-green-600">+{parseFloat(e.amount).toFixed(4)}</TableCell>
                <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]">{e.note ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Share Requests Admin Tab ─────────────────────────────────────────────────

function ShareRequestsAdminTab() {
  const { data: requests, isLoading } = useAdminListShareRequests({});
  const markTransferred = useAdminMarkShareTransferred();
  const qc = useQueryClient();
  const { toast } = useToast();

  async function handleTransfer(id: string) {
    try {
      await markTransferred.mutateAsync({ id });
      await qc.invalidateQueries({ queryKey: ["/admin/share-requests"] });
      toast({ title: "Marked as transferred" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  const transferred = requests?.filter((r) => r.status === "transferred") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold uppercase tracking-wider">Share Transfer Requests</h2>
        <div className="flex gap-2">
          <span className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full uppercase tracking-wider">
            {pending.length} Pending
          </span>
          <span className="text-xs font-bold bg-green-100 text-green-800 px-3 py-1.5 rounded-full uppercase tracking-wider">
            {transferred.length} Transferred
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : requests?.length === 0 ? (
        <div className="text-center py-12">
          <Leaf className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No share transfer requests yet.</p>
        </div>
      ) : (
        <div className="bg-card border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-bold uppercase tracking-wider text-xs">User</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs">Demat Account</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs text-center">Shares</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs">Requested</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs text-center">Status</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests?.map((r) => (
                <TableRow key={r.id} className="border-border">
                  <TableCell>
                    <p className="text-sm font-bold">{r.userFullName || "—"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{r.userEmail}</p>
                  </TableCell>
                  <TableCell>
                    {r.dematAccount ? (
                      <div>
                        <p className="text-xs font-bold">{r.dematAccount.holderName}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">DP: {r.dematAccount.dpId} · CL: {r.dematAccount.clientId}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-black text-green-700">{r.sharesCount}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.status === "transferred" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3" /> Done
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full uppercase tracking-wider">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => handleTransfer(r.id)}
                        disabled={markTransferred.isPending}
                        className="rounded-none text-xs font-bold uppercase tracking-wider bg-green-700 hover:bg-green-800 h-8 px-3"
                      >
                        Mark Transferred
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Ranks Admin Tab ──────────────────────────────────────────────────────────

function RanksAdminTab() {
  const { toast } = useToast();
  const { data: ranks } = useListRanks({});
  const { data: achievements, isLoading } = useAdminListRankAchievements({});
  const checkRank = useAdminCheckUserRank();
  const qc = useQueryClient();
  const [checkingUserId, setCheckingUserId] = useState<string | null>(null);
  const [manualUserId, setManualUserId] = useState("");

  const handleCheck = () => {
    if (!manualUserId.trim()) return;
    setCheckingUserId(manualUserId.trim());
    checkRank.mutate({ userId: manualUserId.trim() }, {
      onSuccess: (data) => {
        const rank = (data as any).currentRank;
        toast({ title: rank ? `Rank: ${rank.name}` : "No rank yet — check complete" });
        setCheckingUserId(null);
        qc.invalidateQueries({ queryKey: ["/api/admin/ranks/achievements"] });
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e.message, variant: "destructive" });
        setCheckingUserId(null);
      },
    });
  };

  const rankMap = new Map(ranks?.map((r: any) => [r.id, r]) ?? []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold uppercase tracking-wider">Ranks & Achievements</h2>
      </div>

      {/* Rank reference table */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Rank Reference</p>
        <div className="bg-card border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-bold uppercase tracking-wider text-xs">#</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs">Rank</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Target (USDT)</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Reward (USDT)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranks?.map((r: any) => (
                <TableRow key={r.id} className="border-border">
                  <TableCell className="font-mono font-bold text-xs text-muted-foreground">{r.position}</TableCell>
                  <TableCell className="font-semibold text-sm">{r.name}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-primary">{parseFloat(r.targetUsdt).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-green-600">+{parseFloat(r.rewardUsdt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Manual rank check */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Manual Rank Check</p>
        <div className="flex gap-2">
          <Input
            value={manualUserId}
            onChange={(e) => setManualUserId(e.target.value)}
            placeholder="Enter user ID…"
            className="rounded-none bg-card font-mono text-xs h-9"
          />
          <Button
            onClick={handleCheck}
            disabled={checkRank.isPending || !manualUserId.trim()}
            className="rounded-none font-bold uppercase tracking-wider text-xs whitespace-nowrap"
          >
            {checkRank.isPending && checkingUserId === manualUserId.trim()
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Checking…</>
              : "Check Rank"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Triggers rank evaluation for a user and awards any newly achieved rank rewards.</p>
      </div>

      {/* Achievements log */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Achievement Log</p>
        <div className="bg-card border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-bold uppercase tracking-wider text-xs">Date</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs">User</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs">Rank</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Reward Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!isLoading && !achievements?.length && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No rank achievements yet</TableCell></TableRow>
              )}
              {achievements?.map((a: any) => (
                <TableRow key={a.id} className="border-border">
                  <TableCell className="text-xs text-muted-foreground">{new Date(a.achievedAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs">
                    <div className="font-semibold">{a.userName ?? "—"}</div>
                    <div className="text-muted-foreground font-mono">{a.userEmail ?? a.userId.split("-")[0]}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {a.rankName ?? (rankMap.get(a.rankId) as any)?.name ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-green-600">
                    +{parseFloat(a.rewardPaid).toLocaleString()} USDT
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function Admin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const { data: stats } = useAdminGetShopStats();
  const { data: products } = useAdminListProducts({});
  const { data: orders } = useAdminListOrders({});
  const { data: categories } = useListCategories();

  const createCategory = useAdminCreateCategory({
    mutation: {
      onSuccess: () => {
        toast({ title: "Category created" });
        queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        setIsCategoryDialogOpen(false);
      }
    }
  });

  const categoryForm = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", slug: "", description: "", imageUrl: "" }
  });

  const onSubmitCategory = (data: z.infer<typeof categorySchema>) => {
    createCategory.mutate({ data });
  };

  const createProduct = useAdminCreateProduct({
    mutation: {
      onSuccess: () => {
        toast({ title: "Product created" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
        setIsProductDialogOpen(false);
      }
    }
  });

  const updateProduct = useAdminUpdateProduct({
    mutation: {
      onSuccess: () => {
        toast({ title: "Product updated" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
        setIsProductDialogOpen(false);
      }
    }
  });

  const deleteProduct = useAdminDeleteProduct({
    mutation: {
      onSuccess: () => {
        toast({ title: "Product deleted" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      }
    }
  });

  const updateOrderStatus = useAdminUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        toast({ title: "Order status updated" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      }
    }
  });

  const productForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", slug: "", description: "", priceUsdt: "", compareAtPrice: "", stock: 0, categoryId: "", imageUrls: [], isActive: true, isFeatured: false }
  });

  const openProductDialog = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      productForm.reset({
        name: product.name, slug: product.slug, description: product.description,
        priceUsdt: product.priceUsdt, compareAtPrice: product.compareAtPrice || "",
        stock: product.stock, categoryId: product.categoryId,
        imageUrls: product.imageUrls.join(", "), isActive: product.isActive, isFeatured: product.isFeatured
      });
    } else {
      setEditingProduct(null);
      productForm.reset({ name: "", slug: "", description: "", priceUsdt: "", compareAtPrice: "", stock: 0, categoryId: "", imageUrls: [], isActive: true, isFeatured: false });
    }
    setIsProductDialogOpen(true);
  };

  const onSubmitProduct = (data: ProductFormValues) => {
    const payload = {
      ...data,
      imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : (data.imageUrls as string).split(',').map(s => s.trim()).filter(Boolean),
      compareAtPrice: data.compareAtPrice || null
    };
    if (editingProduct) {
      updateProduct.mutate({ productId: editingProduct.id, data: payload });
    } else {
      createProduct.mutate({ data: payload });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Hero Header ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">Admin Panel</h1>
                <p className="text-slate-400 text-sm mt-0.5">Telebit Shop — full control centre</p>
              </div>
            </div>
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-primary">
              <CheckCircle2 className="w-3.5 h-3.5" /> Live
            </span>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-7">
            {[
              { label: "Revenue", value: `${stats?.totalRevenue || "0.00"} USDT`, icon: DollarSign, accent: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30", iconCls: "text-emerald-400" },
              { label: "Total Orders", value: String(stats?.totalOrders || 0), icon: ShoppingCart, accent: "from-blue-500/20 to-blue-600/10 border-blue-500/30", iconCls: "text-blue-400" },
              { label: "Pending", value: String(stats?.pendingOrders || 0), icon: Clock, accent: "from-amber-500/20 to-amber-600/10 border-amber-500/30", iconCls: "text-amber-400" },
              { label: "Products", value: String(stats?.totalProducts || 0), icon: Tag, accent: "from-violet-500/20 to-violet-600/10 border-violet-500/30", iconCls: "text-violet-400" },
            ].map(({ label, value, icon: Icon, accent, iconCls }) => (
              <div key={label} className={`rounded-2xl bg-gradient-to-br ${accent} border p-4 backdrop-blur-sm`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
                  <Icon className={`w-4 h-4 ${iconCls}`} />
                </div>
                <div className="text-xl font-black text-white font-mono leading-none">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="bg-white border-b border-slate-200 sticky top-14 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="h-12 bg-transparent border-0 p-0 w-full justify-start overflow-x-auto flex-nowrap gap-0">
              {[
                { value: "orders", label: "Orders", icon: ShoppingCart },
                { value: "products", label: "Products", icon: Package },
                { value: "categories", label: "Categories", icon: Tag },
                { value: "users", label: "Users", icon: Users },
                { value: "lottery", label: "Lottery", icon: Ticket },
                { value: "p2p", label: "P2P", icon: ArrowLeftRight },
                { value: "reviews", label: "Reviews", icon: Star },
                { value: "pkg-admin", label: "Packages", icon: TrendingUp },
                { value: "referral-levels", label: "Referral Levels", icon: Share2 },
                { value: "income-admin", label: "Income", icon: BarChart2 },
                { value: "ranks-admin", label: "Ranks", icon: Crown },
                { value: "shares-admin", label: "Share Requests", icon: Leaf },
                { value: "settings", label: "Settings", icon: Settings },
                { value: "support-admin", label: "Support", icon: MessageCircle },
                { value: "maintenance", label: "Maintenance", icon: Wrench },
              ].map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value} value={value}
                  className="h-12 px-4 rounded-none border-b-2 border-transparent bg-transparent text-slate-500 text-xs font-semibold uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-all hover:text-slate-800 hover:bg-slate-50 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent"
                >
                  <Icon className="h-3.5 w-3.5" />{label}
                </TabsTrigger>
              ))}
            </TabsList>

          {/* ── Tab Contents ── */}
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">

            <TabsContent value="orders" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Order Management</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{orders?.length ?? 0} orders total</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-slate-200 hover:bg-slate-50">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 py-3">Order ID</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 py-3">Date</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 py-3">Customer</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 py-3 text-right">Total</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 py-3">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders?.map((order) => (
                      <TableRow key={order.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-slate-700">{order.id.split('-')[0].toUpperCase()}</TableCell>
                        <TableCell className="text-sm text-slate-600">{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm font-medium text-slate-800">{order.shippingAddress.fullName}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-600">{order.totalUsdt} USDT</TableCell>
                        <TableCell>
                          <Select defaultValue={order.status} onValueChange={(val: any) => updateOrderStatus.mutate({ orderId: order.id, data: { status: val } })}>
                            <SelectTrigger className={`h-7 rounded-full text-[11px] font-bold uppercase tracking-wider w-32 border ${orderStatusColor(order.status)}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {["pending","confirmed","shipped","delivered","cancelled"].map(s => (
                                <SelectItem key={s} value={s} className="text-xs uppercase tracking-wider font-semibold">{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(!orders?.length) && <div className="py-12 text-center text-sm text-slate-400">No orders yet</div>}
              </div>
            </TabsContent>

            <TabsContent value="products" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Product Catalog</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{products?.products?.length ?? 0} products</p>
                </div>
                <Button onClick={() => openProductDialog()} className="rounded-xl font-semibold text-xs h-9 px-4">+ Add Product</Button>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-slate-200 hover:bg-slate-50">
                      {["Name","Category","Price","Stock","Status",""].map((h,i) => (
                        <TableHead key={i} className={`font-semibold text-xs uppercase tracking-wider text-slate-500 py-3 ${i===2||i===3?"text-right":i===4?"text-center":""}`}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products?.products?.map((product) => (
                      <TableRow key={product.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-semibold text-sm text-slate-800">{product.name}</TableCell>
                        <TableCell className="text-xs text-slate-500">{product.categoryName}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-600">{product.priceUsdt} USDT</TableCell>
                        <TableCell className="text-right font-mono text-slate-700">{product.stock}</TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${product.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                            {product.isActive ? 'Active' : 'Draft'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openProductDialog(product)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5"><Edit className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteProduct.mutate({ productId: product.id })} className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(!products?.products?.length) && <div className="py-12 text-center text-sm text-slate-400">No products yet</div>}
              </div>
            </TabsContent>

            <TabsContent value="categories" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Category Management</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{categories?.length ?? 0} categories</p>
                </div>
                <Button onClick={() => setIsCategoryDialogOpen(true)} className="rounded-xl font-semibold text-xs h-9 px-4">+ Add Category</Button>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-slate-200 hover:bg-slate-50">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 py-3">Name</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 py-3">Slug</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 py-3 text-right">Products</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories?.map((cat) => (
                      <TableRow key={cat.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-semibold text-sm text-slate-800">{cat.name}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-500">{cat.slug}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-700">{cat.productCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(!categories?.length) && <div className="py-12 text-center text-sm text-slate-400">No categories yet</div>}
              </div>
            </TabsContent>

            <TabsContent value="users" className="mt-0"><UsersTab /></TabsContent>
            <TabsContent value="lottery" className="mt-0"><LotteryTab /></TabsContent>
            <TabsContent value="p2p" className="mt-0"><P2PTab /></TabsContent>
            <TabsContent value="reviews" className="mt-0"><ReviewsTab /></TabsContent>
            <TabsContent value="pkg-admin" className="mt-0"><PackagesTab /></TabsContent>
            <TabsContent value="referral-levels" className="mt-0"><ReferralLevelsTab /></TabsContent>
            <TabsContent value="income-admin" className="mt-0"><IncomeAdminTab /></TabsContent>
            <TabsContent value="ranks-admin" className="mt-0"><RanksAdminTab /></TabsContent>
            <TabsContent value="shares-admin" className="mt-0"><ShareRequestsAdminTab /></TabsContent>
            <TabsContent value="settings" className="mt-0"><SettingsTab /></TabsContent>
            <TabsContent value="support-admin" className="mt-0"><SupportAdminTab /></TabsContent>
            <TabsContent value="maintenance" className="mt-0"><MaintenanceTab /></TabsContent>
          </div>{/* /content wrapper */}
          </Tabs>
        </div>{/* /max-w-7xl nav */}
      </div>{/* /sticky tab bar */}

      {/* Product Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-none border-border bg-background max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider font-black">{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <Form {...productForm}>
            <form onSubmit={productForm.handleSubmit(onSubmitProduct)} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={productForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Product Name</FormLabel>
                    <FormControl><Input className="rounded-none bg-card" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={productForm.control} name="slug" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Slug</FormLabel>
                    <FormControl><Input className="rounded-none bg-card" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={productForm.control} name="categoryId" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="rounded-none bg-card"><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
                    <SelectContent className="rounded-none">
                      {categories?.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-3 gap-4">
                <FormField control={productForm.control} name="priceUsdt" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Price (USDT)</FormLabel>
                    <FormControl><Input type="number" step="0.01" className="rounded-none bg-card font-mono" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={productForm.control} name="compareAtPrice" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Compare Price</FormLabel>
                    <FormControl><Input type="number" step="0.01" className="rounded-none bg-card font-mono" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={productForm.control} name="stock" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Stock</FormLabel>
                    <FormControl><Input type="number" className="rounded-none bg-card font-mono" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={productForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Description</FormLabel>
                  <FormControl><Textarea className="rounded-none bg-card min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={productForm.control} name="imageUrls" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Image URLs (comma separated)</FormLabel>
                  <FormControl><Input className="rounded-none bg-card font-mono text-xs" {...field} value={Array.isArray(field.value) ? field.value.join(", ") : field.value} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending} className="w-full rounded-none font-bold uppercase tracking-wider">
                {editingProduct ? 'Update Product' : 'Create Product'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-none border-border bg-background">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider font-black">Add New Category</DialogTitle>
          </DialogHeader>
          <Form {...categoryForm}>
            <form onSubmit={categoryForm.handleSubmit(onSubmitCategory)} className="space-y-4 pt-4">
              <FormField control={categoryForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Category Name</FormLabel>
                  <FormControl><Input className="rounded-none bg-card" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={categoryForm.control} name="slug" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Slug</FormLabel>
                  <FormControl><Input className="rounded-none bg-card" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={categoryForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Description</FormLabel>
                  <FormControl><Textarea className="rounded-none bg-card" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={categoryForm.control} name="imageUrl" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Image URL</FormLabel>
                  <FormControl><Input className="rounded-none bg-card" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" disabled={createCategory.isPending} className="w-full rounded-none font-bold uppercase tracking-wider">Create Category</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
