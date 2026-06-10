import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable, shopCategories, shopProducts, shopCartItems, shopOrders, shopOrderItems, shopReviews, shopWishlist } from "@workspace/db";
import { eq, desc, asc, and, ilike, gte, lte, sql, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

// ─── Helper: serialize product ─────────────────────────────────────────────

function serializeProduct(p: any, categoryName?: string | null) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    priceUsdt: String(p.priceUsdt),
    compareAtPrice: p.compareAtPrice != null ? String(p.compareAtPrice) : null,
    stock: p.stock,
    categoryId: p.categoryId,
    categoryName: categoryName ?? p.categoryName ?? null,
    imageUrls: p.imageUrls ?? [],
    tags: p.tags ?? [],
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    averageRating: String(p.averageRating ?? "0"),
    reviewCount: p.reviewCount ?? 0,
    createdAt: p.createdAt,
  };
}

function serializeOrder(order: any, items: any[]) {
  return {
    id: order.id,
    userId: order.userId,
    status: order.status,
    totalUsdt: String(order.totalUsdt),
    shippingAddress: order.shippingAddress,
    trackingNumber: order.trackingNumber ?? null,
    items: items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      productImageUrl: i.productImageUrl ?? null,
      quantity: i.quantity,
      priceUsdt: String(i.priceUsdt),
      subtotal: String(i.subtotal),
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

// ─── Build cart response ─────────────────────────────────────────────────────

async function buildCart(userId: string) {
  const items = await db
    .select({
      id: shopCartItems.id,
      productId: shopCartItems.productId,
      quantity: shopCartItems.quantity,
      priceUsdt: shopCartItems.priceUsdt,
      product: shopProducts,
      categoryName: shopCategories.name,
    })
    .from(shopCartItems)
    .innerJoin(shopProducts, eq(shopCartItems.productId, shopProducts.id))
    .leftJoin(shopCategories, eq(shopProducts.categoryId, shopCategories.id))
    .where(eq(shopCartItems.userId, userId))
    .orderBy(desc(shopCartItems.createdAt));

  let subtotal = 0;
  let itemCount = 0;
  const serializedItems = items.map((i) => {
    const qty = i.quantity;
    const price = parseFloat(String(i.priceUsdt));
    subtotal += price * qty;
    itemCount += qty;
    return {
      id: i.id,
      productId: i.productId,
      quantity: qty,
      priceUsdt: String(i.priceUsdt),
      product: serializeProduct(i.product, i.categoryName),
    };
  });

  return {
    items: serializedItems,
    subtotal: subtotal.toFixed(6),
    itemCount,
  };
}

// ─── Categories ──────────────────────────────────────────────────────────────

router.get("/shop/categories", async (req, res): Promise<void> => {
  const cats = await db
    .select()
    .from(shopCategories)
    .orderBy(asc(shopCategories.name));

  res.json(
    cats.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? null,
      imageUrl: c.imageUrl ?? null,
      productCount: c.productCount,
    }))
  );
});

// ─── Products ────────────────────────────────────────────────────────────────

router.get("/shop/products", async (req, res): Promise<void> => {
  const { categoryId, search, minPrice, maxPrice, sort = "newest" } = req.query as any;
  const limit = Math.min(Number(req.query.limit) || 24, 100);
  const offset = Number(req.query.offset) || 0;

  const conditions: any[] = [eq(shopProducts.isActive, true)];
  if (categoryId) conditions.push(eq(shopProducts.categoryId, categoryId));
  if (search) conditions.push(ilike(shopProducts.name, `%${search}%`));
  if (minPrice) conditions.push(gte(shopProducts.priceUsdt, minPrice));
  if (maxPrice) conditions.push(lte(shopProducts.priceUsdt, maxPrice));

  const orderBy =
    sort === "price_asc" ? asc(shopProducts.priceUsdt)
    : sort === "price_desc" ? desc(shopProducts.priceUsdt)
    : sort === "popular" ? desc(shopProducts.salesCount)
    : sort === "rating" ? desc(shopProducts.averageRating)
    : desc(shopProducts.createdAt);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shopProducts)
    .where(and(...conditions));

  const rows = await db
    .select({ product: shopProducts, categoryName: shopCategories.name })
    .from(shopProducts)
    .leftJoin(shopCategories, eq(shopProducts.categoryId, shopCategories.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  res.json({
    products: rows.map((r) => serializeProduct(r.product, r.categoryName)),
    total: count,
    limit,
    offset,
  });
});

router.get("/shop/products/:productId", async (req, res): Promise<void> => {
  const { productId } = req.params;

  const [row] = await db
    .select({ product: shopProducts, categoryName: shopCategories.name })
    .from(shopProducts)
    .leftJoin(shopCategories, eq(shopProducts.categoryId, shopCategories.id))
    .where(eq(shopProducts.id, productId));

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const reviews = await db
    .select({
      id: shopReviews.id,
      productId: shopReviews.productId,
      userId: shopReviews.userId,
      userFullName: usersTable.fullName,
      rating: shopReviews.rating,
      title: shopReviews.title,
      body: shopReviews.body,
      createdAt: shopReviews.createdAt,
    })
    .from(shopReviews)
    .leftJoin(usersTable, eq(shopReviews.userId, usersTable.id))
    .where(eq(shopReviews.productId, productId))
    .orderBy(desc(shopReviews.createdAt))
    .limit(20);

  // Optional auth: check if the requesting user has purchased / already reviewed
  let userHasPurchased = false;
  let userHasReviewed = false;
  const clerkId = getAuth(req)?.userId;
  if (clerkId) {
    const [dbUser] = await db.select({ id: usersTable.id })
      .from(usersTable).where(eq(usersTable.clerkId, clerkId));
    if (dbUser) {
      const [purchased] = await db
        .select({ id: shopOrderItems.id })
        .from(shopOrderItems)
        .innerJoin(shopOrders, eq(shopOrderItems.orderId, shopOrders.id))
        .where(and(
          eq(shopOrders.userId, dbUser.id),
          eq(shopOrderItems.productId, productId),
          sql`${shopOrders.status} != 'cancelled'`,
        ))
        .limit(1);
      userHasPurchased = !!purchased;

      const [reviewed] = await db
        .select({ id: shopReviews.id })
        .from(shopReviews)
        .where(and(eq(shopReviews.userId, dbUser.id), eq(shopReviews.productId, productId)))
        .limit(1);
      userHasReviewed = !!reviewed;
    }
  }

  res.json({
    ...serializeProduct(row.product, row.categoryName),
    userHasPurchased,
    userHasReviewed,
    reviews: reviews.map((r) => ({
      id: r.id,
      productId: r.productId,
      userId: r.userId,
      userFullName: r.userFullName ?? null,
      rating: r.rating,
      title: r.title ?? null,
      body: r.body ?? null,
      createdAt: r.createdAt,
    })),
  });
});

// ─── Featured ────────────────────────────────────────────────────────────────

router.get("/shop/featured", async (req, res): Promise<void> => {
  const base = db
    .select({ product: shopProducts, categoryName: shopCategories.name })
    .from(shopProducts)
    .leftJoin(shopCategories, eq(shopProducts.categoryId, shopCategories.id));

  const [featured, newArrivals, topRated, onSale] = await Promise.all([
    base.where(and(eq(shopProducts.isActive, true), eq(shopProducts.isFeatured, true)))
      .orderBy(desc(shopProducts.createdAt)).limit(8),
    base.where(eq(shopProducts.isActive, true))
      .orderBy(desc(shopProducts.createdAt)).limit(8),
    base.where(eq(shopProducts.isActive, true))
      .orderBy(desc(shopProducts.averageRating)).limit(8),
    db.select({ product: shopProducts, categoryName: shopCategories.name })
      .from(shopProducts)
      .leftJoin(shopCategories, eq(shopProducts.categoryId, shopCategories.id))
      .where(and(eq(shopProducts.isActive, true), sql`${shopProducts.compareAtPrice} IS NOT NULL`))
      .orderBy(desc(shopProducts.createdAt)).limit(8),
  ]);

  res.json({
    featured: featured.map((r) => serializeProduct(r.product, r.categoryName)),
    newArrivals: newArrivals.map((r) => serializeProduct(r.product, r.categoryName)),
    topRated: topRated.map((r) => serializeProduct(r.product, r.categoryName)),
    onSale: onSale.map((r) => serializeProduct(r.product, r.categoryName)),
  });
});

// ─── Reviews ─────────────────────────────────────────────────────────────────

router.get("/shop/products/:productId/reviews", async (req, res): Promise<void> => {
  const { productId } = req.params;

  const reviews = await db
    .select({
      id: shopReviews.id,
      productId: shopReviews.productId,
      userId: shopReviews.userId,
      userFullName: usersTable.fullName,
      rating: shopReviews.rating,
      title: shopReviews.title,
      body: shopReviews.body,
      createdAt: shopReviews.createdAt,
    })
    .from(shopReviews)
    .leftJoin(usersTable, eq(shopReviews.userId, usersTable.id))
    .where(eq(shopReviews.productId, productId))
    .orderBy(desc(shopReviews.createdAt));

  res.json(
    reviews.map((r) => ({
      id: r.id,
      productId: r.productId,
      userId: r.userId,
      userFullName: r.userFullName ?? null,
      rating: r.rating,
      title: r.title ?? null,
      body: r.body ?? null,
      createdAt: r.createdAt,
    }))
  );
});

router.post("/shop/products/:productId/reviews", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const productId = req.params.productId as string;
  const { rating, title, body } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be 1–5" });
    return;
  }

  const [product] = await db.select().from(shopProducts).where(eq(shopProducts.id, productId));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Only allow reviews from users who have purchased the product
  const [purchased] = await db
    .select({ id: shopOrderItems.id })
    .from(shopOrderItems)
    .innerJoin(shopOrders, eq(shopOrderItems.orderId, shopOrders.id))
    .where(and(
      eq(shopOrders.userId, user.id),
      eq(shopOrderItems.productId, productId),
      sql`${shopOrders.status} != 'cancelled'`,
    ))
    .limit(1);

  if (!purchased) {
    res.status(403).json({ error: "You must purchase this product before leaving a review." });
    return;
  }

  // Prevent duplicate reviews
  const [existing] = await db
    .select({ id: shopReviews.id })
    .from(shopReviews)
    .where(and(eq(shopReviews.userId, user.id), eq(shopReviews.productId, productId)))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "You have already reviewed this product." });
    return;
  }

  const [review] = await db.insert(shopReviews).values({
    productId,
    userId: user.id,
    rating,
    title: title ?? null,
    body: body ?? null,
  }).returning();

  // Update product rating
  const [{ avg, cnt }] = await db
    .select({
      avg: sql<string>`AVG(${shopReviews.rating})::text`,
      cnt: sql<number>`COUNT(*)::int`,
    })
    .from(shopReviews)
    .where(eq(shopReviews.productId, productId));

  await db.update(shopProducts)
    .set({ averageRating: avg ?? "0", reviewCount: cnt })
    .where(eq(shopProducts.id, productId));

  res.status(201).json({
    id: review.id,
    productId: review.productId,
    userId: review.userId,
    userFullName: user.fullName ?? null,
    rating: review.rating,
    title: review.title ?? null,
    body: review.body ?? null,
    createdAt: review.createdAt,
  });
});

// ─── Cart ────────────────────────────────────────────────────────────────────

router.get("/shop/cart", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  res.json(await buildCart(user.id));
});

router.post("/shop/cart/items", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const { productId, quantity } = req.body;

  if (!productId || !quantity || quantity < 1) {
    res.status(400).json({ error: "productId and quantity (>=1) required" });
    return;
  }

  const [product] = await db.select().from(shopProducts).where(
    and(eq(shopProducts.id, productId), eq(shopProducts.isActive, true))
  );
  if (!product) {
    res.status(400).json({ error: "Product not found or not available" });
    return;
  }
  if (product.stock < quantity) {
    res.status(400).json({ error: `Only ${product.stock} in stock` });
    return;
  }

  // Upsert cart item
  const [existing] = await db.select().from(shopCartItems).where(
    and(eq(shopCartItems.userId, user.id), eq(shopCartItems.productId, productId))
  );

  if (existing) {
    await db.update(shopCartItems)
      .set({ quantity: existing.quantity + quantity, updatedAt: new Date() })
      .where(eq(shopCartItems.id, existing.id));
  } else {
    await db.insert(shopCartItems).values({
      userId: user.id,
      productId,
      quantity,
      priceUsdt: product.priceUsdt,
    });
  }

  res.json(await buildCart(user.id));
});

router.patch("/shop/cart/items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const itemId = req.params.itemId as string;
  const { quantity } = req.body;

  const [item] = await db.select().from(shopCartItems).where(
    and(eq(shopCartItems.id, itemId), eq(shopCartItems.userId, user.id))
  );
  if (!item) {
    res.status(404).json({ error: "Cart item not found" });
    return;
  }

  if (quantity === 0) {
    await db.delete(shopCartItems).where(eq(shopCartItems.id, itemId));
  } else {
    await db.update(shopCartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(shopCartItems.id, itemId));
  }

  res.json(await buildCart(user.id));
});

router.delete("/shop/cart/items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const itemId = req.params.itemId as string;

  await db.delete(shopCartItems).where(
    and(eq(shopCartItems.id, itemId), eq(shopCartItems.userId, user.id))
  );

  res.json(await buildCart(user.id));
});

router.delete("/shop/cart/clear", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  await db.delete(shopCartItems).where(eq(shopCartItems.userId, user.id));
  res.json({ items: [], subtotal: "0", itemCount: 0 });
});

// ─── Orders ──────────────────────────────────────────────────────────────────

router.get("/shop/orders", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const orders = await db
    .select()
    .from(shopOrders)
    .where(eq(shopOrders.userId, user.id))
    .orderBy(desc(shopOrders.createdAt))
    .limit(limit)
    .offset(offset);

  const results = await Promise.all(
    orders.map(async (o) => {
      const items = await db.select().from(shopOrderItems).where(eq(shopOrderItems.orderId, o.id));
      return serializeOrder(o, items);
    })
  );

  res.json(results);
});

router.post("/shop/orders", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const { shippingAddress } = req.body;

  if (!shippingAddress?.fullName || !shippingAddress?.addressLine1 || !shippingAddress?.city || !shippingAddress?.country) {
    res.status(400).json({ error: "Shipping address is incomplete" });
    return;
  }

  const cartItems = await db
    .select({ cartItem: shopCartItems, product: shopProducts })
    .from(shopCartItems)
    .innerJoin(shopProducts, eq(shopCartItems.productId, shopProducts.id))
    .where(eq(shopCartItems.userId, user.id));

  if (cartItems.length === 0) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }

  const total = cartItems.reduce(
    (sum, { cartItem, product }) =>
      sum + parseFloat(String(product.priceUsdt)) * cartItem.quantity,
    0
  );

  const walletBalance = parseFloat(String(user.walletBalance));
  if (walletBalance < total) {
    res.status(400).json({
      error: `Insufficient USDT balance. Need ${total.toFixed(4)}, have ${walletBalance.toFixed(4)}`,
    });
    return;
  }

  // Create order
  const [order] = await db.insert(shopOrders).values({
    userId: user.id,
    totalUsdt: String(total),
    shippingAddress,
    status: "pending",
  }).returning();

  const orderItemValues = cartItems.map(({ cartItem, product }) => ({
    orderId: order.id,
    productId: product.id,
    productName: product.name,
    productImageUrl: product.imageUrls?.[0] ?? null,
    quantity: cartItem.quantity,
    priceUsdt: String(product.priceUsdt),
    subtotal: String(parseFloat(String(product.priceUsdt)) * cartItem.quantity),
  }));

  const items = await db.insert(shopOrderItems).values(orderItemValues).returning();

  // Deduct wallet balance
  await db.update(usersTable)
    .set({ walletBalance: String(walletBalance - total) })
    .where(eq(usersTable.id, user.id));

  // Update stock & sales count
  await Promise.all(
    cartItems.map(({ cartItem, product }) =>
      db.update(shopProducts)
        .set({
          stock: Math.max(0, product.stock - cartItem.quantity),
          salesCount: (product.salesCount ?? 0) + cartItem.quantity,
        })
        .where(eq(shopProducts.id, product.id))
    )
  );

  // Update category product counts
  await db.delete(shopCartItems).where(eq(shopCartItems.userId, user.id));

  res.status(201).json(serializeOrder(order, items));
});

router.get("/shop/orders/:orderId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const orderId = req.params.orderId as string;

  const [order] = await db.select().from(shopOrders).where(
    and(eq(shopOrders.id, orderId), eq(shopOrders.userId, user.id))
  );
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const items = await db.select().from(shopOrderItems).where(eq(shopOrderItems.orderId, orderId));
  res.json(serializeOrder(order, items));
});

// ─── Wishlist ─────────────────────────────────────────────────────────────────

router.get("/shop/wishlist", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const rows = await db.select().from(shopWishlist).where(eq(shopWishlist.userId, user.id));
  res.json({ productIds: rows.map((r) => r.productId) });
});

router.post("/shop/wishlist/:productId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const productId = req.params.productId as string;

  const [existing] = await db.select().from(shopWishlist).where(
    and(eq(shopWishlist.userId, user.id), eq(shopWishlist.productId, productId))
  );
  if (!existing) {
    await db.insert(shopWishlist).values({ userId: user.id, productId });
  }

  const rows = await db.select().from(shopWishlist).where(eq(shopWishlist.userId, user.id));
  res.json({ productIds: rows.map((r) => r.productId) });
});

router.delete("/shop/wishlist/:productId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const productId = req.params.productId as string;

  await db.delete(shopWishlist).where(
    and(eq(shopWishlist.userId, user.id), eq(shopWishlist.productId, productId))
  );

  const rows = await db.select().from(shopWishlist).where(eq(shopWishlist.userId, user.id));
  res.json({ productIds: rows.map((r) => r.productId) });
});

// ─── Shop Admin ────────────────────────────────────────────────────────────────

router.get("/shop/admin/stats", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const [stats] = await db.select({
    totalProducts: sql<number>`(SELECT COUNT(*)::int FROM shop_products WHERE is_active = true)`,
    totalOrders: sql<number>`(SELECT COUNT(*)::int FROM shop_orders)`,
    totalRevenue: sql<string>`(SELECT COALESCE(SUM(total_usdt), 0)::text FROM shop_orders WHERE status != 'cancelled')`,
    pendingOrders: sql<number>`(SELECT COUNT(*)::int FROM shop_orders WHERE status = 'pending')`,
    totalCategories: sql<number>`(SELECT COUNT(*)::int FROM shop_categories)`,
    averageOrderValue: sql<string>`(SELECT COALESCE(AVG(total_usdt), 0)::text FROM shop_orders WHERE status != 'cancelled')`,
  }).from(shopOrders).limit(1);

  const recentOrders = await db
    .select()
    .from(shopOrders)
    .orderBy(desc(shopOrders.createdAt))
    .limit(5);

  const recentOrdersWithItems = await Promise.all(
    recentOrders.map(async (o) => {
      const items = await db.select().from(shopOrderItems).where(eq(shopOrderItems.orderId, o.id));
      return serializeOrder(o, items);
    })
  );

  const topProductsRows = await db
    .select({ product: shopProducts, categoryName: shopCategories.name })
    .from(shopProducts)
    .leftJoin(shopCategories, eq(shopProducts.categoryId, shopCategories.id))
    .orderBy(desc(shopProducts.salesCount))
    .limit(5);

  res.json({
    totalProducts: stats?.totalProducts ?? 0,
    totalOrders: stats?.totalOrders ?? 0,
    totalRevenue: stats?.totalRevenue ?? "0",
    pendingOrders: stats?.pendingOrders ?? 0,
    totalCategories: stats?.totalCategories ?? 0,
    averageOrderValue: stats?.averageOrderValue ?? "0",
    recentOrders: recentOrdersWithItems,
    topProducts: topProductsRows.map((r) => serializeProduct(r.product, r.categoryName)),
  });
});

router.get("/shop/admin/products", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shopProducts);

  const rows = await db
    .select({ product: shopProducts, categoryName: shopCategories.name })
    .from(shopProducts)
    .leftJoin(shopCategories, eq(shopProducts.categoryId, shopCategories.id))
    .orderBy(desc(shopProducts.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({
    products: rows.map((r) => serializeProduct(r.product, r.categoryName)),
    total: count,
    limit,
    offset,
  });
});

router.post("/shop/admin/products", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { name, slug, description, priceUsdt, compareAtPrice, stock, categoryId, imageUrls, tags, isActive, isFeatured } = req.body;

  if (!name || !slug || !priceUsdt || !categoryId) {
    res.status(400).json({ error: "name, slug, priceUsdt, categoryId required" });
    return;
  }

  const [product] = await db.insert(shopProducts).values({
    name,
    slug,
    description: description ?? "",
    priceUsdt,
    compareAtPrice: compareAtPrice ?? null,
    stock: stock ?? 0,
    categoryId,
    imageUrls: imageUrls ?? [],
    tags: tags ?? [],
    isActive: isActive ?? true,
    isFeatured: isFeatured ?? false,
  }).returning();

  await db.update(shopCategories)
    .set({ productCount: sql`${shopCategories.productCount} + 1` })
    .where(eq(shopCategories.id, categoryId));

  const [{ categoryName }] = await db
    .select({ categoryName: shopCategories.name })
    .from(shopCategories)
    .where(eq(shopCategories.id, categoryId));

  res.status(201).json(serializeProduct(product, categoryName));
});

router.patch("/shop/admin/products/:productId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const productId = req.params.productId as string;
  const updates = req.body;

  const allowed = ["name", "slug", "description", "priceUsdt", "compareAtPrice", "stock", "categoryId", "imageUrls", "tags", "isActive", "isFeatured"];
  const filtered: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) filtered[key] = updates[key];
  }

  if (Object.keys(filtered).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  filtered.updatedAt = new Date();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [product] = await db.update(shopProducts).set(filtered as any).where(eq(shopProducts.id, productId)).returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const [row] = await db
    .select({ categoryName: shopCategories.name })
    .from(shopCategories)
    .where(eq(shopCategories.id, product.categoryId));

  res.json(serializeProduct(product, row?.categoryName ?? null));
});

router.delete("/shop/admin/products/:productId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const productId = req.params.productId as string;
  const [product] = await db.select().from(shopProducts).where(eq(shopProducts.id, productId));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  await db.update(shopProducts).set({ isActive: false }).where(eq(shopProducts.id, productId));
  res.status(204).send();
});

router.post("/shop/admin/categories", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { name, slug, description, imageUrl } = req.body;

  if (!name || !slug) {
    res.status(400).json({ error: "name and slug required" });
    return;
  }

  const [cat] = await db.insert(shopCategories).values({ name, slug, description: description ?? null, imageUrl: imageUrl ?? null }).returning();
  res.status(201).json({ id: cat.id, name: cat.name, slug: cat.slug, description: cat.description ?? null, imageUrl: cat.imageUrl ?? null, productCount: 0 });
});

router.get("/shop/admin/orders", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { status } = req.query as any;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const conditions = status ? [eq(shopOrders.status, status as any)] : [];

  const orders = await db
    .select()
    .from(shopOrders)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(shopOrders.createdAt))
    .limit(limit)
    .offset(offset);

  const results = await Promise.all(
    orders.map(async (o) => {
      const items = await db.select().from(shopOrderItems).where(eq(shopOrderItems.orderId, o.id));
      return serializeOrder(o, items);
    })
  );

  res.json(results);
});

router.patch("/shop/admin/orders/:orderId/status", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const orderId = req.params.orderId as string;
  const { status, trackingNumber } = req.body;

  const validStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const updates: { status: typeof shopOrders.status._.data; updatedAt: Date; trackingNumber?: string | null } = {
    status,
    updatedAt: new Date(),
  };
  if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;

  const [order] = await db.update(shopOrders).set(updates).where(eq(shopOrders.id, orderId)).returning();
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  // If cancelled, refund wallet balance
  if (status === "cancelled") {
    const items = await db.select().from(shopOrderItems).where(eq(shopOrderItems.orderId, orderId));
    const total = parseFloat(String(order.totalUsdt));
    await db.update(usersTable)
      .set({ walletBalance: sql`${usersTable.walletBalance} + ${String(total)}` })
      .where(eq(usersTable.id, order.userId));

    // Restore stock
    await Promise.all(
      items.map((item) =>
        db.update(shopProducts)
          .set({ stock: sql`${shopProducts.stock} + ${item.quantity}` })
          .where(eq(shopProducts.id, item.productId))
      )
    );
  }

  const items = await db.select().from(shopOrderItems).where(eq(shopOrderItems.orderId, orderId));
  res.json(serializeOrder(order, items));
});

export default router;
