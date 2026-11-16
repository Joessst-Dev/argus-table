// Shared by the pinned-rows examples' four flavours: the orders, and two
// summary rows to pin. Pinned rows are separate objects, read by the same columns.
export interface Order {
  id: string;
  customer: string;
  city: string;
  items: number;
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];

export const orders: Order[] = Array.from({ length: 200 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  city: cities[i % cities.length] ?? '',
  items: 1 + ((i * 13) % 9),
  total: Math.round(((i * 7919) % 100_000) / 10) / 10,
}));

const sum = (key: 'items' | 'total') => orders.reduce((s, o) => s + o[key], 0);

export const totals: Order = {
  id: 'total',
  customer: 'Total',
  city: '',
  items: sum('items'),
  total: Math.round(sum('total') * 100) / 100,
};

export const average: Order = {
  id: 'average',
  customer: 'Average',
  city: '',
  items: Math.round((sum('items') / orders.length) * 10) / 10,
  total: Math.round((sum('total') / orders.length) * 100) / 100,
};

export const money = (value: number) => value.toLocaleString('en', { minimumFractionDigits: 2 });
