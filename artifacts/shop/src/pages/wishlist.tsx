import { Link } from "wouter";
import { useGetWishlist, useListProducts, useRemoveFromWishlist } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Trash2, Star } from "lucide-react";
import { fmtUsdt } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

export default function Wishlist() {
  const queryClient = useQueryClient();
  const { data: wishlist, isLoading: isWishlistLoading } = useGetWishlist();
  
  // We need to fetch the actual product details for the wishlist items
  // Passing multiple IDs to the search isn't explicitly supported by the API types,
  // but usually we would fetch them. Here we'll just fetch all and filter client-side 
  // since the list is likely small, or ideally the API would support it.
  // For this mockup, we'll fetch all products and filter.
  const { data: productsData, isLoading: isProductsLoading } = useListProducts({ limit: 100 });

  const removeFromWishlist = useRemoveFromWishlist({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
      }
    }
  });

  const isLoading = isWishlistLoading || isProductsLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 md:px-8 py-8">
        <h1 className="text-3xl font-black uppercase tracking-wider mb-8">My Wishlist</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full rounded-none" />
          ))}
        </div>
      </div>
    );
  }

  const wishlistProducts = productsData?.products.filter(p => 
    wishlist?.productIds.includes(p.id)
  ) || [];

  return (
    <div className="container mx-auto px-4 md:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Heart className="h-8 w-8 text-primary fill-primary/20" />
        <h1 className="text-3xl font-black uppercase tracking-wider">My Wishlist</h1>
      </div>

      {!wishlist?.productIds.length || wishlistProducts.length === 0 ? (
        <div className="text-center py-24 bg-card border border-border">
          <p className="text-muted-foreground uppercase tracking-wider mb-6">Your wishlist is empty.</p>
          <Link href="/products">
            <Button className="rounded-none font-bold uppercase tracking-wider">
              Browse Catalog
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {wishlistProducts.map((product) => (
            <Card key={product.id} className="rounded-none border-border group bg-card relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  removeFromWishlist.mutate({ productId: product.id });
                }}
                className="absolute top-2 right-2 z-10 p-2 bg-background/80 hover:bg-destructive hover:text-destructive-foreground transition-colors border border-border"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <Link href={`/products/${product.id}`}>
                <CardContent className="p-0 flex flex-col h-full cursor-pointer">
                  <div className="aspect-square bg-muted relative overflow-hidden border-b border-border">
                    {product.imageUrls?.[0] ? (
                      <img 
                        src={product.imageUrls[0]} 
                        alt={product.name} 
                        className="object-cover w-full h-full transition-transform group-hover:scale-105 duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold mb-2 line-clamp-2 group-hover:text-primary transition-colors">{product.name}</h3>
                    <div className="mt-auto">
                      <div className="flex items-center gap-1 mb-2">
                        <Star className="h-3 w-3 fill-primary text-primary" />
                        <span className="text-xs font-bold">{product.averageRating}</span>
                      </div>
                      <span className="text-lg font-bold text-primary">{fmtUsdt(product.priceUsdt)} USDT</span>
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
