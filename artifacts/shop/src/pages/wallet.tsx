import { useState } from "react";
import {
  useGetMe, useCheckDeposit, useGetSettings, useCreateWithdrawal,
  useListDeposits, useListWithdrawals, useListOrders, useListMyPackages,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy, RefreshCw, AlertCircle, ArrowUpRight, ArrowDownLeft,
  ArrowUpRightSquare, Package, Clock, CheckCircle2, XCircle,
  Loader2, PlusCircle, MinusCircle,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";

type HistoryTab = "deposits" | "withdrawals" | "orders";

/* ─── Deposit sheet ──────────────────────────────────────────── */
function DepositSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: user, isLoading } = useGetMe();
  const checkDeposit = useCheckDeposit();

  const copy = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.depositAddress);
    toast.success("Address copied");
  };

  const handleCheck = () => {
    checkDeposit.mutate(undefined, {
      onSuccess: (res) => {
        if (res.found) toast.success(`Deposit detected — ${res.amount} USDT credited`);
        else toast.info(res.message);
      },
      onError: () => toast.error("Failed to check for deposits"),
    });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl px-5 pt-5 pb-8 max-h-[92vh] overflow-y-auto"
      >
        {/* drag handle */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

        <SheetHeader className="text-left mb-5">
          <SheetTitle className="flex items-center gap-2 text-lg font-bold">
            <ArrowDownLeft className="w-5 h-5 text-green-600" />
            Deposit USDT
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            BNB Smart Chain (BEP-20) · Send USDT only
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-52 w-52 mx-auto rounded-2xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        )}

        {!isLoading && !user && (
          <div className="flex items-center gap-2 text-destructive text-sm py-6 justify-center">
            <AlertCircle className="w-4 h-4" /> Failed to load wallet info
          </div>
        )}

        {!isLoading && user && (
          <div className="space-y-5">
            {/* QR code */}
            <div className="flex justify-center">
              <div className="p-4 bg-white border border-border rounded-2xl shadow-sm">
                <QRCodeSVG value={user.depositAddress} size={200} level="M" />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Your Deposit Address
              </p>
              <div className="flex items-stretch rounded-xl border border-border overflow-hidden">
                <div className="flex-1 px-3 py-3 font-mono text-[11px] text-foreground truncate bg-muted/30">
                  {user.depositAddress}
                </div>
                <button
                  onClick={copy}
                  className="px-4 bg-background border-l border-border hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Check button */}
            <Button
              variant="outline"
              onClick={handleCheck}
              disabled={checkDeposit.isPending}
              className="w-full rounded-xl h-11 font-semibold"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", checkDeposit.isPending && "animate-spin")} />
              {checkDeposit.isPending ? "Scanning BSC network…" : "Check for New Deposit"}
            </Button>

            {/* Note */}
            <div className="flex items-start gap-2 px-3 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Send <strong>only USDT</strong> on the <strong>BNB Smart Chain (BEP-20)</strong> network.
                Sending other tokens or using a different network results in permanent loss.
              </p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ─── Withdraw sheet ─────────────────────────────────────────── */
const withdrawSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Enter a positive amount"),
  destinationAddress: z
    .string()
    .min(42, "Invalid BSC address")
    .max(42, "Invalid BSC address")
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 0x hex address"),
});
type WithdrawForm = z.infer<typeof withdrawSchema>;

function WithdrawSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: user } = useGetMe();
  const { data: settings, isLoading } = useGetSettings();
  const { data: myPackages } = useListMyPackages({});
  const createWithdrawal = useCreateWithdrawal();
  const hasActivePackage = (myPackages ?? []).some((p) => p.isActive);

  const form = useForm<WithdrawForm>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: "", destinationAddress: "" },
  });

  const watchAmount = form.watch("amount");
  const parsedAmount = parseFloat(watchAmount) || 0;
  const balance = parseFloat(user?.biddingProfitBalance ?? "0");

  let fee = 0;
  if (settings) {
    fee = parseFloat(settings.withdrawFeeFlat) + parsedAmount * (parseFloat(settings.withdrawFeePercent) / 100);
  }
  const deductFromAmount = settings?.withdrawFeeMode === "deduct_from_amount";
  const totalDeducted = deductFromAmount ? parsedAmount : parsedAmount + fee;
  const recipientGets = deductFromAmount ? Math.max(0, parsedAmount - fee) : parsedAmount;
  const overBalance = totalDeducted > balance && parsedAmount > 0;
  const underMinimum = parsedAmount > 0 && parsedAmount < 10;

  const onSubmit = (values: WithdrawForm) => {
    if (overBalance) { toast.error("Insufficient income balance"); return; }
    if (underMinimum) { toast.error("Minimum withdrawal amount is $10 USDT"); return; }
    createWithdrawal.mutate({ data: values }, {
      onSuccess: () => {
        toast.success("Withdrawal request submitted — awaiting admin approval");
        form.reset();
        onClose();
      },
      onError: (err: any) => toast.error(err.message ?? "Failed to submit withdrawal"),
    });
  };

  const blocked = user?.withdrawalBlocked;
  const disabled = !settings?.withdrawalEnabled;
  const noPackage = myPackages !== undefined && !hasActivePackage;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl px-5 pt-5 pb-8 max-h-[92vh] overflow-y-auto"
      >
        {/* drag handle */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

        <SheetHeader className="text-left mb-5">
          <SheetTitle className="flex items-center gap-2 text-lg font-bold">
            <ArrowUpRight className="w-5 h-5 text-primary" />
            Withdraw USDT
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Submit a withdrawal request to your BSC wallet
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        )}

        {!isLoading && (disabled || blocked) && (
          <div className="flex items-start gap-3 px-4 py-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                {disabled ? "Withdrawals Disabled" : "Account Restricted"}
              </p>
              <p className="text-xs text-red-700 mt-0.5">
                {disabled
                  ? "Withdrawals are currently disabled by the platform."
                  : "Withdrawals for your account have been restricted. Please contact support."}
              </p>
            </div>
          </div>
        )}

        {!isLoading && !disabled && !blocked && noPackage && (
          <div className="flex items-start gap-3 px-4 py-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Active Package Required</p>
              <p className="text-xs text-amber-700 mt-0.5">
                You need an active investment package to withdraw. <a href="/packages" className="underline font-semibold">Purchase a package</a> to unlock withdrawals.
              </p>
            </div>
          </div>
        )}

        {!isLoading && !disabled && !blocked && (
          <div className="space-y-4">
            {/* Balance pill - income balance (withdrawable) */}
            <div className="flex items-center justify-between rounded-xl bg-muted/40 border border-border px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Income Balance (Withdrawable)</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">Min $10 · 1st & 15th only · Max 2/month</p>
              </div>
              <p className="text-base font-bold text-foreground">{fmtUsdt(user?.biddingProfitBalance ?? "0")} <span className="text-xs font-normal text-muted-foreground">USDT</span></p>
            </div>

            {/* Withdrawal rules info */}
            <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 border border-blue-200 px-3 py-3">
              <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800 space-y-0.5">
                <p className="font-semibold">Withdrawal Rules</p>
                <p>Requires an <strong>active investment package</strong>. Opens on the <strong>1st and 15th</strong> of each month. Max <strong>2 withdrawals/month</strong>. Min <strong>$10 USDT</strong>. A <strong>15% royalty fee</strong> is distributed to your uplines on each withdrawal.</p>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="destinationAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Destination Address (BSC BEP-20)
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="0x…" className="h-11 font-mono text-xs rounded-xl" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex justify-between items-center">
                      Amount (USDT)
                      <button
                        type="button"
                        onClick={() => form.setValue("amount", String(balance), { shouldValidate: true })}
                        className="text-[11px] font-bold text-primary hover:underline normal-case tracking-normal"
                      >
                        MAX
                      </button>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" step="0.0001" min="0" placeholder="0.0000" className="h-11 font-mono rounded-xl" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                {/* Fee summary */}
                <div className={cn(
                  "rounded-xl border px-4 py-3 space-y-2",
                  overBalance ? "bg-red-50 border-red-200" : "bg-muted/30 border-border"
                )}>
                  {[
                    { label: "Withdrawal Amount", value: `${fmtUsdt(parsedAmount)} USDT`, colored: false },
                    { label: "Network Fee", value: `−${fmtUsdt(fee)} USDT`, colored: true, red: true },
                    { label: "Total Deducted", value: `${fmtUsdt(totalDeducted)} USDT`, bold: true, red: overBalance },
                    { label: "Recipient Gets", value: `${fmtUsdt(recipientGets)} USDT`, colored: true, green: true },
                  ].map(({ label, value, bold, red, green, colored }) => (
                    <div key={label} className={cn("flex justify-between text-xs", bold && "border-t border-border pt-2 font-semibold")}>
                      <span className="text-muted-foreground">{label}</span>
                      <span className={cn(
                        "font-mono",
                        red && "text-red-500",
                        green && "text-green-600 font-semibold",
                        bold && overBalance && "text-red-600",
                      )}>{value}</span>
                    </div>
                  ))}
                  {overBalance && (
                    <p className="text-[11px] font-semibold text-red-600 pt-0.5">Insufficient income balance</p>
                  )}
                  {underMinimum && !overBalance && (
                    <p className="text-[11px] font-semibold text-amber-600 pt-0.5">Minimum withdrawal is $10 USDT</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl font-bold text-sm"
                  disabled={createWithdrawal.isPending || overBalance || underMinimum || noPackage}
                >
                  {createWithdrawal.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
                  ) : (
                    <><ArrowUpRight className="w-4 h-4 mr-2" /> Submit Withdrawal Request</>
                  )}
                </Button>
              </form>
            </Form>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ─── Transaction history ─────────────────────────────────────── */

function depositStatusMeta(status: string) {
  switch (status) {
    case "credited": return { label: "Credited", Icon: CheckCircle2, cls: "text-green-700 bg-green-50 border-green-200" };
    case "sweeping": return { label: "Processing", Icon: Loader2, cls: "text-blue-700 bg-blue-50 border-blue-200", spin: true };
    case "failed": return { label: "Failed", Icon: XCircle, cls: "text-red-600 bg-red-50 border-red-200" };
    default: return { label: "Pending", Icon: Clock, cls: "text-amber-700 bg-amber-50 border-amber-200" };
  }
}

function withdrawalStatusMeta(status: string) {
  switch (status) {
    case "approved": return { label: "Approved", Icon: CheckCircle2, cls: "text-green-700 bg-green-50 border-green-200" };
    case "rejected": return { label: "Rejected", Icon: XCircle, cls: "text-red-600 bg-red-50 border-red-200" };
    default: return { label: "Pending", Icon: Clock, cls: "text-amber-700 bg-amber-50 border-amber-200" };
  }
}

function orderStatusMeta(status: string) {
  switch (status) {
    case "delivered": return { label: "Delivered", Icon: CheckCircle2, cls: "text-green-700 bg-green-50 border-green-200" };
    case "shipped": return { label: "Shipped", Icon: ArrowUpRightSquare, cls: "text-blue-700 bg-blue-50 border-blue-200" };
    case "confirmed": return { label: "Confirmed", Icon: CheckCircle2, cls: "text-primary bg-primary/5 border-primary/20" };
    case "cancelled": return { label: "Cancelled", Icon: XCircle, cls: "text-red-600 bg-red-50 border-red-200" };
    default: return { label: "Pending", Icon: Clock, cls: "text-amber-700 bg-amber-50 border-amber-200" };
  }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function TxRow({ iconBg, icon: Icon, iconColor, title, subtitle, amount, amountColor, meta, spin = false }: {
  iconBg: string; icon: any; iconColor: string; title: string; subtitle?: string;
  amount: string; amountColor: string; meta: ReturnType<typeof depositStatusMeta>; spin?: boolean;
}) {
  const StatusIcon = meta.Icon;
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-card hover:bg-muted/20 transition-colors">
      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("w-4 h-4", iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", meta.cls)}>
            <StatusIcon className={cn("w-2.5 h-2.5", spin && "animate-spin")} />
            {meta.label}
          </span>
        </div>
        {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-sm font-bold tabular-nums", amountColor)}>{amount}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center">
      <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/25" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function TransactionHistory() {
  const [tab, setTab] = useState<HistoryTab>("deposits");
  const { data: deposits, isLoading: loadDep } = useListDeposits({});
  const { data: withdrawals, isLoading: loadWd } = useListWithdrawals({});
  const { data: orders, isLoading: loadOrd } = useListOrders({});

  const tabs: { key: HistoryTab; label: string; count?: number }[] = [
    { key: "deposits", label: "Deposits", count: deposits?.length },
    { key: "withdrawals", label: "Withdrawals", count: withdrawals?.length },
    { key: "orders", label: "Orders", count: orders?.length },
  ];

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Transaction History
      </h2>

      {/* Tab bar */}
      <div className="flex bg-muted/40 rounded-2xl p-1 gap-1 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 py-2 px-1 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1",
              tab === t.key
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {(t.count ?? 0) > 0 && (
              <span className={cn(
                "w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center",
                tab === t.key ? "bg-primary text-white" : "bg-muted-foreground/15 text-muted-foreground",
              )}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Deposits */}
      {tab === "deposits" && (
        <div className="space-y-2">
          {loadDep && <Skeleton className="h-16 w-full rounded-2xl" />}
          {!loadDep && !deposits?.length && <EmptyState message="No deposits yet" />}
          {deposits?.map((d) => {
            const m = depositStatusMeta(d.status);
            return (
              <TxRow
                key={d.id}
                iconBg="bg-green-100"
                icon={ArrowDownLeft}
                iconColor="text-green-600"
                title="Deposit"
                subtitle={d.txHash ? d.txHash : fmtDate(d.createdAt)}
                amount={`+${fmtUsdt(d.amount)} USDT`}
                amountColor="text-green-600"
                meta={m}
                spin={d.status === "sweeping"}
              />
            );
          })}
        </div>
      )}

      {/* Withdrawals */}
      {tab === "withdrawals" && (
        <div className="space-y-2">
          {loadWd && <Skeleton className="h-16 w-full rounded-2xl" />}
          {!loadWd && !withdrawals?.length && <EmptyState message="No withdrawals yet" />}
          {withdrawals?.map((w) => (
            <TxRow
              key={w.id}
              iconBg="bg-red-100"
              icon={ArrowUpRight}
              iconColor="text-red-500"
              title="Withdrawal"
              subtitle={w.rejectionReason ?? w.destinationAddress}
              amount={`−${fmtUsdt(w.amount)} USDT`}
              amountColor="text-red-500"
              meta={withdrawalStatusMeta(w.status)}
            />
          ))}
        </div>
      )}

      {/* Orders */}
      {tab === "orders" && (
        <div className="space-y-2">
          {loadOrd && <Skeleton className="h-16 w-full rounded-2xl" />}
          {!loadOrd && !orders?.length && <EmptyState message="No orders yet" />}
          {orders?.map((o) => (
            <TxRow
              key={o.id}
              iconBg="bg-primary/10"
              icon={Package}
              iconColor="text-primary"
              title={o.items.map((i) => i.productName).join(", ")}
              subtitle={fmtDate(o.createdAt)}
              amount={`−${fmtUsdt(o.totalUsdt)} USDT`}
              amountColor="text-foreground"
              meta={orderStatusMeta(o.status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Wallet page ───────────────────────────────────────── */
export default function Wallet() {
  const { data: user } = useGetMe();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Wallet</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your USDT balance</p>
      </div>

      {/* Balance card */}
      <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-6 py-6 shadow-lg shadow-primary/20">
        <p className="text-xs font-medium opacity-70 uppercase tracking-wide mb-1">Available Balance</p>
        <p className="font-black text-4xl tracking-tight">
          {fmtUsdt(user?.walletBalance)}
        </p>
        <p className="text-sm font-medium opacity-70 mt-0.5">USDT · BEP-20</p>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setDepositOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-sm font-semibold py-3 rounded-2xl transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Deposit
          </button>
          <button
            onClick={() => setWithdrawOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-sm font-semibold py-3 rounded-2xl transition-colors"
          >
            <MinusCircle className="w-4 h-4" />
            Withdraw Profit
          </button>
        </div>
      </div>

      {/* Income balance card */}
      <div className="rounded-2xl border border-green-200 bg-green-50/60 px-5 py-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Income Balance</p>
          <p className="text-[11px] text-green-600/80 mt-0.5">Withdrawable · Min $10 · 1st &amp; 15th only · Max 2/month</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-green-800 tabular-nums">{fmtUsdt(user?.biddingProfitBalance ?? "0")}</p>
          <p className="text-[11px] text-green-600">USDT</p>
        </div>
      </div>

      {/* Transaction history */}
      <TransactionHistory />

      {/* Sheets */}
      <DepositSheet open={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawSheet open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </div>
  );
}
