import { Link } from "wouter";
import { useGetWishlist, useListProducts, useRemoveFromWishlist } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Heart, Trash2, Star, ImageOff } from "lucide-react";
import { fmtUsdt } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

export default function Wishlist() {
  const queryClient = useQueryClient();
  const { data: wishlist, isLoading: isWishlistLoading } = useGetWishlist();
  const { data: productsData, isLoading: isProductsLoading } = useListProducts({ limit: 100 });

  const removeFromWishlist = useRemoveFromWishlist({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] }); },
    },
  });

  const isLoading = isWishlistLoading || isProductsLoading;

  const wishlistProducts = productsData?.products.filter(p =>
    wishlist?.productIds.includes(p.id)
  ) ?? [];

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <Skeleton className="h-6 w-36 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Heart className="h-5 w-5 text-primary fill-primary/20" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Wishlist</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{wishlistProducts.length} saved item{wishlistProducts.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {wishlistProducts.length === 0 ? (
        <div className="rounded-xl border border-border bg-white py-20 flex flex-col items-center gap-4 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Heart className="w-6 h-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">Your wishlist is empty.</p>
          <Link href="/products"><Button size="sm">Browse Catalog</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {wishlistProducts.map((product) => (
            <div key={product.id} className="group bg-white rounded-xl overflow-hidden shadow-sm border border-border relative flex flex-col hover:shadow-md transition-shadow">
              {/* Remove button */}
              <button
                onClick={() => removeFromWishlist.mutate({ productId: product.id })}
                className="absolute top-2 right-2 z-10 p-1.5 bg-white/90 hover:bg-destructive hover:text-white text-muted-foreground rounded-full shadow-sm border border-border/50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              <Link href={`/products/${product.id}`} className="flex flex-col flex-1">
                {/* Image */}
                <div className="aspect-square bg-muted overflow-hidden">
                  {product.imageUrls?.[0] ? (
                    <img
                      src={product.imageUrls[0]}
                      alt={product.name}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageOff className="w-6 h-6 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-2.5 flex flex-col flex-1 gap-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{product.categoryName}</p>
                  <p className="text-xs font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">{product.name}</p>
                  <div className="mt-auto pt-1.5 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      <span className="text-[11px] font-semibold">{product.averageRating}</span>
                    </div>
                    <p className="text-sm font-bold text-primary">{fmtUsdt(product.priceUsdt)} USDT</p>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
