// Shared by the server example's four flavours: a pretend sales API, standing
// in for yours. It groups, counts and totals on the "server" (getRows gets the
// grouping and the path of the level it fills), pages every level, and answers
// after a short delay.
import type { DataSource, GroupData, SortState } from 'argus-table';
import type { Sale } from './data';

const REGIONS = ['Americas', 'Asia Pacific', 'Europe', 'Middle East', 'Africa'];
const STATUSES = ['Lost', 'Open', 'Won'];

/** 2,000 sales held by the server. */
const all: Sale[] = Array.from({ length: 2_000 }, (_, i) => ({
  id: `s${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  region: REGIONS[i % REGIONS.length] ?? '',
  status: STATUSES[(i * 7) % STATUSES.length] ?? '',
  amount: ((i * 7_919) % 40_000) + 500,
}));

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason as Error);
    });
  });

const byAmount = (sorting: SortState) => {
  const sort = sorting.find((s) => s.id === 'amount');
  return sort
    ? (a: Sale, b: Sale) => (sort.desc ? b.amount - a.amount : a.amount - b.amount)
    : undefined;
};

export function createSalesSource(): DataSource<Sale> {
  return {
    pageSize: 50,
    async getRows({ start, end, sorting, grouping = [], groupPath = [], signal }) {
      await wait(150, signal);
      // The rows in the group being filled.
      const rows = all.filter((sale) =>
        groupPath.every(({ columnId, value }) => sale[columnId as keyof Sale] === value),
      );
      if (groupPath.length === grouping.length) {
        const compare = byAmount(sorting);
        const sorted = compare ? [...rows].sort(compare) : rows;
        return { rows: sorted.slice(start, end), total: sorted.length };
      }
      // A level of groups: one per value, with its count and the sum of its amounts.
      const column = grouping[groupPath.length] as keyof Sale;
      const groups = new Map<unknown, GroupData>();
      for (const sale of rows) {
        const group = groups.get(sale[column]) ?? {
          value: sale[column],
          count: 0,
          totals: { amount: 0 },
        };
        group.count++;
        (group.totals as { amount: number }).amount += sale.amount;
        groups.set(sale[column], group);
      }
      const list = [...groups.values()].sort((a, b) =>
        String(a.value).localeCompare(String(b.value)),
      );
      return { rows: [], groups: list.slice(start, end), total: list.length };
    },
  };
}
