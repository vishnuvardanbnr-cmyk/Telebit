import { db, shopCategories, shopProducts } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const categories = [
  { name: "Electronics", slug: "electronics", description: "Cutting-edge gadgets and tech hardware" },
  { name: "Collectibles", slug: "collectibles", description: "Rare coins, art, and limited-edition items" },
  { name: "Apparel", slug: "apparel", description: "Premium fashion and crypto-themed clothing" },
  { name: "Hardware Wallets", slug: "hardware-wallets", description: "Secure cold storage for your crypto" },
  { name: "Accessories", slug: "accessories", description: "Cases, cables, and peripherals" },
];

const productTemplates = [
  {
    name: "Ledger Nano X Pro",
    slug: "ledger-nano-x-pro",
    description: "Military-grade hardware wallet supporting 5,500+ assets with Bluetooth connectivity. AES-256 encrypted secure element with CC EAL5+ certification.",
    priceUsdt: "89.99",
    compareAtPrice: "119.99",
    stock: 47,
    categorySlug: "hardware-wallets",
    isFeatured: true,
    imageUrls: ["https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=800"],
    tags: ["crypto", "security", "wallet"],
  },
  {
    name: "Trezor Model T Elite",
    slug: "trezor-model-t-elite",
    description: "Next-gen hardware wallet with touchscreen display. Open-source firmware, passphrase protection, and multi-coin support for ultimate security.",
    priceUsdt: "149.00",
    compareAtPrice: null,
    stock: 23,
    categorySlug: "hardware-wallets",
    isFeatured: true,
    imageUrls: ["https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=800"],
    tags: ["crypto", "security", "wallet", "trezor"],
  },
  {
    name: "Crypto Bunker SSD 2TB",
    slug: "crypto-bunker-ssd-2tb",
    description: "Military-grade encrypted SSD with hardware AES-256 encryption. Perfect for cold storage backups and private key management. IP68 rated.",
    priceUsdt: "219.50",
    compareAtPrice: "249.00",
    stock: 15,
    categorySlug: "electronics",
    isFeatured: true,
    imageUrls: ["https://images.unsplash.com/photo-1597852074816-d933c7d2b988?w=800"],
    tags: ["storage", "security", "hardware"],
  },
  {
    name: "ASIC Miner Titan V2",
    slug: "asic-miner-titan-v2",
    description: "High-efficiency BTC/BSC mining rig. 110 TH/s hashrate, 3250W power consumption with smart throttling. Includes management software.",
    priceUsdt: "3499.00",
    compareAtPrice: "3999.00",
    stock: 8,
    categorySlug: "electronics",
    isFeatured: false,
    imageUrls: ["https://images.unsplash.com/photo-1640826514546-07fd2a75cd4d?w=800"],
    tags: ["mining", "hardware", "btc"],
  },
  {
    name: "4K Crypto Monitoring Setup",
    slug: "4k-crypto-monitoring-setup",
    description: "Dual 27\" 4K displays optimized for trading dashboards. 144Hz refresh rate, 1ms response time, factory-calibrated for true color accuracy.",
    priceUsdt: "780.00",
    compareAtPrice: null,
    stock: 12,
    categorySlug: "electronics",
    isFeatured: false,
    imageUrls: ["https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800"],
    tags: ["monitor", "trading", "setup"],
  },
  {
    name: "Genesis Block Commemorative Coin",
    slug: "genesis-block-coin",
    description: "24K gold-plated physical Bitcoin genesis block coin. Laser-engraved with Satoshi's original message. Limited to 2,100 units worldwide.",
    priceUsdt: "299.00",
    compareAtPrice: "349.00",
    stock: 34,
    categorySlug: "collectibles",
    isFeatured: true,
    imageUrls: ["https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800"],
    tags: ["bitcoin", "collectible", "gold", "limited"],
  },
  {
    name: "Crypto Pioneer NFT Print",
    slug: "crypto-pioneer-nft-print",
    description: "Museum-quality giclée print of iconic blockchain art. Certificate of authenticity included. 60x80cm on archival paper. Signed and numbered.",
    priceUsdt: "125.00",
    compareAtPrice: null,
    stock: 50,
    categorySlug: "collectibles",
    isFeatured: false,
    imageUrls: ["https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800"],
    tags: ["art", "nft", "print", "collectible"],
  },
  {
    name: "BNB Chain Founding Token Set",
    slug: "bnb-chain-founding-token-set",
    description: "Rare set of physical tokens commemorating BNB Chain's founding. Silver-plated with serial numbers. Display case included.",
    priceUsdt: "199.00",
    compareAtPrice: "240.00",
    stock: 19,
    categorySlug: "collectibles",
    isFeatured: false,
    imageUrls: ["https://images.unsplash.com/photo-1622675272997-e56d4b1a8a90?w=800"],
    tags: ["bnb", "token", "collectible", "silver"],
  },
  {
    name: "Hash Black Hoodie",
    slug: "hash-black-hoodie",
    description: "Premium heavyweight 400gsm cotton-blend hoodie. Embroidered blockchain hash pattern. Unisex fit with kangaroo pocket. Ethically sourced.",
    priceUsdt: "65.00",
    compareAtPrice: "85.00",
    stock: 120,
    categorySlug: "apparel",
    isFeatured: true,
    imageUrls: ["https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=800"],
    tags: ["hoodie", "fashion", "crypto", "apparel"],
  },
  {
    name: "USDT Whale T-Shirt",
    slug: "usdt-whale-t-shirt",
    description: "Ultra-soft Supima cotton tee. Minimal whale graphic in monochrome. Preshrunk, available S-3XL. Machine washable.",
    priceUsdt: "29.00",
    compareAtPrice: null,
    stock: 250,
    categorySlug: "apparel",
    isFeatured: false,
    imageUrls: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800"],
    tags: ["t-shirt", "fashion", "crypto", "apparel"],
  },
  {
    name: "BlockChain Cap",
    slug: "blockchain-cap",
    description: "Structured 6-panel cap with embroidered blockchain motif. Adjustable strap, one size fits most. UV protective fabric.",
    priceUsdt: "34.00",
    compareAtPrice: "42.00",
    stock: 88,
    categorySlug: "apparel",
    isFeatured: false,
    imageUrls: ["https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800"],
    tags: ["cap", "hat", "crypto", "apparel"],
  },
  {
    name: "Faraday Privacy Pouch XL",
    slug: "faraday-privacy-pouch-xl",
    description: "RF-shielded pouch blocks RFID, NFC, WiFi and cellular signals. Fits phones up to 7\". Protects crypto keys from remote attacks.",
    priceUsdt: "22.00",
    compareAtPrice: null,
    stock: 300,
    categorySlug: "accessories",
    isFeatured: false,
    imageUrls: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800"],
    tags: ["privacy", "security", "accessory"],
  },
  {
    name: "Titanium Seed Phrase Plate",
    slug: "titanium-seed-phrase-plate",
    description: "Grade-5 titanium plate for fireproof, waterproof seed phrase backup. Stamp kit included. Survives 1,600C. Essential for long-term hodlers.",
    priceUsdt: "59.00",
    compareAtPrice: "75.00",
    stock: 67,
    categorySlug: "accessories",
    isFeatured: true,
    imageUrls: ["https://images.unsplash.com/photo-1621789098261-5f8f45b2dfdf?w=800"],
    tags: ["security", "backup", "titanium", "accessory"],
  },
  {
    name: "Crypto Desk Mat XL",
    slug: "crypto-desk-mat-xl",
    description: "900x400mm premium stitched desk mat. BSC network topology print. Anti-slip base, water-resistant surface. Perfect trading setup upgrade.",
    priceUsdt: "39.00",
    compareAtPrice: null,
    stock: 95,
    categorySlug: "accessories",
    isFeatured: false,
    imageUrls: ["https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800"],
    tags: ["desk", "accessory", "trading", "setup"],
  },
];

async function seed() {
  console.log("Seeding shop categories...");
  const catMap: Record<string, string> = {};

  for (const cat of categories) {
    const [existing] = await db.select().from(shopCategories).where(eq(shopCategories.slug, cat.slug));

    if (existing) {
      catMap[cat.slug] = existing.id;
      console.log(`  Skipping category: ${cat.name} (already exists)`);
      continue;
    }

    const [created] = await db.insert(shopCategories).values(cat).returning();
    catMap[cat.slug] = created.id;
    console.log(`  Created category: ${cat.name}`);
  }

  console.log("\nSeeding shop products...");
  for (const { categorySlug, ...product } of productTemplates) {
    const categoryId = catMap[categorySlug];
    if (!categoryId) {
      console.log(`  Skipping ${product.name}: category ${categorySlug} not found`);
      continue;
    }

    const [existing] = await db.select().from(shopProducts).where(eq(shopProducts.slug, product.slug));

    if (existing) {
      console.log(`  Skipping product: ${product.name} (already exists)`);
      continue;
    }

    await db.insert(shopProducts).values({ ...product, categoryId });
    console.log(`  Created product: ${product.name}`);
  }

  // Update category product counts
  console.log("\nUpdating category product counts...");
  const cats = await db.select().from(shopCategories);
  for (const cat of cats) {
    const [{ cnt }] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(shopProducts)
      .where(eq(shopProducts.categoryId, cat.id));

    await db.update(shopCategories)
      .set({ productCount: cnt })
      .where(eq(shopCategories.id, cat.id));
    console.log(`  ${cat.name}: ${cnt} products`);
  }

  console.log("\nSeed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
