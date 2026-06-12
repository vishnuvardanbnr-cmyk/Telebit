import { useState } from "react";
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
import { Package, DollarSign, ShoppingCart, Tag, Edit, Trash2, Users, Ticket, ArrowLeftRight, Star, Ban, CheckCircle, Play, AlertTriangle, Settings, Eye, EyeOff, PlusCircle } from "lucide-react";
import { useEffect, useCallback } from "react";

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

function UsersTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: users, isLoading } = useAdminListUsers({});

  const [balanceTarget, setBalanceTarget] = useState<{ id: string; name: string; email: string; balance: string } | null>(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceNote, setBalanceNote] = useState("");

  const toggle = useAdminToggleUserBlock({
    mutation: {
      onSuccess: () => {
        toast({ title: "User status updated" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      }
    }
  });

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
            {users?.map((user) => (
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
                  <Badge variant="outline" className={`rounded-none text-[10px] uppercase tracking-widest ${user.withdrawalBlocked ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>
                    {user.withdrawalBlocked ? "Blocked" : "Active"}
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
                      onClick={() => toggle.mutate({ userId: user.id, data: { blocked: !user.withdrawalBlocked } })}
                      className={`h-8 rounded-none text-xs font-bold uppercase tracking-wider ${user.withdrawalBlocked ? 'text-green-600 hover:text-green-700' : 'text-destructive hover:text-destructive/80'}`}
                    >
                      {user.withdrawalBlocked ? <><CheckCircle className="h-3 w-3 mr-1" />Unblock</> : <><Ban className="h-3 w-3 mr-1" />Block</>}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
  gasWalletPrivateKey?: string;
  withdrawWalletPrivateKey?: string;
  withdrawFeeFlat: string;
  withdrawFeePercent: string;
  withdrawFeeMode: string;
  withdrawalMode: string;
  withdrawalEnabled: boolean;
  minDepositUsdt: string;
  depositFeeFlat: string;
  depositFeePercent: string;
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
  const [saving, setSaving] = useState(false);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/admin/settings");
      setCfg(data);
    } catch {
      toast({ title: "Failed to load settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const set = (key: keyof AdminSettings) => (v: string | boolean) =>
    setCfg((prev) => prev ? { ...prev, [key]: v } : prev);

  const registerWebhook = async () => {
    setRegisteringWebhook(true);
    try {
      const webhookUrl = `${window.location.origin}/api/auth/bot-webhook`;
      await apiFetch("/auth/bot-webhook/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });
      toast({ title: "Webhook registered!", description: webhookUrl });
    } catch (err: any) {
      toast({ title: "Webhook registration failed", description: err.message ?? "Unknown error", variant: "destructive" });
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

  if (loading || !cfg) return (
    <div className="space-y-4 py-8">
      {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-muted/40 rounded animate-pulse" />)}
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
        <SettingField
          label="Admin Master Wallet"
          hint="Address that receives swept deposits"
          value={cfg.adminMasterWallet}
          onChange={set("adminMasterWallet")}
        />
        <SettingField
          label="Gas Wallet Private Key"
          hint="Funds BNB gas for sweep transactions"
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

      {/* Fees */}
      <div className="bg-card border border-border p-5 space-y-4">
        <h3 className="font-bold uppercase tracking-wider text-sm">Fees &amp; Limits</h3>
        <div className="grid grid-cols-2 gap-4">
          <SettingField label="Deposit Fee (flat USDT)" value={cfg.depositFeeFlat} onChange={set("depositFeeFlat")} />
          <SettingField label="Deposit Fee (%)" value={cfg.depositFeePercent} onChange={set("depositFeePercent")} />
          <SettingField label="Withdrawal Fee (flat USDT)" value={cfg.withdrawFeeFlat} onChange={set("withdrawFeeFlat")} />
          <SettingField label="Withdrawal Fee (%)" value={cfg.withdrawFeePercent} onChange={set("withdrawFeePercent")} />
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
    <div className="container mx-auto px-4 md:px-8 py-8">
      <h1 className="text-3xl font-black uppercase tracking-wider mb-8">Shop Administration</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="rounded-none border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-black text-primary font-mono">{stats?.totalRevenue || "0.00"} USDT</div></CardContent>
        </Card>
        <Card className="rounded-none border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-black font-mono">{stats?.totalOrders || 0}</div></CardContent>
        </Card>
        <Card className="rounded-none border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Pending</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-black font-mono">{stats?.pendingOrders || 0}</div></CardContent>
        </Card>
        <Card className="rounded-none border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Products</CardTitle>
            <Tag className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-black font-mono">{stats?.totalProducts || 0}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList className="bg-card border border-border rounded-none h-12 w-full justify-start p-0 overflow-x-auto flex-nowrap">
          {[
            { value: "orders", label: "Orders", icon: ShoppingCart },
            { value: "products", label: "Products", icon: Package },
            { value: "categories", label: "Categories", icon: Tag },
            { value: "users", label: "Users", icon: Users },
            { value: "lottery", label: "Lottery", icon: Ticket },
            { value: "p2p", label: "P2P", icon: ArrowLeftRight },
            { value: "reviews", label: "Reviews", icon: Star },
            { value: "settings", label: "Settings", icon: Settings },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="rounded-none h-full px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary uppercase tracking-wider font-bold text-xs whitespace-nowrap flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <h2 className="text-xl font-bold uppercase tracking-wider">Order Management</h2>
          <div className="bg-card border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Order ID</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Date</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Customer</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Total</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.map((order) => (
                  <TableRow key={order.id} className="border-border">
                    <TableCell className="font-mono text-sm">{order.id.split('-')[0].toUpperCase()}</TableCell>
                    <TableCell className="text-sm">{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm">{order.shippingAddress.fullName}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">{order.totalUsdt} USDT</TableCell>
                    <TableCell>
                      <Select defaultValue={order.status} onValueChange={(val: any) => updateOrderStatus.mutate({ orderId: order.id, data: { status: val } })}>
                        <SelectTrigger className={`h-8 rounded-none text-xs font-bold uppercase tracking-wider w-32 ${orderStatusColor(order.status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="pending" className="text-xs uppercase tracking-wider font-bold">Pending</SelectItem>
                          <SelectItem value="confirmed" className="text-xs uppercase tracking-wider font-bold">Confirmed</SelectItem>
                          <SelectItem value="shipped" className="text-xs uppercase tracking-wider font-bold">Shipped</SelectItem>
                          <SelectItem value="delivered" className="text-xs uppercase tracking-wider font-bold">Delivered</SelectItem>
                          <SelectItem value="cancelled" className="text-xs uppercase tracking-wider font-bold">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold uppercase tracking-wider">Product Catalog</h2>
            <Button onClick={() => openProductDialog()} className="rounded-none font-bold uppercase tracking-wider text-xs">Add Product</Button>
          </div>
          <div className="bg-card border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Name</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Category</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Price</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Stock</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs text-center">Status</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.products?.map((product) => (
                  <TableRow key={product.id} className="border-border">
                    <TableCell className="font-bold text-sm">{product.name}</TableCell>
                    <TableCell className="text-xs uppercase tracking-widest text-muted-foreground">{product.categoryName}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">{product.priceUsdt} USDT</TableCell>
                    <TableCell className="text-right font-mono">{product.stock}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`rounded-none text-[10px] uppercase tracking-widest ${product.isActive ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-muted text-muted-foreground'}`}>
                        {product.isActive ? 'Active' : 'Draft'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openProductDialog(product)} className="h-8 w-8 text-muted-foreground hover:text-primary"><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteProduct.mutate({ productId: product.id })} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold uppercase tracking-wider">Category Management</h2>
            <Button onClick={() => setIsCategoryDialogOpen(true)} className="rounded-none font-bold uppercase tracking-wider text-xs">Add Category</Button>
          </div>
          <div className="bg-card border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Name</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Slug</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Products</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories?.map((cat) => (
                  <TableRow key={cat.id} className="border-border">
                    <TableCell className="font-bold text-sm">{cat.name}</TableCell>
                    <TableCell className="text-xs uppercase tracking-widest text-muted-foreground">{cat.slug}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">{cat.productCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="lottery"><LotteryTab /></TabsContent>
        <TabsContent value="p2p"><P2PTab /></TabsContent>
        <TabsContent value="reviews"><ReviewsTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>

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
