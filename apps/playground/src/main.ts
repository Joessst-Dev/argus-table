import { html } from 'lit';
import type {
  ArgusTable,
  ChildrenRequest,
  ColumnDef,
  ColumnGroup,
  ColumnFilter,
  ColumnFilterState,
  DataSource,
  Density,
  RowsRequest,
  SortState,
} from 'argus-table';
import 'argus-table';
import { EXTRA_COLUMNS, makePeople, STATUSES, type Person } from './data.js';
import { installBenchHooks } from './bench-hooks.js';

// Query parameters: rows (default 100000), cols (default 20), density, dir=rtl,
// overscan, bench (installs window.__argusBench for benchmarks/run.ts and leaves
// the table unmounted until __argusBench.mount(), so the runner can time the first
// render and measure the heap with the data alone),
// pin=none to drop the pins (the floor when measuring what pinning costs),
// theme=default, material, fluent, bootstrap or minimal to load that stylesheet
// from @argus-table/themes (material also loads Roboto and sets the table on an
// inset page; minimal loads Instrument Sans), and
// scheme=dark|light to force a colour scheme through data-argus-theme.
// source=remote loads the rows through a pretend server (dataSource) instead of
// data, with latency=<ms> (default 100), total=unknown to leave the total out,
// and fail=<page> to fail that page's first request. Requests are logged in
// window.__argusRequests.
// pinned=top,bottom (or one of them) adds a pinned summary row on that side:
// averages at the top, totals at the bottom.
// selection=single|multi sets selectionMode; checkboxes adds the checkbox column.
// cols above 20 adds more fN columns (from F12 on they repeat F1–F11's values),
// and vcols sets virtualizeColumns.
// hide=email,status hides those columns (columnVisibility), and
// pins=email:start,name:false sets columnPinning (start, end, or false to unpin).
// filter=<JSON> sets columnFilters, e.g. filter={"city":{"kind":"set","values":["Osaka"]}}
// (URL-encoded), and q=<text> sets quickFilter. Name (text), city, country, status
// (set), amount (number) and date (date) can be filtered; the pretend server
// (source=remote) filters too.
// groups adds column groups: Contact over Email and Location (City, Country), Order
// over Status, Amount and Date, and Extra over the fN columns: three header rows.
// detail=<n> adds detail panels (rowDetail: a small form and five rows of a nested
// table) and opens every nth row's (expanded); detail alone, or detail=0, opens none.
// tree=<n> makes the rows a tree through getParentId (tree alone: tree=10): every nth
// row is a top-level row and the n - 1 rows after it its children, except that every
// 10th child (the 1st, 11th, 21st, …) is the parent of the 3 rows after it, so the
// tree is three levels deep. Every row starts collapsed; treeopen expands every row
// with children. treeExpanded follows argus-tree-expanded-change.
// With source=remote, tree makes the pretend server's rows a tree through hasChildren
// and getChildren instead (any n is ignored): every 10th top-level row (r0, r10, …)
// has 5, 4, 3, 2, 1, 5, … children (r0 has 5, r10 4, …), ids r0.0, r0.1, …; the
// first child of each (r0.0) has 2 children again (r0.0.0, r0.0.1). The "#" column
// shows the row's id. Children are sorted and filtered like the rows and logged in
// window.__argusChildRequests; childlatency=<ms> (default: latency) is their delay,
// or hold to keep every answer until window.__argusAnswerChildren() is called;
// failchildren=<id> fails that row's first child request. treeopen expands every
// row with children.
const params = new URLSearchParams(location.search);
// A switch, not a lookup table: the query value never picks a function to call.
switch (params.get('theme')) {
  case 'default':
    await import('@argus-table/themes/default.css');
    break;
  case 'material':
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
    break;
  case 'fluent':
    await import('@argus-table/themes/fluent.css');
    break;
  case 'bootstrap':
    await import('@argus-table/themes/bootstrap.css');
    break;
  case 'minimal':
    await Promise.all([
      import('@fontsource/instrument-sans/400.css'),
      import('@fontsource/instrument-sans/500.css'),
      import('@fontsource/instrument-sans/600.css'),
      import('@argus-table/themes/minimal.css'),
    ]);
    // Loaded before the table renders, so screenshots never catch the fallback font.
    await Promise.all([
      document.fonts.load("400 15px 'Instrument Sans'"),
      document.fonts.load("500 15px 'Instrument Sans'"),
      document.fonts.load("600 11px 'Instrument Sans'"),
    ]);
    break;
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
  {
    id: 'name',
    header: 'Name',
    accessor: 'name',
    width: 180,
    pin: 'start',
    sortable: true,
    filter: 'text',
  },
  // Summary rows (pinned=…) have no email or status.
  { id: 'email', header: 'Email', width: 260, cell: (p, ctx) => (ctx.pinned ? '' : emailLink(p)) },
  {
    id: 'city',
    header: 'City',
    accessor: 'location.city',
    width: 120,
    sortable: true,
    filter: 'set',
  },
  {
    id: 'country',
    header: 'Country',
    accessor: 'location.country',
    width: 90,
    filter: 'set',
  },
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 110,
    filter: 'set',
    filterOptions: STATUSES,
    cell: (p, ctx) => (ctx.pinned ? '' : html`<span class="status">${p.status}</span>`),
  },
  {
    id: 'amount',
    header: 'Amount',
    accessor: 'amount',
    width: 120,
    align: 'end',
    sortable: true,
    filter: 'number',
    cell: (p) => p.amount.toFixed(2),
  },
  { id: 'date', header: 'Date', accessor: 'date', width: 120, filter: 'date' },
  // 9 named columns and the fN ones make up `cols`: 20 by default.
  ...Array.from({ length: Math.max(EXTRA_COLUMNS, colCount - 9) }, (_, i): ColumnDef<Person> => ({
    id: `f${String(i + 1)}`,
    header: `F${String(i + 1)}`,
    accessor: (p) => p.extra[i % EXTRA_COLUMNS],
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

// `notes`: a column of 1 to 5 lines of text, the same for a row in every browser,
// for measured row heights (`rowheight=auto`).
const NOTE = 'Call back about the order and confirm the delivery address.';
if (params.has('notes')) {
  allColumns.splice(2, 0, {
    id: 'note',
    header: 'Note',
    width: 200,
    wrap: true,
    cell: (p) =>
      Number.isNaN(p.index) ? '' : `${String(p.index)}: ${`${NOTE} `.repeat(p.index % 5)}`,
  });
}
// `wrap=a,b`: those columns wrap their text.
const wrapped = new Set(params.get('wrap')?.split(','));
for (const c of allColumns) if (wrapped.has(c.id)) c.wrap = true;

// Keep the pinned columns and trim scrolling ones to reach `cols`.
const scrolling = allColumns.filter((c) => !c.pin).slice(0, Math.max(0, colCount - 3));
const unpinned = params.get('pin') === 'none';
const columns = allColumns
  .filter((c) => c.pin === 'start' || scrolling.includes(c) || c.pin === 'end')
  .map((c) => (unpinned ? { ...c, pin: undefined } : c));

const table = document.createElement('argus-table') as ArgusTable<Person>;
table.setAttribute('aria-label', 'People');
table.density = density;
const rowHeight = params.get('rowheight');
if (rowHeight) table.rowHeight = rowHeight === 'auto' ? 'auto' : Number(rowHeight);
if (params.has('overscan')) table.overscan = Number(params.get('overscan'));
const selection = params.get('selection');
if (selection === 'single' || selection === 'multi') table.selectionMode = selection;
table.selectionCheckboxes = params.has('checkboxes');
table.virtualizeColumns = params.has('vcols');
const hidden = params.get('hide')?.split(',') ?? [];
if (hidden.length > 0) table.columnVisibility = Object.fromEntries(hidden.map((id) => [id, false]));
const pins = params.get('pins')?.split(',') ?? [];
if (pins.length > 0) {
  table.columnPinning = Object.fromEntries(
    pins.map((entry) => {
      const [id = '', side] = entry.split(':');
      return [id, side === 'start' || side === 'end' ? side : false];
    }),
  );
}
const filterParam = params.get('filter');
if (filterParam) table.columnFilters = JSON.parse(filterParam) as ColumnFilterState;
if (params.has('q')) table.quickFilter = params.get('q') ?? '';
table.columns = columns;
if (params.has('groups')) {
  const groups: ColumnGroup[] = [
    {
      id: 'contact',
      header: 'Contact',
      columns: ['email', { id: 'location', header: 'Location', columns: ['city', 'country'] }],
    },
    { id: 'order', header: 'Order', columns: ['status', 'amount', 'date'] },
    {
      id: 'extra',
      header: 'Extra',
      columns: columns.filter((c) => /^f\d+$/.test(c.id)).map((c) => c.id),
    },
  ];
  table.columnGroups = groups;
}
table.getRowId = (p) => p.id;
const dataStart = performance.now();
const people = makePeople(rowCount);
const dataMs = performance.now() - dataStart;
if (params.get('source') === 'remote') table.dataSource = remoteSource(people);
else table.data = people;
const pinnedSides = new Set(params.get('pinned')?.split(','));
if (pinnedSides.size > 0) {
  table.pinnedRows = {
    top: pinnedSides.has('top') ? [summary('avg', 'Average', people.length || 1)] : undefined,
    bottom: pinnedSides.has('bottom') ? [summary('sum', 'Total', 1)] : undefined,
  };
}
if (params.has('detail')) {
  const every = Number(params.get('detail'));
  table.rowDetail = ({ row }) =>
    html`<form
        class="detail-form"
        @submit=${(event: Event) => {
          event.preventDefault();
        }}
      >
        <label>Note for ${row.name} <input name="note" /></label>
        <button type="submit">Save</button>
      </form>
      <argus-table
        class="detail-lines"
        style="block-size: auto; max-block-size: 220px"
        aria-label=${`Lines of ${row.name}`}
        .columns=${lineColumns}
        .data=${linesOf(row)}
      ></argus-table>`;
  if (every > 0) {
    table.expanded = people.filter((_, i) => i % every === 0).map((p) => p.id);
    table.addEventListener('argus-expanded-change', (event) => {
      table.expanded = event.detail.expanded;
    });
  }
}
if (params.has('tree') && params.get('source') === 'remote') {
  // The first data column holds the indent, the toggle and the id: room for three levels.
  table.columns = columns.map((c) =>
    c.id === 'index' ? { ...c, accessor: 'id', align: undefined, width: 150 } : c,
  );
  table.treeExpanded = params.has('treeopen')
    ? people.flatMap((p) => (childCount(p) > 0 ? [p.id, `${p.id}.0`] : []))
    : [];
  table.addEventListener('argus-tree-expanded-change', (event) => {
    table.treeExpanded = event.detail.treeExpanded;
  });
} else if (params.has('tree')) {
  const size = Math.max(2, Number(params.get('tree')) || 10);
  table.getParentId = (p) => {
    const parent = treeParent(p.index, size);
    return parent === undefined ? null : `r${String(parent)}`;
  };
  // The first data column holds the indent and the toggle: room for three levels.
  table.columns = columns.map((c) => (c.id === 'index' ? { ...c, width: 150 } : c));
  const open = new Set<number>();
  if (params.has('treeopen')) {
    for (let i = 0; i < people.length; i++) {
      const parent = treeParent(i, size);
      if (parent !== undefined) open.add(parent);
    }
  }
  table.treeExpanded = [...open].map((i) => `r${String(i)}`);
  table.addEventListener('argus-tree-expanded-change', (event) => {
    table.treeExpanded = event.detail.treeExpanded;
  });
}
if (params.has('bench')) installBenchHooks(table, { dataMs });
else document.body.append(table);

declare global {
  interface Window {
    __argusRequests?: RowsRequest[];
    __argusChildRequests?: ChildrenRequest<Person>[];
    __argusAnswerChildren?: () => void;
  }
}

const lineColumns: ColumnDef<{ id: string; amount: number }>[] = [
  { id: 'id', header: 'Line', accessor: 'id', width: 80 },
  { id: 'amount', header: 'Amount', accessor: 'amount', width: 120, align: 'end', sortable: true },
];
const lines = new Map<string, { id: string; amount: number }[]>();

/** Five lines per person, the same array each time (a panel renders again on updates). */
function linesOf(person: Person) {
  let list = lines.get(person.id);
  if (!list) {
    list = Array.from({ length: 5 }, (_, i) => ({
      id: String(i + 1),
      amount: Math.round(person.amount * (i + 1)) / 10,
    }));
    lines.set(person.id, list);
  }
  return list;
}

/**
 * The index of a row's parent in `tree=<size>` (see the parameters above), or
 * `undefined` for a top-level row. Each row comes right after its previous sibling's
 * last descendant, so the data is in the tree's order (what the bench hooks expect).
 */
function treeParent(index: number, size: number): number | undefined {
  const offset = index % size;
  if (offset === 0) return undefined;
  // 0 for the 1st, 11th, … child; 1 to 3 for the three rows under it.
  const step = (offset - 1) % 10;
  return step >= 1 && step <= 3 ? index - step : index - offset;
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

/** What a column reads from a person: its accessor function or path. */
function readColumn(id: string, p: Person): unknown {
  const column = columns.find((c) => c.id === id);
  return typeof column?.accessor === 'function'
    ? column.accessor(p, 0)
    : column?.accessor
        ?.split('.')
        .reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], p);
}

/** A value as the pretend server searches it: strings and numbers only. */
const textOf = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value).toLowerCase() : '';

/** The pretend server's own filtering: enough of the filter kinds for tests and demos. */
function matches(value: unknown, filter: ColumnFilter): boolean {
  const empty = value === undefined || value === null || value === '';
  if (filter.kind === 'set') return filter.values.includes(empty ? null : (value as string));
  if (filter.op === 'empty') return empty;
  if (filter.op === 'notEmpty') return !empty;
  if (filter.kind === 'text') {
    const text = textOf(value);
    const needle = (filter.value ?? '').toLowerCase();
    if (filter.op === 'equals') return text === needle;
    return filter.op === 'startsWith' ? text.startsWith(needle) : text.includes(needle);
  }
  // Numbers, and ISO dates, which compare as text.
  const v = value as number | string;
  const from = filter.value;
  const to = filter.to;
  switch (filter.op) {
    case 'eq':
      return v === from;
    case 'ne':
      return v !== from;
    case 'lt':
      return from === undefined || v < from;
    case 'le':
      return from === undefined || v <= from;
    case 'gt':
      return from === undefined || v > from;
    case 'ge':
      return from === undefined || v >= from;
    case 'between':
      return (from === undefined || v >= from) && (to === undefined || v <= to);
  }
}

function filterPeople(people: Person[], filters: ColumnFilterState, quick: string): Person[] {
  const entries = Object.entries(filters);
  const words = quick.toLowerCase().split(/\s+/).filter(Boolean);
  if (entries.length === 0 && words.length === 0) return people;
  return people.filter(
    (p) =>
      entries.every(([id, filter]) => matches(readColumn(id, p), filter)) &&
      words.every((w) => columns.some((c) => textOf(readColumn(c.id, p)).includes(w))),
  );
}

/**
 * How many children a row has on the pretend server with `source=remote&tree`: 5, 4,
 * 3, 2, 1, 5, … for every 10th top-level row, 2 for the first child of each, else none.
 */
function childCount(p: Person): number {
  const depth = p.id.split('.').length - 1;
  if (depth === 0) return p.index % 10 === 0 ? 5 - ((p.index / 10) % 5) : 0;
  return depth === 1 && p.id.endsWith('.0') ? 2 : 0;
}

const childLists = new Map<string, Person[]>();

/**
 * A row's children on the pretend server: other people's details under the ids
 * `<parent id>.<i>`, the same objects on every request.
 */
function childrenOf(parent: Person): Person[] {
  let list = childLists.get(parent.id);
  if (!list) {
    const count = childCount(parent);
    const seed = parent.id
      .split('.')
      .reduce((sum, part) => sum * 31 + parseInt(part.replace('r', ''), 10), 7);
    list = Array.from({ length: count }, (_, i) => {
      const base = people[(seed + i * 37) % people.length] ?? parent;
      return { ...base, id: `${parent.id}.${String(i)}` };
    });
    childLists.set(parent.id, list);
  }
  return list;
}

/** Rows sorted by the first sort key, the way the pretend server sorts. */
function sortPeople(rows: Person[], sorting: SortState): Person[] {
  const [by] = sorting;
  if (!by) return rows;
  const dir = by.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = readColumn(by.id, a) as string | number;
    const y = readColumn(by.id, b) as string | number;
    return x < y ? -dir : x > y ? dir : 0;
  });
}

/** Waits `ms`, or with `'hold'` until `held`'s entry is called; rejects on `signal`. */
function wait(ms: number | 'hold', signal: AbortSignal, held?: Set<() => void>): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const release = () => {
      held?.delete(release);
      resolve();
    };
    if (ms === 'hold') held?.add(release);
    else timer = setTimeout(release, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      held?.delete(release);
      reject(signal.reason as Error);
    });
  });
}

/**
 * A pretend server over the people: sorts, filters, waits, honours `signal`, can fail
 * a page once. With `tree`, it answers children too (see the parameters above).
 */
function remoteSource(people: Person[]): DataSource<Person> {
  const latency = Number(params.get('latency') ?? 100);
  const withTotal = params.get('total') !== 'unknown';
  const failing = new Set(params.has('fail') ? [Number(params.get('fail'))] : []);
  const pageSize = 100;
  const sortedBy = new Map<string, Person[]>();
  const log: RowsRequest[] = (window.__argusRequests = []);
  const source: DataSource<Person> = {
    pageSize,
    getRows: async ({ start, end, sorting, filters, quickFilter, signal }) => {
      log.push({ start, end, sorting, filters, quickFilter, signal });
      await wait(latency, signal);
      if (failing.delete(Math.floor(start / pageSize))) throw new Error('Server error');
      const [by] = sorting;
      let rows = people;
      if (by) {
        const key = `${by.id}:${String(by.desc)}`;
        let sorted = sortedBy.get(key);
        if (!sorted) {
          sorted = sortPeople(people, sorting);
          sortedBy.set(key, sorted);
        }
        rows = sorted;
      }
      rows = filterPeople(rows, filters, quickFilter);
      return { rows: rows.slice(start, end), total: withTotal ? rows.length : undefined };
    },
  };
  if (!params.has('tree')) return source;
  const delay = params.get('childlatency');
  const childLatency = delay === 'hold' ? 'hold' : Number(delay ?? latency);
  const failingChildren = new Set(params.getAll('failchildren'));
  const held = new Set<() => void>();
  const childLog: ChildrenRequest<Person>[] = (window.__argusChildRequests = []);
  window.__argusAnswerChildren = () => {
    for (const release of [...held]) release();
  };
  return {
    ...source,
    hasChildren: (row) => childCount(row) > 0,
    getChildren: async (request) => {
      childLog.push(request);
      await wait(childLatency, request.signal, held);
      if (failingChildren.delete(request.parentId)) throw new Error('Server error');
      const { parent, sorting, filters, quickFilter } = request;
      return { rows: filterPeople(sortPeople(childrenOf(parent), sorting), filters, quickFilter) };
    },
  };
}
