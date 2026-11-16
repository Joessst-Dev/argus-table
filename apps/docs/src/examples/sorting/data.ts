// Shared by the Sorting examples' four flavours: the rows. Columns stay in each
// flavour, since their content is the framework's own.
export interface Order {
  id: string;
  customer: string;
  city: string;
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];

export const orders: Order[] = Array.from({ length: 200 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(((i * 37) % 200) + 1)}`,
  city: cities[i % cities.length] ?? '',
  total: Math.round(((i * 7919) % 100000) / 10) / 10,
}));
