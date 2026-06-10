import { Link } from "wouter";
import { useGetFeatured, useListCategories } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Star, TrendingUp, Tag, Zap, Coins, ChevronRight } from "lucide-react";
import { fmtUsdt } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function ProductGrid({ title, products, icon: Icon }: { title: string, products: any[], icon: any }) {
  if (!products || products.length === 0) return null;

  return (
    <section className="py-12">
      <div className="flex items-center gap-3 mb-8">
        <Icon className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold uppercase tracking-wider">{title}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {products.map((product) => (
          <Link key={product.id} href={`/products/${product.id}`}>
            <Card className="rounded-none border-border hover:border-primary transition-colors cursor-pointer h-full bg-card hover:bg-muted/10">
              <CardContent className="p-0 flex flex-col h-full">
                <div className="aspect-square bg-muted relative overflow-hidden">
                  {product.imageUrls?.[0] ? (
                    <img 
                      src={product.imageUrls[0]} 
                      alt={product.name} 
                      className="object-cover w-full h-full transition-transform hover:scale-105 duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      No Image
                    </div>
                  )}
                  {product.compareAtPrice && (
                    <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground px-2 py-1 text-xs font-bold uppercase tracking-wider">
                      Sale
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
                    {product.categoryName}
                  </div>
                  <h3 className="font-bold text-lg mb-2 line-clamp-2">{product.name}</h3>
                  <div className="mt-auto">
                    <div className="flex items-center gap-1 mb-2">
                      <Star className="h-4 w-4 fill-primary text-primary" />
                      <span className="text-sm font-bold">{product.averageRating}</span>
                      <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-xl font-bold text-primary">{fmtUsdt(product.priceUsdt)} USDT</span>
                      {product.compareAtPrice && (
                        <span className="text-sm text-muted-foreground line-through mb-0.5">{fmtUsdt(product.compareAtPrice)} USDT</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const { data: featuredData, isLoading: featuredLoading } = useGetFeatured();
  const { data: categories, isLoading: categoriesLoading } = useListCategories();

  return (
    <div className="container mx-auto px-4 md:px-8 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-card border border-border mb-16">
        <div className="absolute inset-0 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="relative z-20 px-8 py-24 md:py-32 md:px-16 flex flex-col items-start w-full md:w-2/3">
          <div className="inline-block px-3 py-1 mb-6 border border-primary text-primary text-xs font-bold uppercase tracking-widest bg-primary/10">
            Institutional Grade Commerce
          </div>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-6 leading-none">
            Spend Your Crypto <br /> With Confidence
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl">
            Seamlessly purchase premium goods directly from your Telebit USDT balance. Zero off-ramping, immediate settlement.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/products">
              <Button size="lg" className="rounded-none uppercase tracking-wider font-bold h-14 px-8">
                Browse Catalog
              </Button>
            </Link>
            <a href="/exchange/dashboard">
              <Button size="lg" variant="outline" className="rounded-none uppercase tracking-wider font-bold h-14 px-8 gap-2">
                <Coins className="h-5 w-5" />
                Go to Exchange ↗
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Exchange Banner */}
      <a href="/exchange/dashboard" className="block mb-16 group">
        <div className="border border-primary/30 bg-primary/5 rounded-none p-5 flex items-center justify-between hover:bg-primary/10 transition-colors cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 border border-primary/20 flex items-center justify-center rounded-none shrink-0">
              <Coins className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-bold uppercase tracking-wider text-sm">Telebit Exchange</div>
              <div className="text-xs text-muted-foreground mt-0.5">Buy V2 Tokens · Bid on NFT Pools · Manage Holdings</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs uppercase text-primary hidden sm:block font-medium">Open Exchange</span>
            <ChevronRight className="h-4 w-4 text-primary group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </a>

      {/* Categories Grid */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold uppercase tracking-wider mb-8">Shop by Category</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {categoriesLoading ? (
            Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-none" />)
          ) : (
            categories?.map((cat) => (
              <Link key={cat.id} href={`/products?category=${cat.id}`}>
                <div className="h-32 bg-card border border-border flex flex-col items-center justify-center p-4 hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer group">
                  <h3 className="font-bold uppercase tracking-wider text-center group-hover:text-primary transition-colors">{cat.name}</h3>
                  <span className="text-xs text-muted-foreground mt-2">{cat.productCount} Products</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {featuredLoading ? (
        <div className="space-y-12">
          <Skeleton className="h-64 w-full rounded-none" />
          <Skeleton className="h-64 w-full rounded-none" />
        </div>
      ) : (
        <>
          <ProductGrid title="Featured Products" products={featuredData?.featured || []} icon={Star} />
          <ProductGrid title="New Arrivals" products={featuredData?.newArrivals || []} icon={Zap} />
          <ProductGrid title="Trending Now" products={featuredData?.topRated || []} icon={TrendingUp} />
          <ProductGrid title="On Sale" products={featuredData?.onSale || []} icon={Tag} />
        </>
      )}
    </div>
  );
}
