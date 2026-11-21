import type { ArgusPlugin, ArgusTable, ColumnDef, ColumnGroup, PluginHost } from 'argus-table';
import { collect, type CollectOptions, type HeaderTexts } from './collect.js';
import { toCsv, type CsvOptions } from './csv.js';
import { resolveLabels, type ExportFormat, type ExportLabels } from './labels.js';
import type { PdfOptions } from './pdf/pdf.js';
import type { XlsxOptions } from './xlsx/xlsx.js';

/** What to export and how: the rows and columns, and each format's options. */
export type ExportOptions<T = unknown> = CollectOptions<T> & CsvOptions & XlsxOptions & PdfOptions;

/** Options of `tableExport()`: its column menu items, labels, and defaults for every export. */
export interface TableExportOptions<T = unknown> extends ExportOptions<T> {
  /** The formats the column menu offers, in this order. Default: CSV, Excel and PDF. */
  formats?: readonly ExportFormat[];
  /** Adds the formats to `headerMenu()`'s column menu. Default `true`. */
  menu?: boolean;
  /** The file name for downloads, without an extension. Default `table`. */
  filename?: string;
  /** The menu items, PDF footer and announcements in another language. Keys left out stay English. */
  labels?: Partial<ExportLabels>;
}

/** An item for `headerMenu()`'s column menu (its `HeaderMenuItem`, by shape: no import needed). */
export interface ExportMenuItem {
  label: string;
  run(): void;
}

/** A group of items for `headerMenu()`'s column menu (its `HeaderMenuGroup`, by shape). */
export interface ExportMenuGroup {
  label?: string;
  items: readonly ExportMenuItem[];
}

/** The plugin, with the method `headerMenu()` asks for column menu items. */
export type ExportPlugin<T = unknown> = ArgusPlugin<T> & {
  headerMenuItems(columnId: string, host: PluginHost<T>): ExportMenuGroup[];
};

/** A table's state; the host and options are typed by the table's rows where they're read. */
interface TableState {
  host: unknown;
  /**
   * The columns and groups the hooks saw, named at export time (`host.headerText`).
   * Kept while the table is disconnected: the hooks only run again when columns change.
   */
  columns: readonly unknown[];
  groups: ColumnGroup<unknown>[];
  options: unknown;
  labels: ExportLabels;
  /** Whether a `tableExport()` is connected to the table. */
  connected: boolean;
}

/** Each table's state, by element: one plugin can serve several tables. */
const tables = new WeakMap<Element, TableState>();

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The groups among a group list's entries, nested ones too. */
function groupsIn(
  groups: readonly (string | ColumnGroup<unknown>)[],
  into: ColumnGroup<unknown>[] = [],
): ColumnGroup<unknown>[] {
  for (const group of groups) {
    if (typeof group === 'string') continue;
    into.push(group);
    groupsIn(group.columns, into);
  }
  return into;
}

/** The names of the columns and groups the plugin saw, read now through the host. */
function headerTexts<T>(host: PluginHost<T>, state: TableState): HeaderTexts {
  const texts: HeaderTexts = { columns: new Map(), groups: new Map() };
  for (const def of state.columns as readonly ColumnDef<T, unknown>[]) {
    const text = host.headerText(def);
    if (text !== undefined) texts.columns.set(def.id, text);
  }
  for (const group of state.groups) {
    const text = host.headerText(group);
    if (text !== undefined && !texts.groups.has(group.id)) texts.groups.set(group.id, text);
  }
  return texts;
}

/**
 * Export for `<argus-table>`: the rows and columns it shows, as CSV, Excel
 * (.xlsx) or PDF, written in the browser with no dependencies. Add it to
 * `plugins`, then call `exportTable()` or `downloadTable()` from your own
 * buttons; with `headerMenu()` the column menu offers the formats too.
 *
 * Columns and groups are named by their headers' text (a header function's text
 * mode, `HeaderContext`), else by their ids. A column's `meta.export` sets how it
 * is exported. The options here are defaults for every export of the table.
 */
export function tableExport<T = unknown>(options: TableExportOptions<T> = {}): ExportPlugin<T> {
  const labels = resolveLabels(options.labels);
  const stateOf = (host: PluginHost<T>) => {
    let state = tables.get(host.element);
    if (!state) {
      state = {
        host,
        columns: [],
        groups: [],
        options,
        labels,
        connected: false,
      };
      tables.set(host.element, state);
    }
    return state;
  };
  return {
    name: 'export',
    connect(host) {
      const state = stateOf(host);
      // This instance's options win, also over another tableExport() the table had.
      Object.assign(state, { host, options, labels, connected: true });
      return () => {
        if (state.options === options) state.connected = false;
      };
    },
    columns(defs, host) {
      stateOf(host).columns = defs;
      return undefined;
    },
    columnGroups(groups, host) {
      stateOf(host).groups = groupsIn(groups);
      return undefined;
    },
    headerMenuItems(_columnId, host) {
      if (options.menu === false) return [];
      const formats = options.formats ?? (['csv', 'xlsx', 'pdf'] as const);
      const group = (label: string, withDetail: boolean): ExportMenuGroup => ({
        label,
        items: formats.map((format) => ({
          label: labels[format],
          run: () => {
            // With a detail option, the first group exports without details.
            downloadTable(host.element, format, withDetail ? {} : { detail: false }).catch(
              (error: unknown) => {
                console.error(error);
                host.announce(labels.failed);
              },
            );
          },
        })),
      });
      return options.detail
        ? [group(labels.group, false), group(labels.withDetails, true)]
        : [group(labels.group, true)];
    },
  };
}

/** The language the table is in, for dates in a PDF. */
const langOf = (table: Element) => table.closest('[lang]')?.getAttribute('lang') ?? undefined;

async function run<T>(table: ArgusTable<T>, format: ExportFormat, options: ExportOptions<T>) {
  const state = tables.get(table);
  if (!state?.connected) {
    throw new Error('argus-table export: add tableExport() to the table’s plugins first.');
  }
  await table.updateComplete;
  const merged = { ...(state.options as TableExportOptions<T>), ...options };
  const host = state.host as PluginHost<T>;
  const sheet = await collect(host, headerTexts(host, state), merged, state.labels);
  merged.signal?.throwIfAborted();
  let blob: Blob;
  if (format === 'csv') {
    blob = new Blob([toCsv(sheet, merged)], { type: 'text/csv;charset=utf-8' });
  } else if (format === 'xlsx') {
    const { toXlsx } = await import('./xlsx/xlsx.js');
    blob = new Blob([await toXlsx(sheet, merged)], { type: XLSX });
  } else {
    const { toPdf } = await import('./pdf/pdf.js');
    const text = { footer: state.labels.page, locale: langOf(table) };
    blob = new Blob([await toPdf(sheet, merged, text)], { type: 'application/pdf' });
  }
  return { blob, rows: sheet.rows.length, state };
}

/**
 * The table's rows and columns as a file: by default every column shown, in its
 * order, and every row shown, sorted and filtered, with the pinned rows. The
 * XLSX and PDF writers load on first use. Rejects when the table has no
 * `tableExport()` plugin, when `signal` aborts, or when `getRows` fails (`allRows`).
 */
export async function exportTable<T>(
  table: ArgusTable<T>,
  format: ExportFormat,
  options: ExportOptions<T> = {},
): Promise<Blob> {
  return (await run(table, format, options)).blob;
}

/**
 * Exports the table (see `exportTable()`) and has the browser download the file,
 * named `filename` (default the plugin's, else `table`) with the format's
 * extension. Announces the number of rows to screen readers.
 */
export async function downloadTable<T>(
  table: ArgusTable<T>,
  format: ExportFormat,
  options: ExportOptions<T> & { filename?: string } = {},
): Promise<void> {
  const { blob, rows, state } = await run(table, format, options);
  const name = options.filename ?? (state.options as TableExportOptions<T>).filename ?? 'table';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name.toLowerCase().endsWith(`.${format}`) ? name : `${name}.${format}`;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
  (state.host as PluginHost<T>).announce(state.labels.exported({ rows, format }));
}
