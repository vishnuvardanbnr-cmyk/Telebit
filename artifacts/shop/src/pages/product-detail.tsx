import { useState } from "react";
import { useParams } from "wouter";
import { 
  useGetProduct, 
  useAddToCart, 
  useAddToWishlist, 
  useGetCart,
  useCreateProductReview,
  useListProductReviews,
  useGetMe
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { fmtUsdt } from "@/lib/utils";
import { Star, ShoppingCart, Heart, Minus, Plus, ShieldCheck, Truck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
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
        toast({
          title: "Added to Cart",
          description: "Product has been added to your shopping cart.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      }
    }
  });

  const addToWishlist = useAddToWishlist({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Added to Wishlist",
          description: "Product has been added to your wishlist.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
      }
    }
  });

  const submitReview = useCreateProductReview({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Review Submitted",
          description: "Thank you for your feedback.",
        });
        setReviewTitle("");
        setReviewBody("");
        queryClient.invalidateQueries({ queryKey: [`/api/products/${id}/reviews`] });
        queryClient.invalidateQueries({ queryKey: [`/api/products/${id}`] });
      }
    }
  });

  const handleAddToCart = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add items to your cart.",
        variant: "destructive"
      });
      return;
    }
    addToCart.mutate({ data: { productId: id, quantity } });
  };

  const handleAddToWishlist = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to use the wishlist.",
        variant: "destructive"
      });
      return;
    }
    addToWishlist.mutate({ productId: id });
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    submitReview.mutate({
      productId: id,
      data: { rating: reviewRating, title: reviewTitle, body: reviewBody }
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-6">
            <Skeleton className="h-10 w-3/4 rounded-none" />
            <Skeleton className="h-6 w-1/4 rounded-none" />
            <Skeleton className="h-24 w-full rounded-none" />
            <Skeleton className="h-12 w-full rounded-none" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) return <div className="text-center py-24">Product not found</div>;

  return (
    <div className="container mx-auto px-4 md:px-8 py-8">
      {/* Product Top Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24">
        {/* Images */}
        <div className="space-y-4">
          <div className="aspect-square bg-card border border-border overflow-hidden">
            {product.imageUrls?.[activeImage] ? (
              <img 
                src={product.imageUrls[activeImage]} 
                alt={product.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                No Image
              </div>
            )}
          </div>
          {product.imageUrls && product.imageUrls.length > 1 && (
            <div className="grid grid-cols-5 gap-4">
              {product.imageUrls.map((url, i) => (
                <button 
                  key={i} 
                  onClick={() => setActiveImage(i)}
                  className={`aspect-square border ${activeImage === i ? 'border-primary' : 'border-border opacity-60 hover:opacity-100'} transition-all`}
                >
                  <img src={url} alt={`${product.name} thumbnail ${i+1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <div className="text-sm text-primary uppercase tracking-widest font-bold mb-2">
            {product.categoryName}
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-wider mb-4 leading-tight">
            {product.name}
          </h1>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-1">
              <Star className="h-5 w-5 fill-primary text-primary" />
              <span className="font-bold">{product.averageRating}</span>
              <span className="text-muted-foreground text-sm">({product.reviewCount} reviews)</span>
            </div>
            <div className="text-sm font-mono px-2 py-0.5 bg-muted">
              SKU: {product.id.split('-')[0].toUpperCase()}
            </div>
          </div>

          <div className="mb-8">
            <div className="flex items-end gap-3 mb-2">
              <span className="text-4xl font-black text-primary">{fmtUsdt(product.priceUsdt)} <span className="text-2xl">USDT</span></span>
              {product.compareAtPrice && (
                <span className="text-xl text-muted-foreground line-through mb-1">{fmtUsdt(product.compareAtPrice)} USDT</span>
              )}
            </div>
            {product.stock > 0 ? (
              <div className="text-green-500 font-bold uppercase tracking-wider text-sm flex items-center gap-2 mt-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                In Stock ({product.stock} available)
              </div>
            ) : (
              <div className="text-destructive font-bold uppercase tracking-wider text-sm flex items-center gap-2 mt-2">
                <div className="w-2 h-2 rounded-full bg-destructive"></div>
                Out of Stock
              </div>
            )}
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground mb-8 border-y border-border py-6">
            {product.description}
          </div>

          {/* Actions */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-border h-12 w-32 bg-card">
                <button 
                  className="flex-1 flex justify-center items-center hover:text-primary hover:bg-muted/50 h-full"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={product.stock === 0}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex-1 flex justify-center items-center font-bold">
                  {quantity}
                </div>
                <button 
                  className="flex-1 flex justify-center items-center hover:text-primary hover:bg-muted/50 h-full"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={product.stock === 0}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              
              <Button 
                onClick={handleAddToCart} 
                disabled={product.stock === 0 || addToCart.isPending}
                className="flex-1 rounded-none h-12 text-base font-bold uppercase tracking-wider"
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                {addToCart.isPending ? "Adding..." : "Add to Cart"}
              </Button>
            </div>
            
            <Button 
              variant="outline" 
              onClick={handleAddToWishlist}
              disabled={addToWishlist.isPending}
              className="w-full rounded-none h-12 text-base font-bold uppercase tracking-wider border-border hover:bg-muted/10"
            >
              <Heart className="mr-2 h-5 w-5" />
              Add to Wishlist
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-auto">
            <div className="flex items-center gap-3 text-sm text-muted-foreground bg-card p-3 border border-border">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <div>
                <div className="font-bold text-foreground uppercase tracking-wider text-xs">Secure Payment</div>
                <div className="text-xs">Pay with USDT balance</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground bg-card p-3 border border-border">
              <Truck className="h-6 w-6 text-primary" />
              <div>
                <div className="font-bold text-foreground uppercase tracking-wider text-xs">Global Shipping</div>
                <div className="text-xs">Tracked delivery</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="border-t border-border pt-16">
        <h2 className="text-2xl font-black uppercase tracking-wider mb-8">Customer Reviews</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Write a Review */}
          {user ? (
            <div className="bg-card border border-border p-6 h-fit">
              <h3 className="text-lg font-bold uppercase tracking-wider mb-4">Write a Review</h3>
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button 
                        key={star} 
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="focus:outline-none"
                      >
                        <Star className={`h-6 w-6 ${reviewRating >= star ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Title</label>
                  <Input 
                    value={reviewTitle} 
                    onChange={(e) => setReviewTitle(e.target.value)} 
                    placeholder="Summary of your review"
                    className="rounded-none bg-background"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Review</label>
                  <Textarea 
                    value={reviewBody} 
                    onChange={(e) => setReviewBody(e.target.value)} 
                    placeholder="Tell others what you think about this product"
                    className="rounded-none bg-background min-h-[120px]"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={submitReview.isPending}
                  className="w-full rounded-none font-bold uppercase tracking-wider"
                >
                  {submitReview.isPending ? "Submitting..." : "Submit Review"}
                </Button>
              </form>
            </div>
          ) : (
            <div className="bg-card border border-border p-6 flex flex-col items-center justify-center text-center h-48">
              <p className="text-muted-foreground mb-4 uppercase tracking-wider font-bold">Sign in to write a review</p>
              <Button onClick={() => window.location.href='/sign-in'} className="rounded-none font-bold uppercase tracking-wider">
                Sign In
              </Button>
            </div>
          )}

          {/* Review List */}
          <div className="lg:col-span-2 space-y-6">
            {!reviews || reviews.length === 0 ? (
              <div className="text-muted-foreground">No reviews yet. Be the first to review this product!</div>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="border-b border-border pb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={`h-4 w-4 ${review.rating >= star ? 'fill-primary text-primary' : 'text-muted-foreground opacity-30'}`} />
                      ))}
                    </div>
                    <span className="font-bold text-sm ml-2">{review.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
                    <span className="font-bold">{review.userFullName || 'Anonymous User'}</span>
                    <span>•</span>
                    <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
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
