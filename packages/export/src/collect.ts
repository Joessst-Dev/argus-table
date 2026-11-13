import type { PluginHost, RowSection } from 'argus-table';
import {
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
  /** Options per column id. */
  columns?: Record<string, ExportColumnOptions<T> | undefined>;
  /** Stops the export (and the `getRows` requests of `allRows`). */
  signal?: AbortSignal;
}

/** The text headers the plugin saw, by column id and group id. */
export interface HeaderTexts {
  columns: Map<string, string>;
  groups: Map<string, string>;
}

/** Reads the table through its plugin host into a sheet. */
export async function collect<T>(
  host: PluginHost<T>,
  headers: HeaderTexts,
  options: CollectOptions<T> = {},
): Promise<ExportSheet> {
  const own = options.columns ?? {};
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
  const pinned = (section: RowSection) => {
    if (!(options.pinnedRows ?? options.rows !== 'selected')) return;
    for (let i = 0, n = host.rowCount(section); i < n; i++) {
      rows.push(
        columns.map((c) => valueOf(host.value(i, c.id, section), c.id, () => host.row(i, section))),
      );
    }
  };

  const el = host.element;
  const selected = options.rows === 'selected' ? new Set(el.selection) : undefined;
  const source = el.dataSource;
  pinned('top');
  if (options.allRows && source) {
    const size = Math.max(1, source.pageSize ?? 100);
    const signal = options.signal ?? new AbortController().signal;
    for (let start = 0; ; start += size) {
      signal.throwIfAborted();
      const { rows: page, total } = await source.getRows({
        start,
        end: start + size,
        sorting: el.sorting,
        filters: el.columnFilters,
        quickFilter: el.quickFilter,
        signal,
      });
      page.forEach((row, k) => {
        const index = start + k;
        if (selected && !selected.has(el.getRowId ? el.getRowId(row, index) : String(index)))
          return;
        rows.push(columns.map((c) => valueOf(host.readValue(row, c.id, index), c.id, () => row)));
      });
      if (page.length < size || (total !== undefined && start + size >= total)) break;
    }
  } else {
    for (let i = 0, n = host.rowCount(); i < n; i++) {
      const id = host.rowId(i);
      // A dataSource row that isn't loaded.
      if (id === undefined || (selected && !selected.has(id))) continue;
      rows.push(columns.map((c) => valueOf(host.value(i, c.id), c.id, () => host.row(i))));
    }
  }
  pinned('bottom');
  return { columns, groups, rows };
}
