// Shared by the keyboard example's four flavours.
export interface Order {
  id: string;
  customer: string;
  city: string;
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];

export const orders: Order[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  city: cities[i % cities.length] ?? '',
  total: Math.round(((i * 7919) % 100_000) / 10) / 10,
}));

/** The log line for a cell click (or Enter on a cell). */
export const describeClick = ({ columnId, value }: { columnId: string; value: unknown }) =>
  `argus-cell-click: ${columnId} = ${String(value)}`;
