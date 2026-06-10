import { Layout } from "@/components/layout";
import { useGetMe, useCreateP2PTransfer } from "@workspace/api-client-react";
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

const p2pSchema = z.object({
  recipientIdentifier: z.string().min(1, "Recipient ID or email is required"),
  amount: z.string().min(1, "Amount is required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Must be a valid positive number"),
  note: z.string().optional(),
});

export default function P2P() {
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const createP2P = useCreateP2PTransfer();

  const form = useForm<z.infer<typeof p2pSchema>>({
    resolver: zodResolver(p2pSchema),
    defaultValues: {
      recipientIdentifier: "",
      amount: "",
      note: "",
    },
  });

  const watchAmount = form.watch("amount");
  const parsedAmount = parseFloat(watchAmount) || 0;

  const onSubmit = (values: z.infer<typeof p2pSchema>) => {
    if (user && parsedAmount > parseFloat(user.walletBalance)) {
      toast.error("Insufficient balance");
      return;
    }

    createP2P.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast.success("Transfer completed successfully");
          form.reset();
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to complete transfer");
        }
      }
    );
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-mono font-bold uppercase tracking-wider">Internal Transfer</h1>

        {isUserLoading ? (
          <Skeleton className="h-96 w-full rounded-none" />
        ) : (
          <Card className="rounded-none border-border">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex justify-between items-center">
                <CardTitle className="font-mono uppercase tracking-wider text-lg">Send USDT Instantly</CardTitle>
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
                    name="recipientIdentifier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono uppercase text-xs">Recipient ID / Email / Referral Code</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter identifier" className="font-mono rounded-none" {...field} />
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

                  <FormField
                    control={form.control}
                    name="note"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono uppercase text-xs">Note (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="What's this for?" className="font-mono rounded-none" {...field} />
                        </FormControl>
                        <FormMessage className="font-mono text-xs" />
                      </FormItem>
                    )}
                  />

                  <div className="bg-muted/10 p-4 border border-border flex justify-between font-mono text-sm">
                    <span className="text-muted-foreground">Transfer Fee:</span>
                    <span className="text-success font-bold">0.0000 USDT</span>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full rounded-none font-mono uppercase tracking-wider" 
                    disabled={createP2P.isPending || parsedAmount > parseFloat(user?.walletBalance || "0") || parsedAmount <= 0}
                  >
                    {createP2P.isPending ? "Processing..." : "Send Funds"}
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