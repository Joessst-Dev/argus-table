import { html } from 'lit';
import type { ArgusTable, ColumnDef, DataSource, Density, RowsRequest } from 'argus-table';
import 'argus-table';
import { EXTRA_COLUMNS, makePeople, type Person } from './data.js';
import { installBenchHooks } from './bench-hooks.js';

// Query parameters: rows (default 100000), cols (default 20), density, dir=rtl,
// overscan, bench (installs window.__argusBench for benchmarks/run.ts),
// pin=none to drop the pins (the floor when measuring what pinning costs),
// theme=default or theme=material to load that stylesheet from @argus-table/themes
// (material also loads Roboto and sets the table on an inset page), and
// scheme=dark|light to force a colour scheme through data-argus-theme.
// source=remote loads the rows through a pretend server (dataSource) instead of
// data, with latency=<ms> (default 100), total=unknown to leave the total out,
// and fail=<page> to fail that page's first request. Requests are logged in
// window.__argusRequests.
// pinned=top,bottom (or one of them) adds a pinned summary row on that side:
// averages at the top, totals at the bottom.
const params = new URLSearchParams(location.search);
const theme = params.get('theme');
if (theme === 'default') await import('@argus-table/themes/default.css');
if (theme === 'material') {
  await Promise.all([
    import('@fontsource/roboto/400.css'),
    import('@fontsource/roboto/500.css'),
    import('@argus-table/themes/material.css'),
  ]);
  document.documentElement.dataset.page = 'inset';
  // Loaded before the table renders, so screenshots never catch the fallback font.
  await Promise.all([
    document.fonts.load('400 14px Roboto'),
    document.fonts.load('500 14px Roboto'),
  ]);
}
const scheme = params.get('scheme');
if (scheme === 'dark' || scheme === 'light') {
  document.documentElement.dataset.argusTheme = scheme;
  document.documentElement.style.colorScheme = scheme;
}
const rowCount = Number(params.get('rows') ?? 100_000);
const colCount = Number(params.get('cols') ?? 20);
const density = (params.get('density') ?? 'comfortable') as Density;
document.documentElement.dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr';

/** A DOM node as cell content (instead of a template). */
function emailLink(person: Person): Node {
  const a = document.createElement('a');
  a.href = `mailto:${person.email}`;
  a.textContent = person.email;
  a.tabIndex = -1;
  return a;
}

const allColumns: ColumnDef<Person>[] = [
  {
    id: 'index',
    header: '#',
    // Summary rows (pinned=…) have no index.
    accessor: (p) => (Number.isNaN(p.index) ? undefined : p.index),
    width: 80,
    align: 'end',
    pin: 'start',
  },
  { id: 'name', header: 'Name', accessor: 'name', width: 180, pin: 'start', sortable: true },
  // Summary rows (pinned=…) have no email or status.
  { id: 'email', header: 'Email', width: 260, cell: (p, ctx) => (ctx.pinned ? '' : emailLink(p)) },
  { id: 'city', header: 'City', accessor: 'location.city', width: 120, sortable: true },
  { id: 'country', header: 'Country', accessor: 'location.country', width: 90 },
  {
    id: 'status',
    header: 'Status',
    width: 110,
    cell: (p, ctx) => (ctx.pinned ? '' : html`<span class="status">${p.status}</span>`),
  },
  {
    id: 'amount',
    header: 'Amount',
    accessor: 'amount',
    width: 120,
    align: 'end',
    sortable: true,
    cell: (p) => p.amount.toFixed(2),
  },
  { id: 'date', header: 'Date', accessor: 'date', width: 120 },
  ...Array.from({ length: EXTRA_COLUMNS }, (_, i): ColumnDef<Person> => ({
    id: `f${String(i + 1)}`,
    header: `F${String(i + 1)}`,
    accessor: (p) => p.extra[i],
    width: 120,
  })),
  {
    id: 'actions',
    header: '',
    width: 90,
    pin: 'end',
    cell: () => html`<button type="button" tabindex="-1">Open</button>`,
  },
];

// Keep the pinned columns and trim scrolling ones to reach `cols`.
const scrolling = allColumns.filter((c) => !c.pin).slice(0, Math.max(0, colCount - 3));
const unpinned = params.get('pin') === 'none';
const columns = allColumns
  .filter((c) => c.pin === 'start' || scrolling.includes(c) || c.pin === 'end')
  .map((c) => (unpinned ? { ...c, pin: undefined } : c));

const table = document.createElement('argus-table') as ArgusTable<Person>;
table.setAttribute('aria-label', 'People');
table.density = density;
if (params.has('overscan')) table.overscan = Number(params.get('overscan'));
table.columns = columns;
table.getRowId = (p) => p.id;
const people = makePeople(rowCount);
if (params.get('source') === 'remote') table.dataSource = remoteSource(people);
else table.data = people;
const pinnedSides = new Set(params.get('pinned')?.split(','));
if (pinnedSides.size > 0) {
  table.pinnedRows = {
    top: pinnedSides.has('top') ? [summary('avg', 'Average', people.length || 1)] : undefined,
    bottom: pinnedSides.has('bottom') ? [summary('sum', 'Total', 1)] : undefined,
  };
}
document.body.append(table);

if (params.has('bench')) installBenchHooks(table);

declare global {
  interface Window {
    __argusRequests?: RowsRequest[];
  }
}

/** A summary row shaped like a person: the amounts added up, divided by `divisor`. */
function summary(id: string, name: string, divisor: number): Person {
  const [first] = people;
  if (!first) throw new Error('no rows to summarise');
  const amount = people.reduce((sum, p) => sum + p.amount, 0) / divisor;
  return {
    ...first,
    id,
    index: Number.NaN,
    name,
    amount,
    date: '',
    location: { city: '', country: '' },
    extra: first.extra.map(() => ''),
  };
}

/** A pretend server over the people: sorts, waits, honours `signal`, can fail a page once. */
function remoteSource(people: Person[]): DataSource<Person> {
  const latency = Number(params.get('latency') ?? 100);
  const withTotal = params.get('total') !== 'unknown';
  const failing = new Set(params.has('fail') ? [Number(params.get('fail'))] : []);
  const pageSize = 100;
  const sortedBy = new Map<string, Person[]>();
  const log: RowsRequest[] = (window.__argusRequests = []);
  return {
    pageSize,
    getRows: ({ start, end, sorting, signal }) => {
      log.push({ start, end, sorting, signal });
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (failing.delete(Math.floor(start / pageSize))) {
            reject(new Error('Server error'));
            return;
          }
          const [by] = sorting;
          let rows = people;
          if (by) {
            const key = `${by.id}:${String(by.desc)}`;
            let sorted = sortedBy.get(key);
            if (!sorted) {
              const column = columns.find((c) => c.id === by.id);
              const read = (p: Person): unknown =>
                typeof column?.accessor === 'function'
                  ? column.accessor(p, 0)
                  : column?.accessor
                      ?.split('.')
                      .reduce<unknown>(
                        (v, k) => (v as Record<string, unknown> | undefined)?.[k],
                        p,
                      );
              const dir = by.desc ? -1 : 1;
              sorted = [...people].sort((a, b) => {
                const x = read(a) as string | number;
                const y = read(b) as string | number;
                return x < y ? -dir : x > y ? dir : 0;
              });
              sortedBy.set(key, sorted);
            }
            rows = sorted;
          }
          resolve({ rows: rows.slice(start, end), total: withTotal ? people.length : undefined });
        }, latency);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(signal.reason as Error);
        });
      });
    },
  };
}
