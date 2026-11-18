// Shared by the export examples' four flavours.
export interface Order {
  id: string;
  customer: string;
  city: string;
  status: string;
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];
const statuses = ['open', 'paid', 'shipped'];

export const orders: Order[] = Array.from({ length: 1_000 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  city: cities[i % cities.length] ?? '',
  status: statuses[i % statuses.length] ?? '',
  total: Math.round(((i * 7919) % 100_000) / 10) / 10,
}));

/** The formats, with their buttons' text. */
export const formats = [
  { format: 'csv', label: 'CSV' },
  { format: 'xlsx', label: 'Excel' },
  { format: 'pdf', label: 'PDF' },
] as const;

/** A line of an order: what a detail panel shows and an export can carry. */
export interface Line {
  product: string;
  quantity: number;
  price: number;
}

const products = ['Notebook', 'Pen', 'Stapler', 'Lamp', 'Mug'];

/** An order's lines: one to four, the same every time. */
export const linesOf = (order: Order): Line[] => {
  const n = Number(order.id.slice(1));
  return Array.from({ length: 1 + (n % 4) }, (_, i) => ({
    product: products[(n + i) % products.length] ?? '',
    quantity: 1 + ((n + i) % 3),
    price: 2 + ((n * 3 + i * 5) % 20),
  }));
};
