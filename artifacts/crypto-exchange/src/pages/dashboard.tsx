import { Layout } from "@/components/layout";
import { useGetDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUsdt, truncateAddress, formatDate } from "@/lib/format";
import { Copy, ArrowUpRight, ArrowDownRight, Send } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard();

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied to clipboard`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-mono font-bold uppercase tracking-wider">Dashboard</h1>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-none" />
            ))}
          </div>
        ) : dashboard ? (
          <>
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="rounded-none border-primary/50 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Available Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-mono font-bold text-primary">
                    {formatUsdt(dashboard.walletBalance)} <span className="text-xl text-primary/70">USDT</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Total Deposited</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-mono font-bold">
                    {formatUsdt(dashboard.totalDeposited)} <span className="text-sm text-muted-foreground">USDT</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Total Withdrawn</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-mono font-bold">
                    {formatUsdt(dashboard.totalWithdrawn)} <span className="text-sm text-muted-foreground">USDT</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="rounded-none border-border md:col-span-2 flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg font-mono uppercase tracking-wider flex items-center justify-between">
                    Recent Activity
                    <Button variant="link" className="text-primary font-mono text-xs rounded-none p-0 h-auto" asChild>
                      <Link href="/history">View All</Link>
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto">
                  <div className="space-y-4">
                    {dashboard.recentDeposits.length === 0 && dashboard.recentWithdrawals.length === 0 && dashboard.recentP2P.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground font-mono text-sm uppercase">No recent activity</div>
                    ) : null}

                    {/* Simple merged list for demo, ideally we'd sort these by date */}
                    {dashboard.recentDeposits.map((d) => (
                      <div key={`dep-${d.id}`} className="flex items-center justify-between p-3 border border-border bg-background">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-success/10 text-success"><ArrowDownRight className="h-4 w-4" /></div>
                          <div>
                            <div className="font-mono text-sm font-bold">Deposit</div>
                            <div className="font-mono text-xs text-muted-foreground">{formatDate(d.createdAt)}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-bold text-success">+{formatUsdt(d.amount)} USDT</div>
                          <div className="font-mono text-xs text-muted-foreground uppercase">{d.status}</div>
                        </div>
                      </div>
                    ))}
                    {dashboard.recentWithdrawals.map((w) => (
                      <div key={`wit-${w.id}`} className="flex items-center justify-between p-3 border border-border bg-background">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-destructive/10 text-destructive"><ArrowUpRight className="h-4 w-4" /></div>
                          <div>
                            <div className="font-mono text-sm font-bold">Withdrawal</div>
                            <div className="font-mono text-xs text-muted-foreground">{formatDate(w.createdAt)}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-bold text-destructive">-{formatUsdt(w.amount)} USDT</div>
                          <div className="font-mono text-xs text-muted-foreground uppercase">{w.status}</div>
                        </div>
                      </div>
                    ))}
                    {dashboard.recentP2P.map((p) => (
                      <div key={`p2p-${p.id}`} className="flex items-center justify-between p-3 border border-border bg-background">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 text-primary"><Send className="h-4 w-4" /></div>
                          <div>
                            <div className="font-mono text-sm font-bold">P2P Transfer</div>
                            <div className="font-mono text-xs text-muted-foreground">{formatDate(p.createdAt)}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-bold text-primary">{formatUsdt(p.amount)} USDT</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-mono uppercase tracking-wider">Quick Deposit</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  <div className="p-4 bg-white rounded-none mb-4 w-48 h-48 flex items-center justify-center">
                    <QRCodeSVG value={dashboard.depositAddress} size={160} level="H" includeMargin={false} />
                  </div>
                  <div className="w-full space-y-2 text-center">
                    <div className="text-xs font-mono text-muted-foreground uppercase">BEP-20 (BSC) Address</div>
                    <div className="flex items-center justify-between p-2 border border-border bg-background">
                      <span className="font-mono text-xs truncate mr-2">{truncateAddress(dashboard.depositAddress)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none shrink-0" onClick={() => handleCopy(dashboard.depositAddress, "Address")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Button className="w-full mt-6 rounded-none font-mono uppercase tracking-wider" asChild>
                    <Link href="/deposit">Deposit Details</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-destructive font-mono uppercase">Failed to load dashboard</div>
        )}
      </div>
    </Layout>
  );
}