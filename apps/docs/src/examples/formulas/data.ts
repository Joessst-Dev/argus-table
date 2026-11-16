// Shared by the formulas examples' four flavours: order items, and their
// plain columns (the formula columns are in each example).
export interface Item {
  id: string;
  product: string;
  price: number;
  qty: number;
  discount: number;
  ordered: string;
}

const products = ['Desk lamp', 'Notebook', 'Pen set', 'Monitor arm', 'Chair mat'];
const prices = [12.5, 3.2, 8, 49.9, 24];
const pad = (n: number) => String(n).padStart(2, '0');

export function itemsOf(count: number): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `i${String(i + 1)}`,
    product: products[i % products.length] ?? '',
    price: prices[i % prices.length] ?? 0,
    qty: (i * 7) % 23,
    discount: [0, 0.05, 0.1][i % 3] ?? 0,
    ordered: `2026-${pad(1 + (i % 12))}-${pad(1 + (i % 28))}`,
  }));
}

export const items = itemsOf(1_000);

/** The columns formulas read, by id or by header: [Unit price], [qty]… */
export const dataColumns = [
  { id: 'product', header: 'Product', accessor: 'product', width: 140, pin: 'start' },
  { id: 'price', header: 'Unit price', accessor: 'price', width: 100, align: 'end' },
  { id: 'qty', header: 'Quantity', accessor: 'qty', width: 100, align: 'end', sortable: true },
  { id: 'discount', header: 'Discount', accessor: 'discount', width: 100, align: 'end' },
  { id: 'ordered', header: 'Ordered', accessor: 'ordered', width: 120 },
] as const;
