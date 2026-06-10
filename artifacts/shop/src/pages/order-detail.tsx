import { useParams, Link } from "wouter";
import { useGetOrder } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Truck, CheckCircle2, Clock, XCircle, ArrowLeft } from "lucide-react";
import { fmtUsdt } from "@/lib/utils";

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading } = useGetOrder(id);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 md:px-8 py-8 max-w-4xl">
        <Skeleton className="h-8 w-64 rounded-none mb-8" />
        <Skeleton className="h-64 w-full rounded-none mb-8" />
        <Skeleton className="h-64 w-full rounded-none" />
      </div>
    );
  }

  if (!order) return <div className="text-center py-24">Order not found</div>;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'shipped': return <Truck className="h-5 w-5 text-blue-500" />;
      case 'confirmed': return <Package className="h-5 w-5 text-primary" />;
      case 'cancelled': return <XCircle className="h-5 w-5 text-destructive" />;
      default: return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

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
    <div className="container mx-auto px-4 md:px-8 py-8 max-w-4xl">
      <Link href="/orders">
        <button className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center text-xs uppercase tracking-wider font-bold mb-6">
          <ArrowLeft className="mr-1 h-3 w-3" /> Back to Orders
        </button>
      </Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-wider flex items-center gap-3">
            Order <span className="text-primary font-mono text-xl">#{order.id.split('-')[0].toUpperCase()}</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Placed on {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge variant="outline" className={`rounded-none px-3 py-1 uppercase tracking-widest text-xs flex items-center gap-2 ${getStatusColor(order.status)}`}>
          {getStatusIcon(order.status)}
          {order.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border border-border p-6">
            <h2 className="text-lg font-bold uppercase tracking-wider mb-4 pb-2 border-b border-border">Items</h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4 items-center">
                  <div className="w-16 h-16 bg-muted border border-border flex-shrink-0">
                    {item.productImageUrl ? (
                      <img src={item.productImageUrl} alt={item.productName} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1">
                    <Link href={`/products/${item.productId}`} className="hover:text-primary transition-colors font-bold text-sm uppercase tracking-wider block">
                      {item.productName}
                    </Link>
                    <div className="text-xs text-muted-foreground">Qty: {item.quantity} × {fmtUsdt(item.priceUsdt)} USDT</div>
                  </div>
                  <div className="font-mono font-bold text-primary">
                    {fmtUsdt(item.subtotal)} USDT
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t border-border flex justify-between items-center">
              <span className="font-bold uppercase tracking-wider">Total</span>
              <span className="text-2xl font-black text-primary">{fmtUsdt(order.totalUsdt)} USDT</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border p-6">
            <h2 className="text-lg font-bold uppercase tracking-wider mb-4 pb-2 border-b border-border">Shipping Info</h2>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="font-bold text-foreground">{order.shippingAddress.fullName}</p>
              <p>{order.shippingAddress.addressLine1}</p>
              {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
              <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
              <p>{order.shippingAddress.country}</p>
              {order.shippingAddress.phone && <p className="pt-2">{order.shippingAddress.phone}</p>}
            </div>

            {order.trackingNumber && (
              <div className="mt-6 pt-4 border-t border-border">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Tracking Number</h3>
                <p className="font-mono text-primary font-bold">{order.trackingNumber}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
