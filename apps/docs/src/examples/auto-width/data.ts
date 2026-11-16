// Shared by the auto-width examples' four flavours: products with names of
// very different lengths.
export interface Product {
  sku: string;
  name: string;
  category: string;
  price: number;
}

const names = [
  'Desk lamp',
  'Ergonomic office chair with adjustable lumbar support',
  'Notebook',
  'Noise-cancelling headphones',
  'USB-C cable, 2 m',
];
const categories = ['Lighting', 'Furniture', 'Stationery', 'Audio', 'Accessories'];

export const products: Product[] = Array.from({ length: 200 }, (_, i) => ({
  sku: `SKU-${String(10_000 + i)}`,
  name: names[i % names.length] ?? '',
  category: categories[i % categories.length] ?? '',
  price: Math.round(((i * 37) % 500) * 100 + 99) / 100,
}));
