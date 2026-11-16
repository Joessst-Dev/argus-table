// Shared by the header-menu examples' four flavours.
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
