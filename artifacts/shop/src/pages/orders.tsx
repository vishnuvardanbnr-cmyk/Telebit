import { Link } from "wouter";
import { useListOrders } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ArrowRight, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  delivered: "bg-green-100 text-green-700",
  shipped:   "bg-blue-100 text-blue-700",
  confirmed: "bg-primary/10 text-primary",
  cancelled: "bg-red-100 text-red-600",
  pending:   "bg-amber-100 text-amber-700",
};

export default function Orders() {
  const { data: orders, isLoading } = useListOrders();

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Package className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Order History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track and review your past orders.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : !orders || orders.length === 0 ? (
        <div className="rounded-xl border border-border bg-white py-20 flex flex-col items-center gap-4 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">No orders yet.</p>
          <Link href="/products"><Button size="sm">Browse Catalog</Button></Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden divide-y divide-border">
          {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-accent/40 transition-colors cursor-pointer group">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold font-mono">#{order.id.split("-")[0].toUpperCase()}</p>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                      STATUS_STYLES[order.status] ?? STATUS_STYLES.pending,
                    )}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-primary">{fmtUsdt(order.totalUsdt)} USDT</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
