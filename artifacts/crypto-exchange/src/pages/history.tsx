import { Layout } from "@/components/layout";
import { useListDeposits, useListWithdrawals, useListP2PTransfers } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUsdt, truncateAddress, formatDate } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink } from "lucide-react";

export default function History() {
  const { data: deposits, isLoading: isDepositsLoading } = useListDeposits();
  const { data: withdrawals, isLoading: isWithdrawalsLoading } = useListWithdrawals();
  const { data: p2p, isLoading: isP2PLoading } = useListP2PTransfers();

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-mono font-bold uppercase tracking-wider">Transaction History</h1>

        <Tabs defaultValue="deposits" className="w-full">
          <TabsList className="grid w-full grid-cols-3 rounded-none bg-muted/20 border border-border h-12">
            <TabsTrigger value="deposits" className="font-mono uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-none h-full">Deposits</TabsTrigger>
            <TabsTrigger value="withdrawals" className="font-mono uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-none h-full">Withdrawals</TabsTrigger>
            <TabsTrigger value="p2p" className="font-mono uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-none h-full">P2P</TabsTrigger>
          </TabsList>

          <TabsContent value="deposits" className="mt-4">
            <Card className="rounded-none border-border">
              <CardContent className="p-0">
                {isDepositsLoading ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : deposits && deposits.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="font-mono uppercase text-xs">Date</TableHead>
                        <TableHead className="font-mono uppercase text-xs">Amount</TableHead>
                        <TableHead className="font-mono uppercase text-xs">Net</TableHead>
                        <TableHead className="font-mono uppercase text-xs">Status</TableHead>
                        <TableHead className="font-mono uppercase text-xs text-right">TxHash</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deposits.map((d) => (
                        <TableRow key={d.id} className="border-border">
                          <TableCell className="font-mono text-sm">{formatDate(d.createdAt)}</TableCell>
                          <TableCell className="font-mono text-sm font-bold text-success">+{formatUsdt(d.amount)}</TableCell>
                          <TableCell className="font-mono text-sm">{formatUsdt(d.netAmount)}</TableCell>
                          <TableCell className="font-mono text-xs uppercase">{d.status}</TableCell>
                          <TableCell className="text-right">
                            {d.txHash ? (
                              <a href={`https://bscscan.com/tx/${d.txHash}`} target="_blank" rel="noreferrer" className="text-primary hover:underline font-mono text-sm inline-flex items-center gap-1">
                                {truncateAddress(d.txHash)} <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-12 text-center text-muted-foreground font-mono uppercase text-sm">No deposits found</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals" className="mt-4">
            <Card className="rounded-none border-border">
              <CardContent className="p-0">
                {isWithdrawalsLoading ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : withdrawals && withdrawals.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="font-mono uppercase text-xs">Date</TableHead>
                        <TableHead className="font-mono uppercase text-xs">Amount</TableHead>
                        <TableHead className="font-mono uppercase text-xs">Fee</TableHead>
                        <TableHead className="font-mono uppercase text-xs">Destination</TableHead>
                        <TableHead className="font-mono uppercase text-xs">Status</TableHead>
                        <TableHead className="font-mono uppercase text-xs text-right">TxHash</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.map((w) => (
                        <TableRow key={w.id} className="border-border">
                          <TableCell className="font-mono text-sm">{formatDate(w.createdAt)}</TableCell>
                          <TableCell className="font-mono text-sm font-bold text-destructive">-{formatUsdt(w.amount)}</TableCell>
                          <TableCell className="font-mono text-sm">{formatUsdt(w.fee)}</TableCell>
                          <TableCell className="font-mono text-sm">{truncateAddress(w.destinationAddress)}</TableCell>
                          <TableCell className="font-mono text-xs uppercase">{w.status}</TableCell>
                          <TableCell className="text-right">
                            {w.txHash ? (
                              <a href={`https://bscscan.com/tx/${w.txHash}`} target="_blank" rel="noreferrer" className="text-primary hover:underline font-mono text-sm inline-flex items-center gap-1">
                                {truncateAddress(w.txHash)} <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-12 text-center text-muted-foreground font-mono uppercase text-sm">No withdrawals found</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="p2p" className="mt-4">
            <Card className="rounded-none border-border">
              <CardContent className="p-0">
                {isP2PLoading ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : p2p && p2p.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="font-mono uppercase text-xs">Date</TableHead>
                        <TableHead className="font-mono uppercase text-xs">Amount</TableHead>
                        <TableHead className="font-mono uppercase text-xs">From/To</TableHead>
                        <TableHead className="font-mono uppercase text-xs">Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p2p.map((p) => {
                        // We would ideally know if we are sender or receiver to show +/-
                        // Assuming simple list for now
                        return (
                          <TableRow key={p.id} className="border-border">
                            <TableCell className="font-mono text-sm">{formatDate(p.createdAt)}</TableCell>
                            <TableCell className="font-mono text-sm font-bold text-primary">{formatUsdt(p.amount)}</TableCell>
                            <TableCell className="font-mono text-sm truncate max-w-[200px]">
                              {p.senderEmail} &rarr; {p.receiverEmail}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{p.note || "-"}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-12 text-center text-muted-foreground font-mono uppercase text-sm">No P2P transfers found</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}