// Shared by the infinite-loading examples' four flavours: a pretend server
// over an array, standing in for your API.
import type { DataSource } from 'argus-table';

export interface Order {
  id: string;
  customer: string;
  city: string;
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];

export const orders: Order[] = Array.from({ length: 100_000 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  city: cities[i % cities.length] ?? '',
  total: Math.round(((i * 7919) % 100_000) / 10) / 10,
}));

interface SourceOptions {
  /** How many rows the server has. Default: all 100,000. */
  rows?: number;
  /** Send the total with every page. Default: `true`. */
  total?: boolean;
  /** Fail the first request for the first page, once. */
  failOnce?: boolean;
}

/**
 * The server: answers after 150–500 ms, sorts by `sorting`, honours `signal`
 * (the table aborts pages that scroll away), and can fail a page once.
 */
export function createSource({
  rows = orders.length,
  total = true,
  failOnce = false,
}: SourceOptions = {}): DataSource<Order> {
  let failing = failOnce;
  return {
    pageSize: 100,
    getRows: ({ start, end, sorting, signal }) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => {
            if (failing && start === 0) {
              failing = false;
              reject(new Error(`Rows ${String(start)}–${String(end)} timed out`));
              return;
            }
            let sorted = orders.slice(0, rows);
            const [by] = sorting;
            if (by) {
              const key = by.id as keyof Order;
              const dir = by.desc ? -1 : 1;
              sorted = sorted.sort((a, b) => (a[key] < b[key] ? -dir : a[key] > b[key] ? dir : 0));
            }
            resolve({ rows: sorted.slice(start, end), total: total ? rows : undefined });
          },
          150 + Math.random() * 350,
        );
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(signal.reason as Error);
        });
      }),
  };
}
