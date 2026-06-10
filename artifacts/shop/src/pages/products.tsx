import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useListProducts, useListCategories } from "@workspace/api-client-react";
import { fmtUsdt } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Products() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [sort, setSort] = useState(searchParams.get("sort") || "newest");
  
  // Use debounced value for actual API call
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  const { data: categories } = useListCategories();
  
  const { data: productsData, isLoading } = useListProducts({
    search: debouncedSearch || undefined,
    categoryId: category !== "all" ? category : undefined,
    sort: sort as any,
    limit: 24
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(searchTerm);
  };

  return (
    <div className="container mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row gap-8">
      {/* Sidebar Filters */}
      <aside className="w-full md:w-64 flex-shrink-0 space-y-8">
        <div>
          <h3 className="font-bold uppercase tracking-wider mb-4 border-b border-border pb-2">Search</h3>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input 
              placeholder="Search products..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-none bg-card"
            />
            <Button type="submit" size="icon" className="rounded-none shrink-0">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <div>
          <h3 className="font-bold uppercase tracking-wider mb-4 border-b border-border pb-2">Categories</h3>
          <div className="space-y-2">
            <button 
              onClick={() => setCategory("all")}
              className={`w-full text-left text-sm uppercase tracking-wider py-1 hover:text-primary transition-colors ${category === "all" ? "text-primary font-bold" : "text-muted-foreground"}`}
            >
              All Categories
            </button>
            {categories?.map((cat) => (
              <button 
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`w-full text-left text-sm uppercase tracking-wider py-1 hover:text-primary transition-colors ${category === cat.id ? "text-primary font-bold" : "text-muted-foreground"}`}
              >
                {cat.name} ({cat.productCount})
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-3xl font-black uppercase tracking-wider">Catalog</h1>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[180px] rounded-none bg-card uppercase text-xs tracking-wider font-bold">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="newest" className="uppercase text-xs tracking-wider">Newest Arrivals</SelectItem>
                <SelectItem value="price_asc" className="uppercase text-xs tracking-wider">Price: Low to High</SelectItem>
                <SelectItem value="price_desc" className="uppercase text-xs tracking-wider">Price: High to Low</SelectItem>
                <SelectItem value="popular" className="uppercase text-xs tracking-wider">Most Popular</SelectItem>
                <SelectItem value="rating" className="uppercase text-xs tracking-wider">Highest Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {Array(9).fill(0).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="aspect-square rounded-none" />
                <Skeleton className="h-4 w-2/3 rounded-none" />
                <Skeleton className="h-4 w-1/2 rounded-none" />
              </div>
            ))}
          </div>
        ) : productsData?.products.length === 0 ? (
          <div className="text-center py-24 bg-card border border-border">
            <p className="text-muted-foreground uppercase tracking-wider">No products found matching your criteria.</p>
            <Button 
              variant="outline" 
              className="mt-4 rounded-none uppercase tracking-wider"
              onClick={() => {
                setSearchTerm("");
                setDebouncedSearch("");
                setCategory("all");
              }}
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {productsData?.products.map((product) => (
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
                    <div className="p-2.5 sm:p-4 flex flex-col flex-1">
                      <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest mb-0.5 sm:mb-1">
                        {product.categoryName}
                      </div>
                      <h3 className="font-bold text-sm sm:text-lg mb-1 sm:mb-2 line-clamp-2">{product.name}</h3>
                      <div className="mt-auto">
                        <div className="flex items-center gap-1 mb-1 sm:mb-2">
                          <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-primary text-primary" />
                          <span className="text-xs sm:text-sm font-bold">{product.averageRating}</span>
                          <span className="text-[10px] sm:text-xs text-muted-foreground">({product.reviewCount})</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-end sm:gap-2 gap-0.5">
                          <span className="text-sm sm:text-xl font-bold text-primary">{fmtUsdt(product.priceUsdt)} USDT</span>
                          {product.compareAtPrice && (
                            <span className="text-[10px] sm:text-sm text-muted-foreground line-through">{fmtUsdt(product.compareAtPrice)} USDT</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
