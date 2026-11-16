// Shared by the selection examples' four flavours: the rows, and the line
// each example shows for its selection.
export interface Order {
  id: string;
  customer: string;
  city: string;
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];

export const orders: Order[] = Array.from({ length: 200 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  city: cities[i % cities.length] ?? '',
  total: Math.round(((i * 7919) % 100_000) / 10) / 10,
}));

/** "3 selected: o1, o2, o3", the first eight ids at most. */
export function describeSelection(ids: readonly string[]): string {
  if (ids.length === 0) return '0 selected';
  const shown = ids.slice(0, 8).join(', ');
  return `${String(ids.length)} selected: ${shown}${ids.length > 8 ? ', …' : ''}`;
}

/** The most rows the controlled example lets you select. */
export const MAX_SELECTED = 5;
