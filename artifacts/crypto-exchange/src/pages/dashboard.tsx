import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useGetDashboard,
  useGetMe,
  useGetSettings,
  useCheckDeposit,
  useCreateWithdrawal,
  useListDeposits,
  useListWithdrawals,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { formatUsdt, truncateAddress, formatDate } from "@/lib/format";
import {
  Copy, ArrowUpRight, ArrowDownRight, Send, RefreshCw, AlertCircle,
  ArrowDownToLine, ArrowUpFromLine, ExternalLink,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Link } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

/* ─── Deposit Modal ─────────────────────────────────────────────────────────── */
function DepositModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: user, isLoading } = useGetMe();
  const checkDepositMutation = useCheckDeposit();

  const handleCopy = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.depositAddress);
    toast.success("Deposit address copied to clipboard");
  };

  const handleCheck = () => {
    checkDepositMutation.mutate(undefined, {
      onSuccess: (res) => {
        if (res.found) toast.success(`Deposit found! Credited ${res.amount} USDT.`);
        else toast.info(res.message);
      },
      onError: () => toast.error("Failed to check for deposits."),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-none p-0 gap-0 border-border">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="font-mono uppercase tracking-wider text-lg">Deposit USDT</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="p-6"><Skeleton className="h-64 w-full rounded-none" /></div>
        ) : user ? (
          <div className="p-6 space-y-5">
            {/* Network tag */}
            <div className="text-center border border-border bg-muted/20 py-2">
              <p className="font-mono text-xs font-bold text-primary uppercase tracking-wider">BNB Smart Chain (BEP-20)</p>
              <p className="font-mono text-xs text-muted-foreground mt-0.5">Send only USDT on the BSC network to this address</p>
            </div>

            {/* QR code */}
            <div className="flex justify-center">
              <div className="p-4 bg-white border border-border">
                <QRCodeSVG value={user.depositAddress} size={180} level="M" />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1">
              <label className="font-mono text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Your Deposit Address</label>
              <div className="flex items-stretch">
                <div className="flex-1 px-3 py-2.5 border border-border border-r-0 bg-background font-mono text-xs truncate flex items-center">
                  {truncateAddress(user.depositAddress)}
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-none h-auto px-3 border-border shrink-0"
                  onClick={handleCopy}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Check button */}
            <Button
              variant="outline"
              className="w-full rounded-none font-mono uppercase tracking-wider"
              onClick={handleCheck}
              disabled={checkDepositMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${checkDepositMutation.isPending ? "animate-spin" : ""}`} />
              {checkDepositMutation.isPending ? "Scanning Network…" : "Check for New Deposit"}
            </Button>

            {/* Warning */}
            <Alert className="rounded-none border-amber-300 bg-amber-50 text-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="font-mono text-xs font-bold uppercase">Important</AlertTitle>
              <AlertDescription className="font-mono text-xs mt-1 leading-relaxed">
                Send <strong>only USDT</strong> via the <strong>BNB Smart Chain (BEP-20)</strong> network.
                Sending other tokens or using a different network results in permanent loss.
                Deposits are credited automatically after on-chain confirmation.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="p-6 text-center text-destructive font-mono text-sm uppercase">Failed to load deposit information</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Withdraw Modal ────────────────────────────────────────────────────────── */
const withdrawSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Must be a valid positive number"),
  destinationAddress: z
    .string()
    .min(42, "Invalid BSC address")
    .max(42, "Invalid BSC address")
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid hex address"),
});

function WithdrawModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const { data: settings, isLoading: isSettingsLoading } = useGetSettings();
  const createWithdrawal = useCreateWithdrawal();

  const form = useForm<z.infer<typeof withdrawSchema>>({
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
  const netAmount = Math.max(0, settings?.withdrawFeeMode === "deduct_from_amount" ? parsedAmount - fee : parsedAmount);
  const totalDeducted = settings?.withdrawFeeMode === "deduct_from_amount" ? parsedAmount : parsedAmount + fee;

  const onSubmit = (values: z.infer<typeof withdrawSchema>) => {
    if (user && totalDeducted > parseFloat(user.walletBalance)) {
      toast.error("Insufficient balance for withdrawal and fees");
      return;
    }
    createWithdrawal.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast.success("Withdrawal request submitted successfully");
          form.reset();
          onClose();
        },
        onError: (err: any) => toast.error(err.message || "Failed to submit withdrawal request"),
      }
    );
  };

  const isLoading = isUserLoading || isSettingsLoading;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-none p-0 gap-0 border-border">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-start justify-between">
            <DialogTitle className="font-mono uppercase tracking-wider text-lg">New Withdrawal</DialogTitle>
            <div className="text-right">
              <div className="font-mono text-[10px] text-muted-foreground uppercase">Available</div>
              <div className="font-mono font-bold text-primary text-sm">
                {isLoading ? "—" : `${formatUsdt(user?.walletBalance)} USDT`}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6">
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-none" />
          ) : !settings?.withdrawalEnabled ? (
            <Alert className="rounded-none border-destructive bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-mono uppercase font-bold text-sm">Withdrawals Disabled</AlertTitle>
              <AlertDescription className="font-mono text-xs mt-1">
                System withdrawals are currently disabled. Please try again later.
              </AlertDescription>
            </Alert>
          ) : user?.withdrawalBlocked ? (
            <Alert className="rounded-none border-destructive bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-mono uppercase font-bold text-sm">Account Restricted</AlertTitle>
              <AlertDescription className="font-mono text-xs mt-1">
                Withdrawals for your account have been temporarily restricted. Contact support.
              </AlertDescription>
            </Alert>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="destinationAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono uppercase text-[10px] font-bold text-muted-foreground tracking-wider">
                        Destination Address (BSC BEP-20)
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="0x…" className="font-mono rounded-none text-sm" {...field} />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono uppercase text-[10px] font-bold text-muted-foreground tracking-wider flex justify-between items-center">
                        Amount (USDT)
                        <button
                          type="button"
                          className="text-primary hover:underline normal-case text-xs font-normal"
                          onClick={() => form.setValue("amount", user?.walletBalance || "0")}
                        >
                          MAX
                        </button>
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="0.0001" placeholder="0.0000" className="font-mono rounded-none text-sm" {...field} />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />

                <div className="bg-muted/10 p-3 border border-border space-y-2">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-muted-foreground">Withdrawal Amount</span>
                    <span>{formatUsdt(parsedAmount)} USDT</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-muted-foreground">Network Fee</span>
                    <span className="text-destructive">-{formatUsdt(fee)} USDT</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-mono text-xs font-bold">
                    <span>Total Deducted</span>
                    <span className={totalDeducted > parseFloat(user?.walletBalance || "0") ? "text-destructive" : ""}>
                      {formatUsdt(totalDeducted)} USDT
                    </span>
                  </div>
                  <div className="flex justify-between font-mono text-xs font-bold text-green-600">
                    <span>Recipient Gets</span>
                    <span>{formatUsdt(netAmount)} USDT</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-none font-mono uppercase tracking-wider"
                  disabled={createWithdrawal.isPending || totalDeducted > parseFloat(user?.walletBalance || "0")}
                >
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                  {createWithdrawal.isPending ? "Processing…" : "Submit Withdrawal Request"}
                </Button>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Dashboard ─────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard();
  const { data: deposits, isLoading: isDepositsLoading } = useListDeposits();
  const { data: withdrawals, isLoading: isWithdrawalsLoading } = useListWithdrawals();

  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Address copied");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-mono font-bold uppercase tracking-wider">Dashboard</h1>

        {/* ── Balance + stats ── */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-none" />)}
          </div>
        ) : dashboard ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="rounded-none border-primary/50 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Available Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-mono font-bold text-primary">
                    {formatUsdt(dashboard.walletBalance)}
                    <span className="text-xl text-primary/70 ml-2">USDT</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Total Deposited</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-mono font-bold">
                    {formatUsdt(dashboard.totalDeposited)}
                    <span className="text-sm text-muted-foreground ml-2">USDT</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Total Withdrawn</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-mono font-bold">
                    {formatUsdt(dashboard.totalWithdrawn)}
                    <span className="text-sm text-muted-foreground ml-2">USDT</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Action buttons ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Button
                size="lg"
                className="rounded-none font-mono uppercase tracking-wider gap-2"
                onClick={() => setDepositOpen(true)}
              >
                <ArrowDownToLine className="h-4 w-4" />
                Deposit
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-none font-mono uppercase tracking-wider gap-2"
                onClick={() => setWithdrawOpen(true)}
              >
                <ArrowUpFromLine className="h-4 w-4" />
                Withdraw
              </Button>
              <Button size="lg" variant="outline" className="rounded-none font-mono uppercase tracking-wider gap-2" asChild>
                <Link href="/p2p"><Send className="h-4 w-4" />P2P Transfer</Link>
              </Button>
              <Button size="lg" variant="ghost" className="rounded-none font-mono uppercase tracking-wider gap-2" asChild>
                <Link href="/history"><ArrowUpRight className="h-4 w-4" />Full History</Link>
              </Button>
            </div>

            {/* ── Transaction history ── */}
            <div className="space-y-3">
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-muted-foreground">Transaction History</h2>
              <Tabs defaultValue="deposits">
                <TabsList className="grid w-full grid-cols-2 rounded-none bg-muted/20 border border-border h-10">
                  <TabsTrigger
                    value="deposits"
                    className="font-mono text-xs uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-none h-full"
                  >
                    Deposits
                  </TabsTrigger>
                  <TabsTrigger
                    value="withdrawals"
                    className="font-mono text-xs uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-none h-full"
                  >
                    Withdrawals
                  </TabsTrigger>
                </TabsList>

                {/* Deposits tab */}
                <TabsContent value="deposits" className="mt-0">
                  <Card className="rounded-none border-border border-t-0">
                    <CardContent className="p-0">
                      {isDepositsLoading ? (
                        <div className="p-6 space-y-3">
                          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-none" />)}
                        </div>
                      ) : deposits && deposits.length > 0 ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader className="bg-muted/20">
                              <TableRow>
                                <TableHead className="font-mono uppercase text-[10px]">Date</TableHead>
                                <TableHead className="font-mono uppercase text-[10px]">Amount</TableHead>
                                <TableHead className="font-mono uppercase text-[10px]">Status</TableHead>
                                <TableHead className="font-mono uppercase text-[10px] text-right">TxHash</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {deposits.map((d) => (
                                <TableRow key={d.id} className="border-border">
                                  <TableCell className="font-mono text-xs">{formatDate(d.createdAt)}</TableCell>
                                  <TableCell className="font-mono text-xs font-bold text-green-600">
                                    +{formatUsdt(d.amount)} USDT
                                  </TableCell>
                                  <TableCell>
                                    <span className={`font-mono text-[10px] uppercase px-1.5 py-0.5 border ${
                                      d.status === "credited"
                                        ? "border-green-300 bg-green-50 text-green-700"
                                        : "border-border bg-muted/20 text-muted-foreground"
                                    }`}>
                                      {d.status}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {d.txHash ? (
                                      <a
                                        href={`https://bscscan.com/tx/${d.txHash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-primary hover:underline font-mono text-xs inline-flex items-center gap-1"
                                      >
                                        {truncateAddress(d.txHash)} <ExternalLink className="h-3 w-3" />
                                      </a>
                                    ) : (
                                      <span className="text-muted-foreground font-mono text-xs">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="py-12 text-center font-mono text-xs uppercase text-muted-foreground">
                          No deposits yet — click Deposit to get started
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Withdrawals tab */}
                <TabsContent value="withdrawals" className="mt-0">
                  <Card className="rounded-none border-border border-t-0">
                    <CardContent className="p-0">
                      {isWithdrawalsLoading ? (
                        <div className="p-6 space-y-3">
                          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-none" />)}
                        </div>
                      ) : withdrawals && withdrawals.length > 0 ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader className="bg-muted/20">
                              <TableRow>
                                <TableHead className="font-mono uppercase text-[10px]">Date</TableHead>
                                <TableHead className="font-mono uppercase text-[10px]">Amount</TableHead>
                                <TableHead className="font-mono uppercase text-[10px]">To</TableHead>
                                <TableHead className="font-mono uppercase text-[10px]">Status</TableHead>
                                <TableHead className="font-mono uppercase text-[10px] text-right">TxHash</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {withdrawals.map((w) => (
                                <TableRow key={w.id} className="border-border">
                                  <TableCell className="font-mono text-xs">{formatDate(w.createdAt)}</TableCell>
                                  <TableCell className="font-mono text-xs font-bold text-destructive">
                                    -{formatUsdt(w.amount)} USDT
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{truncateAddress(w.destinationAddress)}</TableCell>
                                  <TableCell>
                                    <span className={`font-mono text-[10px] uppercase px-1.5 py-0.5 border ${
                                      w.status === "approved"
                                        ? "border-green-300 bg-green-50 text-green-700"
                                        : w.status === "rejected"
                                        ? "border-red-300 bg-red-50 text-red-700"
                                        : "border-amber-300 bg-amber-50 text-amber-700"
                                    }`}>
                                      {w.status}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {w.txHash ? (
                                      <a
                                        href={`https://bscscan.com/tx/${w.txHash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-primary hover:underline font-mono text-xs inline-flex items-center gap-1"
                                      >
                                        {truncateAddress(w.txHash)} <ExternalLink className="h-3 w-3" />
                                      </a>
                                    ) : (
                                      <span className="text-muted-foreground font-mono text-xs">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="py-12 text-center font-mono text-xs uppercase text-muted-foreground">
                          No withdrawals yet
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* ── Deposit address quick-copy (below history) ── */}
            <Card className="rounded-none border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center justify-between">
                  Deposit Address
                  <Button
                    variant="link"
                    className="text-primary font-mono text-xs rounded-none p-0 h-auto"
                    onClick={() => setDepositOpen(true)}
                  >
                    Show QR →
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <div className="flex-1 p-2.5 border border-border bg-background font-mono text-xs truncate border-r-0">
                    {dashboard.depositAddress}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-[38px] w-[38px] rounded-none border-border shrink-0"
                    onClick={() => handleCopy(dashboard.depositAddress)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-12 text-destructive font-mono uppercase">Failed to load dashboard</div>
        )}
      </div>

      {/* ── Modals ── */}
      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </Layout>
  );
}
