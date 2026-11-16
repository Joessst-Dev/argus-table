// Shared by the filtering examples' four flavours: 100,000 orders, and a
// pretend server that filters (standing in for your API).
import type { ColumnFilterState, DataSource } from 'argus-table';

export interface Order {
  id: string;
  customer: string;
  city: string;
  status: string;
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];
const statuses = ['open', 'paid', 'shipped'];

export const orders: Order[] = Array.from({ length: 100_000 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  city: cities[i % cities.length] ?? '',
  status: statuses[i % statuses.length] ?? '',
  total: Math.round(((i * 7919) % 100_000) / 10) / 10,
}));

/** What the server was asked for, for the example's log. */
export interface Request {
  start: number;
  end: number;
  filters: ColumnFilterState;
  quickFilter: string;
}

/**
 * The server: filters by status (a `set` filter) and searches the customer
 * with the quick filter's words. `onRequest` sees every request.
 */
export function createSource(onRequest: (request: Request) => void): DataSource<Order> {
  return {
    async getRows({ start, end, filters, quickFilter, signal }) {
      onRequest({ start, end, filters, quickFilter });
      await new Promise((resolve) => setTimeout(resolve, 150));
      signal.throwIfAborted();
      const status = filters.status;
      const words = quickFilter.toLowerCase().split(/\s+/).filter(Boolean);
      const rows = orders.filter(
        (o) =>
          (status?.kind !== 'set' || status.values.includes(o.status)) &&
          words.every((w) => o.customer.toLowerCase().includes(w)),
      );
      return { rows: rows.slice(start, end), total: rows.length };
    },
  };
}

/** A request as one line of the log. */
export const describe = ({ start, end, filters, quickFilter }: Request) =>
  `getRows ${String(start)}–${String(end)}, filters ${JSON.stringify(filters)}, quickFilter ${JSON.stringify(quickFilter)}`;
