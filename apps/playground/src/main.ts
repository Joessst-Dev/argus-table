import { html } from 'lit';
import type { ArgusTable, ColumnDef, Density } from 'argus-table';
import 'argus-table';
import { EXTRA_COLUMNS, makePeople, type Person } from './data.js';
import { installBenchHooks } from './bench-hooks.js';

// Query parameters: rows (default 100000), cols (default 20), density, dir=rtl,
// overscan, bench (installs window.__argusBench for benchmarks/run.ts), and
// pin=none to drop the pins (the floor when measuring what pinning costs).
const params = new URLSearchParams(location.search);
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
  { id: 'index', header: '#', accessor: 'index', width: 80, align: 'end', pin: 'start' },
  { id: 'name', header: 'Name', accessor: 'name', width: 180, pin: 'start' },
  { id: 'email', header: 'Email', width: 260, cell: emailLink },
  { id: 'city', header: 'City', accessor: 'location.city', width: 120 },
  { id: 'country', header: 'Country', accessor: 'location.country', width: 90 },
  {
    id: 'status',
    header: 'Status',
    width: 110,
    cell: (p) => html`<span class="status">${p.status}</span>`,
  },
  {
    id: 'amount',
    header: 'Amount',
    width: 120,
    align: 'end',
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
table.density = density;
if (params.has('overscan')) table.overscan = Number(params.get('overscan'));
table.columns = columns;
table.data = makePeople(rowCount);
table.getRowId = (p) => p.id;
document.body.append(table);

if (params.has('bench')) installBenchHooks(table);
