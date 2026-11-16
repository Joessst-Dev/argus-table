// Shared by the declarative-columns examples' four flavours: the rows.
export interface Order {
  id: string;
  customer: string;
  city: string;
  status: 'open' | 'paid' | 'shipped';
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];
const statuses = ['open', 'paid', 'shipped'] as const;

export const orders: Order[] = Array.from({ length: 200 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  city: cities[i % cities.length] ?? '',
  status: statuses[i % statuses.length] ?? 'open',
  total: Math.round(((i * 7919) % 100000) / 10) / 10,
}));
