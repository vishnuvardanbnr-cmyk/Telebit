import { Layout } from "@/components/layout";
import { useGetMe, useGetSettings, useCreateWithdrawal } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { formatUsdt } from "@/lib/format";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const withdrawSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Must be a valid positive number"),
  destinationAddress: z.string().min(42, "Invalid BSC address").max(42, "Invalid BSC address").regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid hex address"),
});

export default function Withdraw() {
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const { data: settings, isLoading: isSettingsLoading } = useGetSettings();
  const createWithdrawal = useCreateWithdrawal();

  const form = useForm<z.infer<typeof withdrawSchema>>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: {
      amount: "",
      destinationAddress: "",
    },
  });

  const watchAmount = form.watch("amount");
  const parsedAmount = parseFloat(watchAmount) || 0;
  
  let fee = 0;
  if (settings) {
    const flatFee = parseFloat(settings.withdrawFeeFlat);
    const percentFee = parseFloat(settings.withdrawFeePercent);
    fee = flatFee + (parsedAmount * (percentFee / 100));
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
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to submit withdrawal request");
        }
      }
    );
  };

  const isLoading = isUserLoading || isSettingsLoading;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-mono font-bold uppercase tracking-wider">Withdraw USDT</h1>

        {isLoading ? (
          <Skeleton className="h-96 w-full rounded-none" />
        ) : !settings?.withdrawalEnabled ? (
          <Alert className="rounded-none border-destructive bg-destructive/10 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-mono uppercase font-bold">Withdrawals Disabled</AlertTitle>
            <AlertDescription className="font-mono text-sm mt-2">
              System withdrawals are currently disabled by the administrator. Please try again later.
            </AlertDescription>
          </Alert>
        ) : user?.withdrawalBlocked ? (
          <Alert className="rounded-none border-destructive bg-destructive/10 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-mono uppercase font-bold">Account Restricted</AlertTitle>
            <AlertDescription className="font-mono text-sm mt-2">
              Withdrawals for your account have been temporarily restricted. Please contact support.
            </AlertDescription>
          </Alert>
        ) : (
          <Card className="rounded-none border-border">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex justify-between items-center">
                <CardTitle className="font-mono uppercase tracking-wider text-lg">New Withdrawal</CardTitle>
                <div className="text-right">
                  <div className="text-xs font-mono text-muted-foreground uppercase">Available Balance</div>
                  <div className="font-mono font-bold text-primary">{formatUsdt(user?.walletBalance)} USDT</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="destinationAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono uppercase text-xs">Destination Address (BSC BEP-20)</FormLabel>
                        <FormControl>
                          <Input placeholder="0x..." className="font-mono rounded-none" {...field} />
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
                        <FormLabel className="font-mono uppercase text-xs flex justify-between">
                          Amount (USDT)
                          <button 
                            type="button" 
                            className="text-primary hover:underline"
                            onClick={() => form.setValue("amount", user?.walletBalance || "0")}
                          >
                            MAX
                          </button>
                        </FormLabel>
                        <FormControl>
                          <Input type="number" step="0.0001" placeholder="0.00" className="font-mono rounded-none" {...field} />
                        </FormControl>
                        <FormMessage className="font-mono text-xs" />
                      </FormItem>
                    )}
                  />

                  <div className="bg-muted/10 p-4 border border-border space-y-3">
                    <div className="flex justify-between font-mono text-sm">
                      <span className="text-muted-foreground">Withdrawal Amount:</span>
                      <span>{formatUsdt(parsedAmount)} USDT</span>
                    </div>
                    <div className="flex justify-between font-mono text-sm">
                      <span className="text-muted-foreground">Network Fee:</span>
                      <span className="text-destructive">-{formatUsdt(fee)} USDT</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between font-mono font-bold">
                      <span>Total Deducted:</span>
                      <span className={totalDeducted > parseFloat(user?.walletBalance || "0") ? "text-destructive" : ""}>
                        {formatUsdt(totalDeducted)} USDT
                      </span>
                    </div>
                    <div className="flex justify-between font-mono font-bold text-success">
                      <span>Recipient Gets:</span>
                      <span>{formatUsdt(netAmount)} USDT</span>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full rounded-none font-mono uppercase tracking-wider" 
                    disabled={createWithdrawal.isPending || totalDeducted > parseFloat(user?.walletBalance || "0")}
                  >
                    {createWithdrawal.isPending ? "Processing..." : "Submit Withdrawal"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}