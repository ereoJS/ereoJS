const CATEGORIES = ['Electronics', 'Clothing', 'Home', 'Books', 'Sports', 'Toys', 'Food', 'Beauty'] as const;

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  rating: number;
  stock: number;
}

export interface PaginatedResult {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Deterministic seed-based pseudo-random
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateProducts(count: number): Product[] {
  const products: Product[] = [];
  for (let i = 1; i <= count; i++) {
    const r = seededRandom(i);
    const catIndex = Math.floor(r * CATEGORIES.length);
    products.push({
      id: i,
      name: `Product ${i} - ${CATEGORIES[catIndex]} Item`,
      description: `High-quality ${CATEGORIES[catIndex].toLowerCase()} product #${i}. Features premium materials and excellent craftsmanship. Perfect for everyday use.`,
      price: Math.round((r * 500 + 5) * 100) / 100,
      category: CATEGORIES[catIndex],
      imageUrl: `https://picsum.photos/seed/${i}/400/300`,
      rating: Math.round((r * 4 + 1) * 10) / 10,
      stock: Math.floor(r * 200),
    });
  }
  return products;
}

const ALL_PRODUCTS = generateProducts(500);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getProducts(page: number = 1, limit: number = 20): Promise<PaginatedResult> {
  await delay(50); // Simulate DB latency
  const start = (page - 1) * limit;
  const products = ALL_PRODUCTS.slice(start, start + limit);
  return {
    products,
    total: ALL_PRODUCTS.length,
    page,
    limit,
    totalPages: Math.ceil(ALL_PRODUCTS.length / limit),
  };
}

export async function getProduct(id: number): Promise<Product | null> {
  await delay(30); // Simulate DB latency
  return ALL_PRODUCTS.find((p) => p.id === id) ?? null;
}

export async function getRelated(category: string, excludeId: number): Promise<Product[]> {
  await delay(50); // Simulate DB latency
  return ALL_PRODUCTS.filter((p) => p.category === category && p.id !== excludeId).slice(0, 4);
}

// Sync versions for benchmarks that need them (e.g., build-time data)
export function getProductsSync(page: number = 1, limit: number = 20): PaginatedResult {
  const start = (page - 1) * limit;
  const products = ALL_PRODUCTS.slice(start, start + limit);
  return {
    products,
    total: ALL_PRODUCTS.length,
    page,
    limit,
    totalPages: Math.ceil(ALL_PRODUCTS.length / limit),
  };
}

export function getProductSync(id: number): Product | null {
  return ALL_PRODUCTS.find((p) => p.id === id) ?? null;
}
