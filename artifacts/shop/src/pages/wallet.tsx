import { useState } from "react";
import {
  useGetMe, useCheckDeposit, useGetSettings, useCreateWithdrawal,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Copy, RefreshCw, AlertCircle, Download, ArrowUpRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Tab = "deposit" | "withdraw";

/* ─── Deposit tab ────────────────────────────────────────────── */
function DepositTab() {
  const { data: user, isLoading } = useGetMe();
  const checkDeposit = useCheckDeposit();

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Address copied to clipboard");
  };

  const handleCheck = () => {
    checkDeposit.mutate(undefined, {
      onSuccess: (res) => {
        if (res.found) toast.success(`Deposit found! Credited ${res.amount} USDT.`);
        else toast.info(res.message);
      },
      onError: () => toast.error("Failed to check for deposits."),
    });
  };

  if (isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;

  if (!user) return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>Failed to load deposit info</AlertDescription>
    </Alert>
  );

  return (
    <div className="space-y-5">
      {/* QR + address */}
      <Card>
        <CardHeader className="pb-3 border-b border-border bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">BNB Smart Chain (BEP-20)</p>
          <p className="text-xs text-muted-foreground mt-0.5">Send only USDT on the BSC network to this address</p>
        </CardHeader>
        <CardContent className="pt-5 flex flex-col items-center gap-4">
          <div className="p-3 bg-white border border-border rounded-xl">
            <QRCodeSVG value={user.depositAddress} size={160} level="M" />
          </div>

          <div className="w-full">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
              Your Deposit Address
            </label>
            <div className="flex items-stretch gap-0">
              <div className="flex-1 px-3 py-2.5 border border-border rounded-l-lg bg-muted/30 font-mono text-xs truncate text-foreground">
                {user.depositAddress}
              </div>
              <button
                onClick={() => copy(user.depositAddress)}
                className="px-3 border border-l-0 border-border rounded-r-lg bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCheck}
            disabled={checkDeposit.isPending}
            className="w-full"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", checkDeposit.isPending && "animate-spin")} />
            {checkDeposit.isPending ? "Scanning BSC network…" : "Check for New Deposit"}
          </Button>
        </CardContent>
      </Card>

      {/* Warning */}
      <Alert className="border-amber-200 bg-amber-50">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 text-sm font-semibold">Important</AlertTitle>
        <AlertDescription className="text-amber-700 text-xs leading-relaxed mt-1">
          Send <strong>only USDT</strong> via the <strong>BNB Smart Chain (BEP-20)</strong> network.
          Sending other tokens or using a different network results in permanent loss.
          Deposits are credited automatically after on-chain confirmation.
        </AlertDescription>
      </Alert>
    </div>
  );
}

/* ─── Withdraw tab ───────────────────────────────────────────── */
const withdrawSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Must be a positive number"),
  destinationAddress: z
    .string()
    .min(42, "Invalid BSC address")
    .max(42, "Invalid BSC address")
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 0x hex address"),
});
type WithdrawForm = z.infer<typeof withdrawSchema>;

function WithdrawTab() {
  const { data: user } = useGetMe();
  const { data: settings, isLoading } = useGetSettings();
  const createWithdrawal = useCreateWithdrawal();

  const form = useForm<WithdrawForm>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: "", destinationAddress: "" },
  });

  const watchAmount = form.watch("amount");
  const parsedAmount = parseFloat(watchAmount) || 0;

  let fee = 0;
  if (settings) {
    const flat = parseFloat(settings.withdrawFeeFlat);
    const pct = parseFloat(settings.withdrawFeePercent);
    fee = flat + parsedAmount * (pct / 100);
  }
  const netAmount = Math.max(
    0,
    settings?.withdrawFeeMode === "deduct_from_amount" ? parsedAmount - fee : parsedAmount,
  );
  const totalDeducted =
    settings?.withdrawFeeMode === "deduct_from_amount" ? parsedAmount : parsedAmount + fee;
  const balance = parseFloat(user?.walletBalance ?? "0");
  const overBalance = totalDeducted > balance && parsedAmount > 0;

  const onSubmit = (values: WithdrawForm) => {
    if (overBalance) {
      toast.error("Insufficient balance");
      return;
    }
    createWithdrawal.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast.success("Withdrawal request submitted — pending admin approval");
          form.reset();
        },
        onError: (err: any) => toast.error(err.message ?? "Failed to submit"),
      },
    );
  };

  if (isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;

  if (!settings?.withdrawalEnabled) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertTitle className="text-red-800 font-semibold text-sm">Withdrawals Disabled</AlertTitle>
        <AlertDescription className="text-red-700 text-xs mt-1">
          Withdrawals are currently disabled by the platform. Please check back later.
        </AlertDescription>
      </Alert>
    );
  }

  if (user?.withdrawalBlocked) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertTitle className="text-red-800 font-semibold text-sm">Account Restricted</AlertTitle>
        <AlertDescription className="text-red-700 text-xs mt-1">
          Withdrawals for your account have been restricted. Please contact support.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-border bg-muted/20">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Withdrawal</p>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Available</p>
            <p className="text-sm font-bold text-primary">{fmtUsdt(user?.walletBalance)} USDT</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="destinationAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Destination Address (BSC BEP-20)
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="0x…" className="font-mono text-xs" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex justify-between items-center">
                    Amount (USDT)
                    <button
                      type="button"
                      onClick={() => form.setValue("amount", user?.walletBalance ?? "0")}
                      className="text-[11px] font-semibold text-primary hover:underline normal-case tracking-normal"
                    >
                      MAX
                    </button>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder="0.0000"
                      className="font-mono"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {/* Fee breakdown */}
            <div className={cn(
              "rounded-lg border px-4 py-3 space-y-2 text-sm",
              overBalance ? "border-red-200 bg-red-50" : "border-border bg-muted/30",
            )}>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Withdrawal Amount</span>
                <span className="font-mono text-xs">{fmtUsdt(parsedAmount)} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Network Fee</span>
                <span className="font-mono text-xs text-red-500">−{fmtUsdt(fee)} USDT</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold">
                <span className="text-xs">Total Deducted</span>
                <span className={cn("font-mono text-xs", overBalance && "text-red-600")}>
                  {fmtUsdt(totalDeducted)} USDT
                </span>
              </div>
              <div className="flex justify-between text-green-700">
                <span className="text-xs">Recipient Gets</span>
                <span className="font-mono text-xs font-semibold">{fmtUsdt(netAmount)} USDT</span>
              </div>
              {overBalance && (
                <p className="text-[11px] text-red-600 font-medium">Insufficient balance</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full font-semibold"
              disabled={createWithdrawal.isPending || overBalance}
            >
              <ArrowUpRight className="w-4 h-4 mr-2" />
              {createWithdrawal.isPending ? "Submitting…" : "Submit Withdrawal Request"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

/* ─── Main Wallet page ───────────────────────────────────────── */
export default function Wallet() {
  const { data: user } = useGetMe();
  const [tab, setTab] = useState<Tab>("deposit");

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Wallet</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Deposit or withdraw USDT (BEP-20)</p>
      </div>

      {/* Balance card */}
      <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground font-medium">Total Balance</p>
          <p className="font-bold text-2xl text-primary mt-0.5">
            {fmtUsdt(user?.walletBalance)}{" "}
            <span className="text-sm font-normal text-muted-foreground">USDT</span>
          </p>
        </div>
        <Download className="w-8 h-8 text-primary/20" />
      </div>

      {/* Tab switcher */}
      <div className="flex bg-muted/40 rounded-xl p-1 gap-1">
        {(["deposit", "withdraw"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize",
              tab === t
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "deposit" ? <DepositTab /> : <WithdrawTab />}
    </div>
  );
}
