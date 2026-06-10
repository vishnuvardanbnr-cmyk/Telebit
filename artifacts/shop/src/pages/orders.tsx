import { Link } from "wouter";
import { useListOrders } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, ArrowRight } from "lucide-react";
import { fmtUsdt } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function Orders() {
  const { data: orders, isLoading } = useListOrders();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'shipped': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'confirmed': return 'bg-primary/10 text-primary border-primary/20';
      case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="container mx-auto px-4 md:px-8 py-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-8">
        <Package className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-black uppercase tracking-wider">Order History</h1>
      </div>

      <div className="bg-card border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="font-bold uppercase tracking-wider text-xs">Order ID</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Date</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Status</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell><Skeleton className="h-4 w-24 rounded-none" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32 rounded-none" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-none" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 rounded-none ml-auto" /></TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))
            ) : !orders || orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground uppercase tracking-wider">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id} className="border-border group">
                  <TableCell className="font-mono text-sm">{order.id.split('-')[0].toUpperCase()}</TableCell>
                  <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`rounded-none uppercase tracking-widest text-[10px] ${getStatusColor(order.status)}`}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-primary">{fmtUsdt(order.totalUsdt)} USDT</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/orders/${order.id}`}>
                      <button className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center text-xs uppercase tracking-wider font-bold">
                        View <ArrowRight className="ml-1 h-3 w-3" />
                      </button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
