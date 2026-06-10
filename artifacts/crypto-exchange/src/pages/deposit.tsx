import { Layout } from "@/components/layout";
import { useGetMe, useCheckDeposit } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw, AlertCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Deposit() {
  const { data: user, isLoading } = useGetMe();
  const checkDepositMutation = useCheckDeposit();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Deposit address copied to clipboard");
  };

  const handleCheckDeposit = () => {
    checkDepositMutation.mutate(undefined, {
      onSuccess: (res) => {
        if (res.found) {
          toast.success(`Deposit found! Credited ${res.amount} USDT.`);
        } else {
          toast.info(res.message);
        }
      },
      onError: () => {
        toast.error("Failed to check for deposits.");
      }
    });
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-mono font-bold uppercase tracking-wider">Deposit USDT</h1>

        {isLoading ? (
          <Skeleton className="h-96 w-full rounded-none" />
        ) : user ? (
          <Card className="rounded-none border-border">
            <CardHeader className="text-center border-b border-border pb-6 bg-muted/20">
              <CardTitle className="font-mono text-primary text-xl uppercase tracking-wider">BSC Network (BEP-20)</CardTitle>
              <CardDescription className="font-mono mt-2">
                Send only USDT to this address over the BNB Smart Chain.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8 flex flex-col items-center">
              <div className="p-4 bg-white rounded-none mb-6">
                <QRCodeSVG value={user.depositAddress} size={200} level="M" />
              </div>

              <div className="w-full max-w-md space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase font-bold">Your unique deposit address</label>
                <div className="flex items-center">
                  <div className="flex-1 p-3 border border-border bg-background font-mono text-sm truncate border-r-0">
                    {user.depositAddress}
                  </div>
                  <Button 
                    className="rounded-none h-[46px] px-4 font-mono uppercase tracking-wider border border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => handleCopy(user.depositAddress)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </div>

              <Alert className="mt-8 rounded-none border-primary/50 bg-primary/5 text-primary">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-mono uppercase font-bold">Important</AlertTitle>
                <AlertDescription className="font-mono text-xs mt-2 leading-relaxed text-foreground">
                  • Send only USDT via the BNB Smart Chain (BEP-20) network.<br/>
                  • Sending any other coin or using a different network will result in permanent loss.<br/>
                  • Deposits are automatically credited after network confirmation.<br/>
                  • Minimum deposit amounts may apply based on platform settings.
                </AlertDescription>
              </Alert>

              <div className="w-full mt-8 pt-6 border-t border-border flex justify-center">
                <Button 
                  variant="outline" 
                  className="rounded-none font-mono uppercase tracking-wider" 
                  onClick={handleCheckDeposit}
                  disabled={checkDepositMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${checkDepositMutation.isPending ? 'animate-spin' : ''}`} />
                  {checkDepositMutation.isPending ? 'Scanning Network...' : 'Check for Deposit'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-12 text-destructive font-mono uppercase">Failed to load deposit information</div>
        )}
      </div>
    </Layout>
  );
}