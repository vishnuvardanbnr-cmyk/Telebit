import { Link } from "wouter";
import { 
  useGetCart, 
  useUpdateCartItem, 
  useRemoveCartItem, 
  useGetMe,
  useClearCart
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Trash2, Minus, Plus, ArrowRight } from "lucide-react";
import { fmtUsdt } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export default function Cart() {
  const queryClient = useQueryClient();
  const { data: cart, isLoading: isCartLoading } = useGetCart();
  const { data: user } = useGetMe();

  const updateItem = useUpdateCartItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      }
    }
  });

  const removeItem = useRemoveCartItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      }
    }
  });

  const clearCart = useClearCart({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      }
    }
  });

  if (isCartLoading) {
    return (
      <div className="container mx-auto px-4 md:px-8 py-8 max-w-4xl">
        <h1 className="text-3xl font-black uppercase tracking-wider mb-8">Shopping Cart</h1>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-none" />
          <Skeleton className="h-32 w-full rounded-none" />
          <Skeleton className="h-48 w-full rounded-none mt-8" />
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container mx-auto px-4 md:px-8 py-16 max-w-4xl text-center">
        <h1 className="text-3xl font-black uppercase tracking-wider mb-6">Shopping Cart</h1>
        <div className="bg-card border border-border p-12">
          <p className="text-muted-foreground uppercase tracking-wider mb-6">Your cart is currently empty.</p>
          <Link href="/products">
            <Button className="rounded-none font-bold uppercase tracking-wider">
              Browse Catalog
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const balance = Number(user?.walletBalance || "0");
  const subtotal = Number(cart.subtotal);
  const canAfford = balance >= subtotal;

  return (
    <div className="container mx-auto px-4 md:px-8 py-8 max-w-5xl">
      <div className="flex justify-between items-end mb-8">
        <h1 className="text-3xl font-black uppercase tracking-wider">Shopping Cart</h1>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => clearCart.mutate()}
          className="text-muted-foreground hover:text-destructive rounded-none uppercase tracking-wider text-xs"
        >
          Clear Cart
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {cart.items.map((item) => (
            <div key={item.id} className="flex gap-4 p-4 border border-border bg-card">
              <Link href={`/products/${item.productId}`}>
                <div className="w-24 h-24 bg-muted flex-shrink-0 cursor-pointer overflow-hidden border border-border">
                  {item.product.imageUrls?.[0] ? (
                    <img src={item.product.imageUrls[0]} alt={item.product.name} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                  ) : null}
                </div>
              </Link>
              
              <div className="flex flex-col flex-1 justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <Link href={`/products/${item.productId}`} className="hover:text-primary transition-colors">
                      <h3 className="font-bold uppercase tracking-wider text-sm">{item.product.name}</h3>
                    </Link>
                    <p className="text-muted-foreground text-xs uppercase tracking-widest mt-1">
                      {fmtUsdt(item.priceUsdt)} USDT each
                    </p>
                  </div>
                  <div className="font-bold text-primary">
                    {fmtUsdt(Number(item.priceUsdt) * item.quantity)} USDT
                  </div>
                </div>

                <div className="flex justify-between items-end">
                  <div className="flex items-center border border-border h-8 bg-background">
                    <button 
                      className="w-8 flex justify-center items-center hover:text-primary hover:bg-muted/50 h-full"
                      onClick={() => updateItem.mutate({ itemId: item.id, data: { quantity: Math.max(1, item.quantity - 1) } })}
                      disabled={updateItem.isPending}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <div className="w-8 flex justify-center items-center font-bold text-sm">
                      {item.quantity}
                    </div>
                    <button 
                      className="w-8 flex justify-center items-center hover:text-primary hover:bg-muted/50 h-full"
                      onClick={() => updateItem.mutate({ itemId: item.id, data: { quantity: Math.min(item.product.stock, item.quantity + 1) } })}
                      disabled={updateItem.isPending}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => removeItem.mutate({ itemId: item.id })}
                    className="text-muted-foreground hover:text-destructive p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border p-6 h-fit sticky top-24">
          <h2 className="text-lg font-bold uppercase tracking-wider mb-6 border-b border-border pb-4">Order Summary</h2>
          
          <div className="space-y-3 text-sm mb-6 border-b border-border pb-6">
            <div className="flex justify-between">
              <span className="text-muted-foreground uppercase tracking-wider">Subtotal ({cart.itemCount} items)</span>
              <span className="font-mono">{fmtUsdt(cart.subtotal)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground uppercase tracking-wider">Shipping</span>
              <span className="font-mono text-green-500">Free</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center mb-8">
            <span className="font-bold uppercase tracking-wider">Total</span>
            <span className="text-2xl font-black text-primary">{fmtUsdt(cart.subtotal)} <span className="text-sm">USDT</span></span>
          </div>

          <div className="space-y-4">
            <div className="bg-muted/30 p-3 border border-border/50 flex justify-between items-center text-sm">
              <span className="uppercase tracking-wider text-muted-foreground text-xs font-bold">Wallet Balance</span>
              <span className={`font-mono font-bold ${!canAfford ? 'text-destructive' : ''}`}>
                {fmtUsdt(user?.walletBalance)} USDT
              </span>
            </div>
            
            {!canAfford && (
              <div className="text-destructive text-xs uppercase tracking-wider text-center font-bold">
                Insufficient wallet balance
              </div>
            )}

            <Link href="/checkout">
              <Button 
                className="w-full rounded-none h-12 font-bold uppercase tracking-wider text-sm"
                disabled={!canAfford || cart.itemCount === 0}
              >
                Proceed to Checkout
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
