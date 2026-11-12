import { html, nothing, render } from 'lit';
import type { ArgusPlugin, CellContent, CellContext, ColumnDef, PluginHost } from 'argus-table';
import {
  compileColumns,
  display,
  functionTable,
  nameOf,
  parseOrError,
  rowSource,
  type Compiled,
  type FormulaFunction,
  type RowSource,
} from './columns.js';
import { FormulaError, FormulaSyntaxError, isFormulaError } from './engine/errors.js';
import type { FormulaNode } from './engine/parse.js';
import type { Mode, Outcome } from './editor/session.js';
import { fire } from './events.js';
import { adoptStyles } from './styles.js';

export type { FormulaFunction } from './columns.js';

export interface FormulasOptions {
  /**
   * Functions of your own, by name: `{ VAT: { fn: (n) => Number(n) * 0.19, args: [1, 1] } }`.
   * Names are case-insensitive and may replace a built-in one.
   */
  functions?: Readonly<Record<string, FormulaFunction>>;
  /** Shows `ƒx` before the header of each formula column. Default: `true`. */
  marker?: boolean;
  /**
   * What users can do with formulas from the column menu of `headerMenu()`:
   * - `'view'` (default): "View formula…" on formula columns opens the editor read-only.
   * - `'edit'`: "Edit formula…", "Rename…" and "Delete column" on formula
   *   columns, and "Add formula column…" on every column. Changes are proposed
   *   through `argus-formula-column-add`, `-change` and `-remove`; apply them
   *   by setting `columns` to `event.detail.columns`.
   * - `'none'`: nothing in the menu.
   */
  editing?: 'edit' | 'view' | 'none';
}

/** An item for `headerMenu()`'s column menu (its `HeaderMenuItem`, by shape: no import needed). */
interface MenuItem {
  label: string;
  detail?: string;
  danger?: boolean;
  run(): void;
}

interface MenuGroup {
  label?: string;
  items: MenuItem[];
}

/** The plugin, with the method `headerMenu()` asks for column menu items. */
export type FormulasPlugin<T = unknown> = ArgusPlugin<T> & {
  headerMenuItems(columnId: string, host: PluginHost<T>): MenuGroup[];
};

interface TableState<T> {
  host: PluginHost<T>;
  /** The columns as the plugin got them (before its own changes). */
  defs: readonly ColumnDef<T>[];
  compiled: Map<string, Compiled<T>>;
  /** Columns whose formula was reported as broken, by id and formula. */
  warned: Set<string>;
  /** While the editor is open: the column whose header holds it. */
  editing: string | undefined;
  /** The element the editor renders into, placed in that header's content. */
  anchor: HTMLElement | undefined;
  /** The rows whole columns (`[[name]]`) cover; a new one when they change. */
  rows: RowSource<T>;
  /** What `rows` was made for (see `rowsKey`). */
  rowsKey: { data: unknown; rest: string } | undefined;
}

/**
 * What the rows of whole columns depend on: the data, the filters (but those on
 * the columns using whole columns, `dependent`), the quick filter and the
 * columns shown (which it searches).
 */
function rowsKey<T>(host: PluginHost<T>, compiled: ReadonlyMap<string, Compiled<T>>) {
  const el = host.element;
  const filters = Object.entries(el.columnFilters).filter(([id]) => !compiled.get(id)?.ranges);
  return {
    data: el.dataSource ?? el.data,
    rest: JSON.stringify([filters, el.quickFilter, el.columnVisibility]),
  };
}

/** The table's properties the rows of whole columns depend on (see `rowsKey`). */
const ROW_PROPERTIES = ['data', 'dataSource', 'columnFilters', 'quickFilter', 'columnVisibility'];

const usesRanges = <T>(compiled: ReadonlyMap<string, Compiled<T>>) =>
  [...compiled.values()].some((c) => c.ranges);

const sameKey = (a: TableState<never>['rowsKey'], b: TableState<never>['rowsKey']) =>
  a?.data === b?.data && a?.rest === b?.rest;

const errorContent = (error: FormulaError) =>
  html`<span class="argus-formula-error" title=${error.message}>${error.code}</span>`;

/**
 * Formula columns for `<argus-table>`: a column with a `formula` computes its
 * value per row from other columns, as in a spreadsheet.
 *
 * ```ts
 * import { formulas } from '@argus-table/formulas';
 * table.plugins = [formulas()];
 * table.columns = [
 *   { id: 'price', header: 'Price', accessor: 'price' },
 *   { id: 'qty', header: 'Quantity', accessor: 'qty' },
 *   { id: 'total', header: 'Total', formula: '[price] * [Quantity]', sortable: true },
 * ];
 * ```
 *
 * Columns are named in brackets by id or by their text header. Errors are
 * cell values (`#DIV/0!`, `#VALUE!`, `#REF!`, `#NAME?`, `#NUM!`, `#N/A`,
 * `#CYCLE!`, and `#ERROR!` for a formula that can't be read), and sort last.
 * Formulas are compiled once, never evaluated as code, and results are cached
 * per row. With `headerMenu()` (list `formulas()` first), the column menu views
 * or edits formulas (see `editing`); the editor loads when it first opens. One
 * plugin can serve several tables.
 */
export function formulas<T = unknown>(options: FormulasOptions = {}): FormulasPlugin<T> {
  const functions = functionTable(options.functions);
  const marker = options.marker ?? true;
  const editing = options.editing ?? 'view';
  const parsed = new Map<string, FormulaNode | FormulaSyntaxError>();
  const states = new WeakMap<HTMLElement, TableState<T>>();

  const parseOnce = (formula: string): FormulaNode | FormulaSyntaxError => {
    let tree = parsed.get(formula);
    if (!tree) {
      tree = parseOrError(formula);
      parsed.set(formula, tree);
    }
    return tree;
  };

  const stateOf = (host: PluginHost<T>): TableState<T> => {
    let state = states.get(host.element);
    if (!state) {
      state = {
        host,
        defs: [],
        compiled: new Map(),
        warned: new Set(),
        editing: undefined,
        anchor: undefined,
        rows: rowSource(host),
        rowsKey: undefined,
      };
      states.set(host.element, state);
    }
    return state;
  };

  const cellFor =
    (def: ColumnDef<T>, compiled: Compiled<T>) =>
    (row: T, context: CellContext<T>): CellContent => {
      // A cache hit: the table read the value (through the accessor) first.
      const value = compiled.result(row, context.index);
      if (isFormulaError(value)) return errorContent(value);
      return def.cell ? def.cell(row, context) : display(value);
    };

  const headerFor =
    (def: ColumnDef<T>, mark: boolean, anchor: HTMLElement | undefined, host: PluginHost<T>) =>
    () => {
      const raw = typeof def.header === 'function' ? def.header() : def.header;
      // Through the table, so framework content (React, Vue) renders in our template too.
      const own = host.content ? host.content(raw) : raw;
      if (!mark) return html`${own ?? nothing}${anchor ?? nothing}`;
      return html`<span class="argus-formula-header"
          ><span class="argus-formula-mark" aria-hidden="true">ƒx</span
          ><span class="argus-formula-label">${own ?? nothing}</span></span
        >${anchor ?? nothing}`;
    };

  /**
   * Opens the editor in the header of `columnId` (a modal dialog in the
   * header's content, so it takes the table's tokens), then proposes what the
   * user saved. Focus goes back to that header.
   */
  const openEditor = async (
    state: TableState<T>,
    mode: Mode,
    columnId: string,
    focus: 'name' | 'formula',
  ) => {
    const { host } = state;
    if (state.editing !== undefined) return;
    state.anchor ??= Object.assign(document.createElement('span'), {
      className: 'argus-formula-editor-host',
    });
    const container = state.anchor;
    state.editing = columnId;
    host.invalidateColumns();
    let outcome: Outcome<T> | undefined;
    try {
      const [{ edit }] = await Promise.all([
        import('./editor/session.js'),
        host.element.updateComplete,
      ]);
      if (container.isConnected) {
        outcome = await edit({
          host,
          defs: state.defs,
          mode,
          columnId,
          focus,
          container,
          functions,
          own: options.functions ?? {},
          parse: parseOnce,
        });
      }
    } finally {
      state.editing = undefined;
      host.invalidateColumns();
    }
    if (outcome?.kind === 'add') {
      fire(host.element, 'argus-formula-column-add', {
        column: outcome.column,
        columns: outcome.columns,
      });
      host.announce(`Formula column ${nameOf(outcome.column)} added`);
    } else if (outcome?.kind === 'change') {
      fire(host.element, 'argus-formula-column-change', {
        column: outcome.column,
        previous: outcome.previous,
        columns: outcome.columns,
      });
      host.announce(`${nameOf(outcome.column)} changed`);
    }
    host.focusHeader(columnId);
  };

  const remove = (state: TableState<T>, columnId: string) => {
    const { host, defs } = state;
    const at = defs.findIndex((d) => d.id === columnId);
    const column = defs[at];
    if (!column) return;
    fire(host.element, 'argus-formula-column-remove', {
      column,
      columns: defs.filter((d) => d.id !== columnId),
    });
    host.announce(`${nameOf(column)} deleted`);
    const neighbour = defs[at + 1] ?? defs[at - 1];
    if (neighbour) host.focusHeader(neighbour.id);
  };

  return {
    name: 'formulas',

    connect(host) {
      const state = stateOf(host);
      adoptStyles(host.element);
      // A table removed with the editor open takes the dialog with it: it never
      // reports closing, and keeps its `open` attribute. Drop it, so it doesn't
      // show inline after a reconnect and the editor can open again.
      return () => {
        if (state.anchor) render(nothing, state.anchor);
        state.editing = undefined;
      };
    },

    willUpdate(changed, host) {
      // Other rows for whole columns: the columns using them compute again.
      if (!ROW_PROPERTIES.some((name) => changed.has(name))) return;
      const state = stateOf(host);
      if (!usesRanges(state.compiled)) return;
      if (!sameKey(rowsKey(host, state.compiled), state.rowsKey)) host.invalidateColumns();
    },

    columns(defs, host) {
      const state = stateOf(host);
      state.host = host;
      state.defs = defs;
      const editingId = state.editing;
      const hasFormulas = defs.some((def) => def.formula !== undefined);
      if (!hasFormulas && editingId === undefined) {
        state.compiled = new Map();
        return defs;
      }
      // Rows other than those the columns last read (or none read yet): a new source.
      if (!sameKey(rowsKey(host, state.compiled), state.rowsKey)) state.rows = rowSource(host);
      const compiled = hasFormulas
        ? compileColumns(defs, {
            functions,
            parse: parseOnce,
            previous: state.compiled,
            rows: state.rows,
            onBroken(def, error) {
              const key = `${def.id}\u0000${def.formula ?? ''}`;
              if (state.warned.has(key)) return;
              state.warned.add(key);
              console.warn(`argus-table: formula column "${def.id}": ${error.message}`);
            },
          })
        : new Map<string, Compiled<T>>();
      state.compiled = compiled;
      state.rowsKey = usesRanges(compiled) ? rowsKey(host, compiled) : undefined;
      // The server sorts and filters with `dataSource`, and it doesn't know the formulas.
      const remote = host.element.dataSource !== undefined;
      return defs.map((def) => {
        const c = compiled.get(def.id);
        const anchor = def.id === editingId ? state.anchor : undefined;
        if (!c) return anchor ? { ...def, header: headerFor(def, false, anchor, host) } : def;
        const numeric = c.type === 'number' || c.type === 'date';
        return {
          ...def,
          accessor: c.accessor,
          cell: cellFor(def, c),
          align: def.align ?? (numeric ? 'end' : undefined),
          header: marker || anchor ? headerFor(def, marker, anchor, host) : def.header,
          sortable: remote ? false : def.sortable,
          filter: remote ? undefined : def.filter,
        };
      });
    },

    headerMenuItems(columnId, host) {
      if (editing === 'none') return [];
      const state = stateOf(host);
      const def = state.defs.find((d) => d.id === columnId);
      if (!def) return [];
      const groups: MenuGroup[] = [];
      if (def.formula !== undefined) {
        groups.push({
          label: 'Formula',
          items:
            editing === 'edit'
              ? [
                  {
                    label: 'Edit formula…',
                    detail: def.formula,
                    run: () => void openEditor(state, 'edit', columnId, 'formula'),
                  },
                  {
                    label: 'Rename…',
                    run: () => void openEditor(state, 'edit', columnId, 'name'),
                  },
                  {
                    label: 'Delete column',
                    danger: true,
                    run: () => {
                      remove(state, columnId);
                    },
                  },
                ]
              : [
                  {
                    label: 'View formula…',
                    detail: def.formula,
                    run: () => void openEditor(state, 'view', columnId, 'formula'),
                  },
                ],
        });
      }
      if (editing === 'edit') {
        groups.push({
          items: [
            {
              label: 'Add formula column…',
              run: () => void openEditor(state, 'add', columnId, 'name'),
            },
          ],
        });
      }
      return groups;
    },
  };
}
