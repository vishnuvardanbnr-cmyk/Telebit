import { useParams, Link } from "wouter";
import { useGetOrder } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Package, Truck, CheckCircle2, Clock, XCircle, ArrowLeft, ImageOff, MapPin,
} from "lucide-react";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  delivered: "bg-green-100 text-green-700",
  shipped:   "bg-blue-100 text-blue-700",
  confirmed: "bg-primary/10 text-primary",
  cancelled: "bg-red-100 text-red-600",
  pending:   "bg-amber-100 text-amber-700",
};

function StatusIcon({ status }: { status: string }) {
  const cls = "w-4 h-4";
  if (status === "delivered") return <CheckCircle2 className={cn(cls, "text-green-600")} />;
  if (status === "shipped")   return <Truck        className={cn(cls, "text-blue-600")} />;
  if (status === "confirmed") return <Package      className={cn(cls, "text-primary")} />;
  if (status === "cancelled") return <XCircle      className={cn(cls, "text-red-500")} />;
  return <Clock className={cn(cls, "text-amber-500")} />;
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading } = useGetOrder(id);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-5 w-32 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!order) return <div className="text-center py-24 text-muted-foreground">Order not found</div>;

  const addr = order.shippingAddress;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Back */}
      <Link href="/orders">
        <button className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to orders
        </button>
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Order <span className="font-mono text-primary">#{order.id.split("-")[0].toUpperCase()}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(order.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <div className={cn(
          "inline-flex items-center gap-1.5 text-xs font-bold uppercase px-3 py-1.5 rounded-full self-start sm:self-auto",
          STATUS_STYLES[order.status] ?? STATUS_STYLES.pending,
        )}>
          <StatusIcon status={order.status} />
          {order.status}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Items */}
        <Card className="md:col-span-2 rounded-xl shadow-sm">
          <CardHeader className="pb-3 border-b border-border bg-muted/20">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items Ordered</p>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                  {item.productImageUrl ? (
                    <img src={item.productImageUrl} alt={item.productName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-4 h-4 text-muted-foreground/30" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/products/${item.productId}`}>
                    <p className="text-sm font-semibold truncate hover:text-primary transition-colors">{item.productName}</p>
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">Qty {item.quantity} × {fmtUsdt(item.priceUsdt)} USDT</p>
                </div>
                <p className="text-sm font-bold text-primary shrink-0">{fmtUsdt(item.subtotal)} USDT</p>
              </div>
            ))}

            <div className="border-t border-border pt-3 flex justify-between items-center font-semibold">
              <span className="text-sm">Total</span>
              <span className="text-primary">{fmtUsdt(order.totalUsdt)} USDT</span>
            </div>
          </CardContent>
        </Card>

        {/* Shipping */}
        <div className="space-y-4">
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3 border-b border-border bg-muted/20">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ship To</p>
              </div>
            </CardHeader>
            <CardContent className="pt-4 text-sm space-y-0.5">
              <p className="font-semibold">{addr.fullName}</p>
              <p className="text-muted-foreground text-xs">{addr.addressLine1}</p>
              {addr.addressLine2 && <p className="text-muted-foreground text-xs">{addr.addressLine2}</p>}
              <p className="text-muted-foreground text-xs">{addr.city}{addr.state ? `, ${addr.state}` : ""} {addr.postalCode}</p>
              <p className="text-muted-foreground text-xs">{addr.country}</p>
              {addr.phone && <p className="text-muted-foreground text-xs pt-1">{addr.phone}</p>}
            </CardContent>
          </Card>

          {order.trackingNumber && (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Tracking Number</p>
                <p className="font-mono text-sm text-primary font-bold">{order.trackingNumber}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
