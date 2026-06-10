import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useListProducts, useListCategories } from "@workspace/api-client-react";
import { fmtUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal, Star, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Products() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);

  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [sort, setSort] = useState(searchParams.get("sort") || "newest");
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: categories } = useListCategories();

  const { data: productsData, isLoading } = useListProducts({
    search: debouncedSearch || undefined,
    categoryId: category !== "all" ? category : undefined,
    sort: sort as any,
    limit: 24,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(searchTerm);
    setSearchOpen(false);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setDebouncedSearch("");
  };

  const activeCategory = category === "all"
    ? "All"
    : categories?.find((c) => c.id === category)?.name ?? "All";

  return (
    <div className="flex flex-col md:flex-row min-h-[60vh]">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 lg:w-64 flex-shrink-0 flex-col border-r border-border bg-card px-5 py-8 gap-8">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Search</h3>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Search products…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-none bg-background text-sm h-9"
            />
            <Button type="submit" size="icon" className="rounded-none h-9 w-9 shrink-0">
              <Search className="h-4 w-4" />
            </Button>
          </form>
          {debouncedSearch && (
            <button
              onClick={clearSearch}
              className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" /> Clear search
            </button>
          )}
        </div>

        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Categories</h3>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => setCategory("all")}
              className={cn(
                "text-left text-sm py-1.5 px-2 rounded transition-colors",
                category === "all"
                  ? "text-primary font-semibold bg-primary/8"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              All Categories
            </button>
            {categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "text-left text-sm py-1.5 px-2 rounded transition-colors flex items-center justify-between",
                  category === cat.id
                    ? "text-primary font-semibold bg-primary/8"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <span>{cat.name}</span>
                <span className="text-[11px] text-muted-foreground/60">{cat.productCount}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Mobile filter bar ── */}
        <div className="md:hidden border-b border-border bg-card">
          {/* Row 1: search bar (slide-in) OR category chips + actions */}
          {searchOpen ? (
            <form
              onSubmit={handleSearch}
              className="flex items-center gap-2 px-3 py-2.5"
            >
              <Input
                autoFocus
                placeholder="Search products…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-full h-9 text-sm bg-background flex-1"
              />
              <Button type="submit" size="sm" className="rounded-full h-9 px-4 shrink-0">
                Go
              </Button>
              <button
                type="button"
                onClick={() => { setSearchOpen(false); clearSearch(); }}
                className="p-1.5 text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5">
              {/* Category chips scroll area */}
              <div className="flex-1 overflow-x-auto scrollbar-none -mx-1 px-1">
                <div className="flex gap-2 w-max">
                  <button
                    onClick={() => setCategory("all")}
                    className={cn(
                      "shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap",
                      category === "all"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary hover:text-primary"
                    )}
                  >
                    All
                  </button>
                  {categories?.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={cn(
                        "shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap",
                        category === cat.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary hover:text-primary"
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
              {/* Search + sort icons */}
              <button
                onClick={() => setSearchOpen(true)}
                className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Row 2: sort + result count */}
          <div className="flex items-center justify-between px-3 pb-2.5 gap-2">
            <span className="text-xs text-muted-foreground">
              {isLoading ? "Loading…" : `${productsData?.total ?? 0} items${activeCategory !== "All" ? ` in ${activeCategory}` : ""}`}
            </span>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-8 w-auto text-xs rounded-full border-border bg-background px-3 gap-1.5 font-semibold">
                <SlidersHorizontal className="h-3 w-3" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl">
                <SelectItem value="newest" className="text-xs">Newest</SelectItem>
                <SelectItem value="price_asc" className="text-xs">Price ↑</SelectItem>
                <SelectItem value="price_desc" className="text-xs">Price ↓</SelectItem>
                <SelectItem value="popular" className="text-xs">Popular</SelectItem>
                <SelectItem value="rating" className="text-xs">Top Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active search pill */}
          {debouncedSearch && (
            <div className="px-3 pb-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                "{debouncedSearch}"
                <button onClick={clearSearch}><X className="h-3 w-3" /></button>
              </span>
            </div>
          )}
        </div>

        {/* ── Desktop title + sort bar ── */}
        <div className="hidden md:flex items-center justify-between px-6 lg:px-8 py-6 border-b border-border">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Catalog</h1>
            {!isLoading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {productsData?.total ?? 0} products{activeCategory !== "All" ? ` · ${activeCategory}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[180px] rounded-none bg-card text-xs uppercase tracking-wider font-bold">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="newest" className="text-xs uppercase tracking-wider">Newest Arrivals</SelectItem>
                <SelectItem value="price_asc" className="text-xs uppercase tracking-wider">Price: Low to High</SelectItem>
                <SelectItem value="price_desc" className="text-xs uppercase tracking-wider">Price: High to Low</SelectItem>
                <SelectItem value="popular" className="text-xs uppercase tracking-wider">Most Popular</SelectItem>
                <SelectItem value="rating" className="text-xs uppercase tracking-wider">Highest Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Product grid ── */}
        <div className="p-3 sm:p-6 lg:p-8">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {Array(9).fill(0).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-none" />
                  <Skeleton className="h-3.5 w-2/3 rounded-none" />
                  <Skeleton className="h-3 w-1/2 rounded-none" />
                </div>
              ))}
            </div>
          ) : productsData?.products.length === 0 ? (
            <div className="text-center py-24 bg-card border border-border">
              <p className="text-muted-foreground text-sm">No products found.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 rounded-none uppercase tracking-wider text-xs"
                onClick={() => { setSearchTerm(""); setDebouncedSearch(""); setCategory("all"); }}
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
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                            No Image
                          </div>
                        )}
                        {product.compareAtPrice && (
                          <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            Sale
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 sm:p-4 flex flex-col flex-1">
                        <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest mb-0.5">
                          {product.categoryName}
                        </div>
                        <h3 className="font-bold text-sm sm:text-base mb-1 sm:mb-2 line-clamp-2 leading-snug">
                          {product.name}
                        </h3>
                        <div className="mt-auto">
                          <div className="flex items-center gap-1 mb-1">
                            <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-primary text-primary" />
                            <span className="text-xs font-bold">{product.averageRating}</span>
                            <span className="text-[10px] text-muted-foreground">({product.reviewCount})</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm sm:text-lg font-bold text-primary leading-none">
                              {fmtUsdt(product.priceUsdt)} USDT
                            </span>
                            {product.compareAtPrice && (
                              <span className="text-[10px] sm:text-xs text-muted-foreground line-through">
                                {fmtUsdt(product.compareAtPrice)} USDT
                              </span>
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
        </div>
      </div>
    </div>
  );
}
