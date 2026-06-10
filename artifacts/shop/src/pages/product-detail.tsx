import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetProduct, useAddToCart, useAddToWishlist,
  useCreateProductReview, useListProductReviews, useGetMe,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Star, ShoppingCart, Heart, Minus, Plus, ShieldCheck, Truck,
  ImageOff, ArrowLeft, Package,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe({ query: { retry: false, queryKey: ["/api/users/me"] } });
  const { data: product, isLoading } = useGetProduct(id);
  const { data: reviews } = useListProductReviews(id);

  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");

  const addToCart = useAddToCart({
    mutation: {
      onSuccess: () => {
        toast.success("Added to cart");
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      },
    },
  });

  const addToWishlist = useAddToWishlist({
    mutation: {
      onSuccess: () => {
        toast.success("Saved to wishlist");
        queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
      },
    },
  });

  const submitReview = useCreateProductReview({
    mutation: {
      onSuccess: () => {
        toast.success("Review submitted — thank you!");
        setReviewTitle(""); setReviewBody("");
        queryClient.invalidateQueries({ queryKey: [`/api/products/${id}/reviews`] });
        queryClient.invalidateQueries({ queryKey: [`/api/products/${id}`] });
      },
    },
  });

  const handleAddToCart = () => {
    if (!user) { toast.error("Sign in to add items to cart"); return; }
    addToCart.mutate({ data: { productId: id, quantity } });
  };

  const handleAddToWishlist = () => {
    if (!user) { toast.error("Sign in to use the wishlist"); return; }
    addToWishlist.mutate({ productId: id });
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    submitReview.mutate({ productId: id, data: { rating: reviewRating, title: reviewTitle, body: reviewBody } });
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-7 w-3/4 rounded-lg" />
            <Skeleton className="h-5 w-1/3 rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) return <div className="text-center py-24 text-muted-foreground">Product not found</div>;

  const inStock = product.stock > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-10">
      {/* Back */}
      <Link href="/products">
        <button className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to catalog
        </button>
      </Link>

      {/* Product main */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Images */}
        <div className="space-y-3">
          <div className="aspect-square rounded-xl overflow-hidden bg-muted border border-border">
            {product.imageUrls?.[activeImage] ? (
              <img src={product.imageUrls[activeImage]} alt={product.name} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageOff className="w-10 h-10 text-muted-foreground/30" />
              </div>
            )}
          </div>
          {product.imageUrls && product.imageUrls.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {product.imageUrls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    "aspect-square rounded-lg overflow-hidden border-2 transition-all",
                    activeImage === i ? "border-primary" : "border-border opacity-60 hover:opacity-100",
                  )}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">{product.categoryName}</p>
            <h1 className="text-2xl font-bold leading-tight">{product.name}</h1>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className={cn("w-4 h-4", Number(product.averageRating) >= s ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
              ))}
            </div>
            <span className="text-sm font-semibold">{product.averageRating}</span>
            <span className="text-xs text-muted-foreground">({product.reviewCount} reviews)</span>
          </div>

          {/* Price */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">{fmtUsdt(product.priceUsdt)}</span>
              <span className="text-lg text-muted-foreground font-medium">USDT</span>
              {product.compareAtPrice && (
                <span className="text-sm text-muted-foreground line-through">{fmtUsdt(product.compareAtPrice)} USDT</span>
              )}
            </div>
            <div className={cn("flex items-center gap-1.5 mt-1.5 text-xs font-semibold", inStock ? "text-green-600" : "text-destructive")}>
              <div className={cn("w-1.5 h-1.5 rounded-full", inStock ? "bg-green-500" : "bg-destructive")} />
              {inStock ? `In stock (${product.stock})` : "Out of stock"}
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed border-y border-border py-4">{product.description}</p>

          {/* Actions */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {/* Qty */}
              <div className="flex items-center border border-border rounded-lg overflow-hidden h-11 bg-background">
                <button
                  className="w-10 flex justify-center items-center hover:bg-muted/50 h-full text-muted-foreground transition-colors"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={!inStock}
                ><Minus className="h-4 w-4" /></button>
                <div className="w-10 flex justify-center items-center font-semibold">{quantity}</div>
                <button
                  className="w-10 flex justify-center items-center hover:bg-muted/50 h-full text-muted-foreground transition-colors"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={!inStock}
                ><Plus className="h-4 w-4" /></button>
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={!inStock || addToCart.isPending}
                className="flex-1 h-11 font-semibold"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {addToCart.isPending ? "Adding…" : "Add to Cart"}
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={handleAddToWishlist}
              disabled={addToWishlist.isPending}
              className="w-full h-11 font-semibold"
            >
              <Heart className="mr-2 h-4 w-4" />
              Save to Wishlist
            </Button>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-2 gap-3 mt-1">
            {[
              { icon: ShieldCheck, title: "Secure Payment", sub: "Pay with USDT balance" },
              { icon: Truck, title: "Global Shipping", sub: "Fully tracked delivery" },
            ].map(({ icon: Icon, title, sub }) => (
              <div key={title} className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/20 p-3">
                <Icon className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-semibold">{title}</p>
                  <p className="text-[11px] text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="border-t border-border pt-8 space-y-6">
        <h2 className="text-lg font-bold tracking-tight">Customer Reviews</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Write review */}
          {!user ? (
            <Card className="rounded-xl shadow-sm flex flex-col items-center justify-center text-center p-8 gap-3">
              <Package className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground font-medium">Sign in to write a review</p>
              <Link href="/sign-in"><Button size="sm">Sign In</Button></Link>
            </Card>
          ) : product?.userHasReviewed ? (
            <Card className="rounded-xl shadow-sm flex flex-col items-center justify-center text-center p-8 gap-3">
              <Star className="w-8 h-8 fill-amber-400 text-amber-400" />
              <p className="text-sm font-semibold">Review submitted</p>
              <p className="text-xs text-muted-foreground">You've already reviewed this product. Thank you!</p>
            </Card>
          ) : !product?.userHasPurchased ? (
            <Card className="rounded-xl shadow-sm flex flex-col items-center justify-center text-center p-8 gap-3">
              <ShoppingCart className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm font-semibold">Purchase required</p>
              <p className="text-xs text-muted-foreground">Only customers who have bought this product can leave a review.</p>
            </Card>
          ) : (
            <Card className="rounded-xl shadow-sm h-fit">
              <CardHeader className="pb-3 border-b border-border bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Write a Review</p>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleReviewSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Rating</label>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(star => (
                        <button key={star} type="button" onClick={() => setReviewRating(star)}>
                          <Star className={cn("h-6 w-6 transition-colors", reviewRating >= star ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Title</label>
                    <Input value={reviewTitle} onChange={e => setReviewTitle(e.target.value)} placeholder="Summary" required />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Review</label>
                    <Textarea
                      value={reviewBody}
                      onChange={e => setReviewBody(e.target.value)}
                      placeholder="Share your experience…"
                      className="min-h-[100px]"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={submitReview.isPending} className="w-full font-semibold">
                    {submitReview.isPending ? "Submitting…" : "Submit Review"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Review list */}
          <div className="lg:col-span-2 space-y-4">
            {!reviews || reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reviews yet. Be the first!</p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-border bg-white shadow-sm p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={cn("w-3.5 h-3.5", review.rating >= s ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20")} />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-semibold">{review.title}</p>
                  <p className="text-xs text-muted-foreground">{review.userFullName ?? "Anonymous"}</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{review.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
