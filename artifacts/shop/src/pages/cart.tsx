import { Link } from "wouter";
import {
  useGetCart, useUpdateCartItem, useRemoveCartItem, useGetMe, useClearCart,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Minus, Plus, ArrowRight, ShoppingCart, ImageOff } from "lucide-react";
import { fmtUsdt } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export default function Cart() {
  const queryClient = useQueryClient();
  const { data: cart, isLoading } = useGetCart();
  const { data: user } = useGetMe();

  const inv = { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cart"] }); } };
  const updateItem = useUpdateCartItem({ mutation: inv });
  const removeItem = useRemoveCartItem({ mutation: inv });
  const clearCart = useClearCart({ mutation: inv });

  const balance = Number(user?.walletBalance ?? 0);
  const subtotal = Number(cart?.subtotal ?? 0);
  const canAfford = balance >= subtotal;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-6 w-36 rounded-lg" />
        {[1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <ShoppingCart className="w-7 h-7 text-muted-foreground/40" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Your cart is empty</h1>
        <p className="text-sm text-muted-foreground">Add items from the catalog to get started.</p>
        <Link href="/products"><Button className="mt-2">Browse Catalog</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Shopping Cart</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{cart.itemCount} item{cart.itemCount !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => clearCart.mutate()} className="text-xs text-muted-foreground hover:text-destructive transition-colors font-medium">
          Clear all
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {cart.items.map((item) => (
            <div key={item.id} className="flex gap-3 p-3 rounded-xl border border-border bg-white shadow-sm">
              <Link href={`/products/${item.productId}`}>
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0 cursor-pointer">
                  {item.product.imageUrls?.[0] ? (
                    <img src={item.product.imageUrls[0]} alt={item.product.name} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-5 h-5 text-muted-foreground/30" /></div>
                  )}
                </div>
              </Link>

              <div className="flex flex-col flex-1 justify-between min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <Link href={`/products/${item.productId}`}>
                      <p className="text-sm font-semibold leading-snug line-clamp-2 hover:text-primary transition-colors">{item.product.name}</p>
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtUsdt(item.priceUsdt)} USDT each</p>
                  </div>
                  <p className="text-sm font-bold text-primary shrink-0">{fmtUsdt(Number(item.priceUsdt) * item.quantity)} USDT</p>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center border border-border rounded-lg overflow-hidden h-8 bg-background">
                    <button
                      className="w-8 flex justify-center items-center hover:bg-muted/50 h-full text-muted-foreground transition-colors"
                      onClick={() => updateItem.mutate({ itemId: item.id, data: { quantity: Math.max(1, item.quantity - 1) } })}
                    ><Minus className="h-3 w-3" /></button>
                    <div className="w-8 flex justify-center items-center font-semibold text-sm">{item.quantity}</div>
                    <button
                      className="w-8 flex justify-center items-center hover:bg-muted/50 h-full text-muted-foreground transition-colors"
                      onClick={() => updateItem.mutate({ itemId: item.id, data: { quantity: Math.min(item.product.stock, item.quantity + 1) } })}
                    ><Plus className="h-3 w-3" /></button>
                  </div>
                  <button
                    onClick={() => removeItem.mutate({ itemId: item.id })}
                    className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                  ><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="rounded-xl border border-border bg-white shadow-sm p-5 h-fit sticky top-20 space-y-4">
          <p className="text-sm font-semibold">Order Summary</p>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal ({cart.itemCount} items)</span>
              <span className="font-mono font-medium">{fmtUsdt(cart.subtotal)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-medium text-green-600">Free</span>
            </div>
          </div>

          <div className="border-t border-border pt-3 flex justify-between items-baseline">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold text-primary">{fmtUsdt(cart.subtotal)} <span className="text-xs font-normal text-muted-foreground">USDT</span></span>
          </div>

          <div className="rounded-lg bg-muted/40 px-3 py-2.5 flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-medium">Wallet Balance</span>
            <span className={`font-semibold font-mono ${!canAfford && subtotal > 0 ? "text-destructive" : ""}`}>
              {fmtUsdt(user?.walletBalance)} USDT
            </span>
          </div>

          {!canAfford && subtotal > 0 && (
            <p className="text-xs text-destructive font-medium text-center">Insufficient wallet balance</p>
          )}

          <Link href="/checkout">
            <Button className="w-full font-semibold" disabled={!canAfford || cart.itemCount === 0}>
              Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
