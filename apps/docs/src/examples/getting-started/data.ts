// Shared by the first table's four flavours: the rows. Columns stay in each
// flavour, as they would in an app.
export interface Order {
  id: string;
  customer: { name: string; city: string };
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];

export const orders: Order[] = Array.from({ length: 200 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: { name: `Customer ${String(((i * 37) % 200) + 1)}`, city: cities[i % 5] ?? '' },
  total: Math.round(((i * 7919) % 100000) / 10) / 10,
}));
