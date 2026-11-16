// Shared by the saved-state example's four flavours: the rows, and saving
// a table's state in localStorage.
import type { TableState } from 'argus-table';

export interface Order {
  id: string;
  customer: string;
  city: string;
  status: string;
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];
const statuses = ['open', 'paid', 'shipped'];

export const orders: Order[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  city: cities[i % cities.length] ?? '',
  status: statuses[i % statuses.length] ?? '',
  total: Math.round(((i * 7919) % 100_000) / 10) / 10,
}));

/** The saved state under a key, if there is one. */
export function load(key: string): TableState | undefined {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as TableState) : undefined;
  } catch {
    return undefined;
  }
}

/** Saves a state under a key, or forgets it. */
export function store(key: string, state: TableState | undefined): void {
  try {
    if (state) localStorage.setItem(key, JSON.stringify(state));
    else localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable (private mode); the table still works.
  }
}
