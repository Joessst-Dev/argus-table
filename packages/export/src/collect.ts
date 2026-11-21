import type { ColumnAlign, GroupData, PluginHost, RowSection } from 'argus-table';
import type { ExportLabels } from './labels.js';
import type { DetailItem } from './detail.js';
import {
  plainText,
  toValue,
  type ExportColumn,
  type ExportHeaderCell,
  type ExportSheet,
  type ExportValue,
} from './sheet.js';

/** How a column is exported. */
export interface ExportColumnOptions<T = unknown> {
  /** The header text, in place of the column's. */
  header?: string;
  /**
   * The value to write in place of what the column read, for a formatted text or
   * a number from an object, say. Gets what the column read and the row.
   */
  value?: (value: unknown, row: T) => unknown;
  /** Leaves the column out. */
  exclude?: boolean;
}

declare module 'argus-table' {
  interface ColumnMeta<TData> {
    /**
     * How `@argus-table/export` exports the column. The `columns` option of
     * `tableExport()` and `exportTable()` wins field by field.
     */
    export?: ExportColumnOptions<TData>;
  }
}

/** A column of the detail rows (`ExportDetail`). */
export interface ExportDetailColumn<D = unknown> {
  id: string;
  /** The header text. */
  header: string;
  /** What to write for a detail row. Default: its property named `id`. */
  value?(item: D): unknown;
  /** Default `'start'`. */
  align?: ColumnAlign;
  /** Width in px, for Excel and PDF. Default `120`. */
  width?: number;
}

/**
 * The rows behind each row's detail panel (an order's lines), which the export
 * writes under their row: indented and grouped in Excel, indented in PDF, and in
 * CSV one line per detail row with the row's values repeated. The table's panels
 * aren't read: this is data the app supplies, with or without `rowDetail`.
 */
export interface ExportDetail<T = unknown, D = unknown> {
  /** The detail rows' columns, in order. */
  columns: readonly ExportDetailColumn<D>[];
  /**
   * A row's detail rows; may return a promise (to fetch them). Called once per
   * exported body row, in order and at most 6 at a time; not for pinned rows, nor
   * for rows the table's `rowExpandable` rejects. `rowId` is the id the export
   * uses for the row (`getRowId`'s, else its index); `signal` is the export's.
   */
  rows(
    row: T,
    context: { rowId: string; signal: AbortSignal | undefined },
  ): readonly D[] | Promise<readonly D[]>;
}

/** Which rows and columns an export holds. */
export interface CollectOptions<T = unknown> {
  /**
   * `'view'` (default): every row the table shows, in its order, after its
   * filters. `'selected'`: only the selected ones (`selection`), in that order.
   */
  rows?: 'view' | 'selected';
  /** Includes the pinned rows, above and below. Default: `true` with `rows: 'view'`, `false` with `'selected'`. */
  pinnedRows?: boolean;
  /** Includes the hidden columns, in their place in the column order. Default `false`. */
  hiddenColumns?: boolean;
  /** Includes the group header rows (`columnGroups`), unless hidden columns are included. Default `true`. */
  headerGroups?: boolean;
  /**
   * With a `dataSource`: fetches every row through `getRows`, a page at a time,
   * with the table's sort, filters and quick filter. Otherwise only the loaded
   * rows are exported. Default `false`.
   */
  allRows?: boolean;
  /**
   * Options per column id. A column's own `meta.export` applies too; these win
   * field by field.
   */
  columns?: Record<string, ExportColumnOptions<T> | undefined>;
  /** Stops the export (and the `getRows` requests of `allRows`). */
  signal?: AbortSignal;
  /**
   * Each row's detail rows, written under it (see `ExportDetail`). `false` turns
   * off a `detail` given to `tableExport()` for one export.
   */
  detail?: ExportDetail<T> | false;
}

/** The names of the columns and groups (their headers' text), by column id and group id. */
export interface HeaderTexts {
  columns: Map<string, string>;
  groups: Map<string, string>;
}

/** Reads the table through its plugin host into a sheet. */
export async function collect<T>(
  host: PluginHost<T>,
  headers: HeaderTexts,
  labels: Pick<ExportLabels, 'groupRow' | 'emptyGroup'>,
  options: CollectOptions<T> = {},
): Promise<ExportSheet> {
  const own: Record<string, ExportColumnOptions<T> | undefined> = {};
  for (const c of host.columns()) {
    const meta = c.meta?.export as ExportColumnOptions<T> | undefined;
    const given = options.columns?.[c.id];
    if (meta || given) own[c.id] = { ...meta, ...given };
  }
  const infos = host
    .columns()
    .filter((c) => (!c.hidden || options.hiddenColumns) && !own[c.id]?.exclude);
  const columns: ExportColumn[] = infos.map((c) => ({
    id: c.id,
    header: own[c.id]?.header ?? headers.columns.get(c.id) ?? c.id,
    align: c.align,
    width: c.width,
    pin: c.pin,
  }));

  const ids = new Set(columns.map((c) => c.id));
  const groups =
    options.headerGroups === false || infos.some((c) => c.hidden)
      ? []
      : host
          .headerGroups()
          .map((row) => {
            const cells: (ExportHeaderCell & { id: string | undefined })[] = [];
            for (const { groupId, columns: under } of row) {
              const span = under.filter((id) => ids.has(id)).length;
              if (!span) continue;
              const prev = cells.at(-1);
              // A group split by the pinned sides is one cell in a file, as are fillers side by side.
              if (prev && prev.id === groupId) prev.span += span;
              else {
                const text = groupId === undefined ? '' : (headers.groups.get(groupId) ?? groupId);
                cells.push({ id: groupId, text, span });
              }
            }
            return cells;
          })
          .filter((row) => row.some((c) => c.id !== undefined))
          .map((row) => row.map(({ text, span }) => ({ text, span })));

  const valueOf = (raw: unknown, id: string, row: () => T | undefined): ExportValue => {
    const map = own[id]?.value;
    return toValue(map ? map(raw, row() as T) : raw);
  };
  const rows: ExportValue[][] = [];
  // The body row and its id behind each entry of `rows`, for its detail rows.
  const items: (DetailItem<T> | undefined)[] = [];
  // Each entry's depth and kind while grouped; dropped when no group row was written.
  const outline: { depth: number; group: boolean }[] = [];
  const pushRow = (values: ExportValue[], item: DetailItem<T> | undefined, depth = 0) => {
    rows.push(values);
    items.push(item);
    outline.push({ depth, group: false });
  };
  /** A group row: its value and count in the first column, its totals in the others. */
  const pushGroup = (
    group: { value: unknown; count: number; totals?: Readonly<Record<string, unknown>> },
    depth: number,
  ) => {
    const plain = toValue(group.value);
    const value = plain === null || plain === '' ? labels.emptyGroup : plainText(plain);
    const first = labels.groupRow({ value, count: group.count });
    rows.push(columns.map((c, i) => (i ? toValue(group.totals?.[c.id]) : first)));
    items.push(undefined);
    outline.push({ depth, group: true });
  };
  const pinned = (section: RowSection) => {
    if (!(options.pinnedRows ?? options.rows !== 'selected')) return;
    for (let i = 0, n = host.rowCount(section); i < n; i++) {
      pushRow(
        columns.map((c) => valueOf(host.value(i, c.id, section), c.id, () => host.row(i, section))),
        undefined,
      );
    }
  };

  const el = host.element;
  const selected = options.rows === 'selected' ? new Set(el.selection) : undefined;
  const source = el.dataSource;
  const inMemory = source ? undefined : host.groupedRows();
  // A data source the server groups (not a tree): the columns it groups by, as
  // the table sends them. Selected rows go flat.
  const grouping =
    source && !selected && !(source.hasChildren && source.getChildren)
      ? [...new Set(host.grouping())].filter((id) => host.column(id)?.groupable)
      : [];
  const remoteGroups = grouping.length > 0;
  pinned('top');
  if (options.allRows && source) {
    const size = Math.max(1, source.pageSize ?? 100);
    const signal = options.signal ?? new AbortController().signal;
    // Grouped on the server: the top-level groups.
    for (let start = 0; ; start += size) {
      signal.throwIfAborted();
      const response = await source.getRows({
        start,
        end: start + size,
        sorting: el.sorting,
        filters: el.columnFilters,
        quickFilter: el.quickFilter,
        grouping,
        groupPath: [],
        signal,
      });
      const { rows: page, total } = response;
      const groupsPage: readonly GroupData[] | undefined = remoteGroups ? response.groups : [];
      // As the table does: groups without their counts are the wrong answer.
      if (
        !groupsPage ||
        groupsPage.some((g) => typeof (g as Partial<GroupData> | null)?.count !== 'number')
      ) {
        throw new TypeError('argus-table export: getRows() answered rows for groups.');
      }
      for (const group of groupsPage) pushGroup(group, 0);
      page.forEach((row, k) => {
        if (remoteGroups) return;
        const index = start + k;
        const rowId = el.getRowId ? el.getRowId(row, index) : String(index);
        if (selected && !selected.has(rowId)) return;
        pushRow(
          columns.map((c) => valueOf(host.readValue(row, c.id, index), c.id, () => row)),
          { row, rowId },
        );
      });
      const got = remoteGroups ? groupsPage.length : page.length;
      if (got < size || (total !== undefined && start + size >= total)) break;
    }
  } else if (inMemory) {
    // Grouped rows in memory: every group and every row, closed groups' too, in
    // the grouped order; selected rows without their groups.
    for (const entry of inMemory) {
      if (entry.group) {
        if (!selected) pushGroup(entry.group, entry.depth);
        continue;
      }
      if (selected && !selected.has(entry.id)) continue;
      const { index, id, row } = entry;
      pushRow(
        columns.map((c) => valueOf(host.readValue(row, c.id, index), c.id, () => row)),
        { row, rowId: id },
        selected ? 0 : entry.depth,
      );
    }
  } else {
    for (let i = 0, n = host.rowCount(); i < n; i++) {
      const group = remoteGroups ? host.group(i) : undefined;
      if (group) {
        pushGroup(group, group.depth);
        continue;
      }
      const id = host.rowId(i);
      // A dataSource row that isn't loaded.
      if (id === undefined || (selected && !selected.has(id))) continue;
      pushRow(
        columns.map((c) => valueOf(host.value(i, c.id), c.id, () => host.row(i))),
        { row: host.row(i) as T, rowId: id },
        remoteGroups ? host.rowDepth(i) : 0,
      );
    }
  }
  pinned('bottom');
  const sheet: ExportSheet = {
    columns,
    groups,
    rows,
    ...(outline.some((o) => o.group) ? { outline } : {}),
  };
  const detail = options.detail;
  if (!detail) return sheet;
  // Loaded on first use, like the Excel and PDF writers: most exports have no detail rows.
  const { collectDetails } = await import('./detail.js');
  return {
    ...sheet,
    detail: {
      columns: detail.columns.map((c) => ({
        id: c.id,
        header: c.header,
        align: c.align ?? 'start',
        width: c.width ?? 120,
        pin: undefined,
      })),
      rows: await collectDetails(items, detail, el.rowExpandable, options.signal),
    },
  };
}
