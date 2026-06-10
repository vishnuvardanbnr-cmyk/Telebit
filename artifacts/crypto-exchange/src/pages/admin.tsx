import { Layout } from "@/components/layout";
import { useGetMe, useAdminGetStats, useAdminListUsers, useAdminListDeposits, useAdminListWithdrawals, useAdminGetSettings, useAdminUpdateSettings, useAdminToggleUserBlock, useAdminApproveWithdrawal, useAdminRejectWithdrawal } from "@workspace/api-client-react";
import { Redirect } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUsdt, truncateAddress, formatDate } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL;

function SetWebhookButton() {
  const [loading, setLoading] = useState(false);

  const handleSetWebhook = async () => {
    setLoading(true);
    try {
      const webhookUrl = `${window.location.origin}${BASE}api/auth/bot-webhook`;
      const res = await fetch(`${BASE}api/auth/bot-webhook/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ webhookUrl }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to set webhook");
      toast.success("Bot webhook registered successfully");
    } catch (e: any) {
      toast.error(e.message || "Failed to register webhook");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleSetWebhook}
      disabled={loading}
      className="rounded-none font-mono uppercase text-xs tracking-wider"
    >
      {loading ? "Registering…" : "Register Webhook"}
    </Button>
  );
}

const settingsSchema = z.object({
  minDepositUsdt: z.string().optional(),
  depositFeeFlat: z.string().optional(),
  depositFeePercent: z.string().optional(),
  withdrawFeeFlat: z.string().optional(),
  withdrawFeePercent: z.string().optional(),
  withdrawFeeMode: z.enum(["deduct_from_amount", "deduct_from_balance"]).optional(),
  withdrawalMode: z.enum(["auto", "manual"]).optional(),
  withdrawalEnabled: z.boolean().optional(),
  adminMasterWallet: z.string().optional(),
  telegramBotToken: z.string().optional(),
  telegramBotUsername: z.string().optional(),
});

function SettingsTab() {
  const { data: settings, isLoading } = useAdminGetSettings();
  const updateSettings = useAdminUpdateSettings();
  
  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
  });

  const initializedRef = useRef(false);

  useEffect(() => {
    if (settings && !initializedRef.current) {
      form.reset({
        minDepositUsdt: settings.minDepositUsdt,
        depositFeeFlat: settings.depositFeeFlat,
        depositFeePercent: settings.depositFeePercent,
        withdrawFeeFlat: settings.withdrawFeeFlat,
        withdrawFeePercent: settings.withdrawFeePercent,
        withdrawFeeMode: settings.withdrawFeeMode as any,
        withdrawalMode: settings.withdrawalMode as any,
        withdrawalEnabled: settings.withdrawalEnabled,
        adminMasterWallet: settings.adminMasterWallet,
        telegramBotToken: settings.telegramBotToken ?? "",
        telegramBotUsername: settings.telegramBotUsername ?? "",
      });
      initializedRef.current = true;
    }
  }, [settings, form]);

  const onSubmit = (data: z.infer<typeof settingsSchema>) => {
    updateSettings.mutate({ data }, {
      onSuccess: () => {
        toast.success("Settings updated");
      },
      onError: (err) => {
        toast.error("Failed to update settings");
      }
    });
  };

  if (isLoading) return <Skeleton className="h-96 w-full rounded-none" />;

  return (
    <Card className="rounded-none border-border">
      <CardHeader className="border-b border-border bg-muted/20">
        <CardTitle className="font-mono uppercase tracking-wider text-lg">Platform Configuration</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="minDepositUsdt" render={({ field }) => (
                <FormItem><FormLabel className="font-mono uppercase text-xs">Min Deposit (USDT)</FormLabel>
                <FormControl><Input className="rounded-none font-mono" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="adminMasterWallet" render={({ field }) => (
                <FormItem><FormLabel className="font-mono uppercase text-xs">Master Wallet Address</FormLabel>
                <FormControl><Input className="rounded-none font-mono" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="withdrawFeeFlat" render={({ field }) => (
                <FormItem><FormLabel className="font-mono uppercase text-xs">Withdraw Fee (Flat)</FormLabel>
                <FormControl><Input className="rounded-none font-mono" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="withdrawFeePercent" render={({ field }) => (
                <FormItem><FormLabel className="font-mono uppercase text-xs">Withdraw Fee (%)</FormLabel>
                <FormControl><Input className="rounded-none font-mono" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <FormField control={form.control} name="withdrawFeeMode" render={({ field }) => (
                <FormItem><FormLabel className="font-mono uppercase text-xs">Fee Mode</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="rounded-none font-mono"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="deduct_from_amount">Deduct from amount</SelectItem>
                      <SelectItem value="deduct_from_balance">Deduct from balance</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="withdrawalMode" render={({ field }) => (
                <FormItem><FormLabel className="font-mono uppercase text-xs">Processing Mode</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="rounded-none font-mono"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="auto">Automatic</SelectItem>
                      <SelectItem value="manual">Manual Approval</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="withdrawalEnabled" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-none border border-border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-mono uppercase">Enable Withdrawals</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />

            {/* Telegram Configuration */}
            <div className="border border-border rounded-none p-4 space-y-4">
              <h3 className="font-mono uppercase text-xs tracking-widest text-muted-foreground font-semibold">Telegram Login</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="telegramBotUsername" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono uppercase text-xs">Bot Username</FormLabel>
                    <FormControl><Input className="rounded-none font-mono" placeholder="MyExchangeBot" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="telegramBotToken" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono uppercase text-xs">Bot Token</FormLabel>
                    <FormControl><Input className="rounded-none font-mono" type="password" placeholder="123456:ABC-DEF…" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="bg-muted/30 border border-border rounded-none p-3 space-y-2">
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground font-semibold">Bot Webhook</p>
                <p className="text-xs text-muted-foreground">
                  After saving the bot token above, register the webhook so the bot can receive phone contact messages from users.
                </p>
                <SetWebhookButton />
              </div>
              <p className="text-xs text-muted-foreground">
                Create a bot via @BotFather on Telegram. Set the bot username (without @) and the HTTP API token here to enable Phone OTP login. Users must start the bot and share their phone number once before they can log in.
              </p>
            </div>

            <Button type="submit" className="rounded-none font-mono uppercase tracking-wider" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function UsersTab() {
  const { data: users, refetch } = useAdminListUsers();
  const toggleBlock = useAdminToggleUserBlock();

  const handleToggle = (userId: string, currentBlocked: boolean) => {
    toggleBlock.mutate({ userId, data: { blocked: !currentBlocked } }, {
      onSuccess: () => refetch()
    });
  };

  return (
    <Card className="rounded-none border-border">
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/20">
            <TableRow>
              <TableHead className="font-mono uppercase text-xs">User</TableHead>
              <TableHead className="font-mono uppercase text-xs">Balance</TableHead>
              <TableHead className="font-mono uppercase text-xs">Deposit Addr</TableHead>
              <TableHead className="font-mono uppercase text-xs">Status</TableHead>
              <TableHead className="font-mono uppercase text-xs text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((u) => (
              <TableRow key={u.id} className="border-border">
                <TableCell className="font-mono text-sm">
                  <div>{u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.id}</div>
                </TableCell>
                <TableCell className="font-mono text-sm">{formatUsdt(u.walletBalance)}</TableCell>
                <TableCell className="font-mono text-xs">{truncateAddress(u.depositAddress)}</TableCell>
                <TableCell className="font-mono text-xs uppercase">
                  {u.withdrawalBlocked ? <span className="text-destructive">Blocked</span> : <span className="text-success">Active</span>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs" onClick={() => handleToggle(u.id, u.withdrawalBlocked)}>
                    {u.withdrawalBlocked ? "Unblock" : "Block"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function WithdrawalsTab() {
  const { data: withdrawals, refetch } = useAdminListWithdrawals();
  const approve = useAdminApproveWithdrawal();
  const reject = useAdminRejectWithdrawal();

  const handleAction = (id: string, action: 'approve'|'reject') => {
    const mutation = action === 'approve' ? approve : reject;
    mutation.mutate({ id }, { onSuccess: () => refetch() });
  };

  return (
    <Card className="rounded-none border-border">
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/20">
            <TableRow>
              <TableHead className="font-mono uppercase text-xs">Date</TableHead>
              <TableHead className="font-mono uppercase text-xs">User ID</TableHead>
              <TableHead className="font-mono uppercase text-xs">Amount</TableHead>
              <TableHead className="font-mono uppercase text-xs">Dest</TableHead>
              <TableHead className="font-mono uppercase text-xs">Status</TableHead>
              <TableHead className="font-mono uppercase text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {withdrawals?.map((w) => (
              <TableRow key={w.id} className="border-border">
                <TableCell className="font-mono text-sm">{formatDate(w.createdAt)}</TableCell>
                <TableCell className="font-mono text-xs truncate max-w-[100px]">{w.userId}</TableCell>
                <TableCell className="font-mono text-sm font-bold">{formatUsdt(w.amount)}</TableCell>
                <TableCell className="font-mono text-xs">{truncateAddress(w.destinationAddress)}</TableCell>
                <TableCell className="font-mono text-xs uppercase">{w.status}</TableCell>
                <TableCell className="text-right">
                  {w.status === 'pending' && (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" className="bg-success text-success-foreground rounded-none font-mono uppercase text-xs" onClick={() => handleAction(w.id, 'approve')}>Approve</Button>
                      <Button size="sm" variant="destructive" className="rounded-none font-mono uppercase text-xs" onClick={() => handleAction(w.id, 'reject')}>Reject</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const { data: user, isLoading } = useGetMe();
  const { data: stats } = useAdminGetStats();

  if (isLoading) return null;
  if (!user?.isAdmin) return <Redirect to="/dashboard" />;

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-mono font-bold uppercase tracking-wider text-destructive">Admin Terminal</h1>

        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="rounded-none border-border"><CardContent className="p-4"><div className="text-xs font-mono text-muted-foreground uppercase">Total Users</div><div className="text-xl font-mono font-bold">{stats.totalUsers}</div></CardContent></Card>
            <Card className="rounded-none border-border"><CardContent className="p-4"><div className="text-xs font-mono text-muted-foreground uppercase">Total Deposited</div><div className="text-xl font-mono font-bold text-success">{formatUsdt(stats.totalDeposited)}</div></CardContent></Card>
            <Card className="rounded-none border-border"><CardContent className="p-4"><div className="text-xs font-mono text-muted-foreground uppercase">Total Withdrawn</div><div className="text-xl font-mono font-bold text-destructive">{formatUsdt(stats.totalWithdrawn)}</div></CardContent></Card>
            <Card className="rounded-none border-border"><CardContent className="p-4"><div className="text-xs font-mono text-muted-foreground uppercase">Pending Withdrawals</div><div className="text-xl font-mono font-bold text-primary">{formatUsdt(stats.pendingWithdrawals)}</div></CardContent></Card>
          </div>
        )}

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-3 rounded-none bg-muted/20 border border-border h-12">
            <TabsTrigger value="users" className="font-mono uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-none h-full">Users</TabsTrigger>
            <TabsTrigger value="withdrawals" className="font-mono uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-none h-full">Withdrawals</TabsTrigger>
            <TabsTrigger value="settings" className="font-mono uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-none h-full">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
          <TabsContent value="withdrawals" className="mt-4"><WithdrawalsTab /></TabsContent>
          <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}