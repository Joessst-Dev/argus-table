import { html, nothing } from 'lit';
import type { ArgusPlugin, CellContent, CellContext, ColumnDef, PluginHost } from 'argus-table';
import { checkNumber, formatNumber } from './engine/coerce.js';
import { compile, type Evaluate } from './engine/compile.js';
import { FormulaError, FormulaSyntaxError, isFormulaError } from './engine/errors.js';
import { BUILTINS, type FunctionTable, type ValueType } from './engine/functions/index.js';
import { analyze } from './engine/graph.js';
import { inferType } from './engine/infer.js';
import { parse, refsOf, type FormulaNode } from './engine/parse.js';
import { adoptStyles } from './styles.js';

/** A function of your own for formulas, set through the `functions` option. */
export interface FormulaFunction {
  /**
   * Gets the argument values (numbers, text, booleans, dates, or blanks as
   * `null`/`undefined`). If an argument is an error, the cell shows it and `fn`
   * doesn't run. A throw shows `#VALUE!`; a non-finite number `#NUM!`.
   */
  fn: (...args: unknown[]) => unknown;
  /** Fewest and most arguments; without a most, any number from the fewest up. Default: any number. */
  args?: readonly [min: number, max?: number];
  /** What it returns, for the column's alignment: numbers and dates align to the end. */
  returns?: 'number' | 'text' | 'boolean' | 'date';
}

export interface FormulasOptions {
  /**
   * Functions of your own, by name: `{ VAT: { fn: (n) => Number(n) * 0.19, args: [1, 1] } }`.
   * Names are case-insensitive and may replace a built-in one.
   */
  functions?: Readonly<Record<string, FormulaFunction>>;
  /** Shows `ƒx` before the header of each formula column. Default: `true`. */
  marker?: boolean;
}

interface Scope<T> {
  row: T;
  index: number;
}

/** A formula column, compiled: kept while its formula and the columns it reads stay the same. */
interface Compiled<T> {
  formula: string;
  /** What it was built from, compared by identity: per name, the column and how that column reads. */
  inputs: readonly unknown[];
  type: ValueType;
  /** The value for a row, errors included, cached per row object. */
  result: (row: T, index: number) => unknown;
  /** The column's accessor: the value, or `undefined` for an error (it sorts last). */
  accessor: (row: T, index: number) => unknown;
}

interface TableState<T> {
  compiled: Map<string, Compiled<T>>;
  /** Columns whose formula was reported as broken, by id and formula. */
  warned: Set<string>;
}

const NAME = /^[A-Za-z_][A-Za-z0-9_.]*$/;

/** The built-in functions with the caller's own on top. */
function functionTable(own: FormulasOptions['functions'] = {}): FunctionTable {
  const table: Record<string, FunctionTable[string]> = { ...BUILTINS };
  for (const [name, def] of Object.entries(own)) {
    if (!NAME.test(name)) {
      throw new Error(`@argus-table/formulas: "${name}" isn't a valid function name.`);
    }
    const message = `${name.toUpperCase()} failed.`;
    table[name.toUpperCase()] = {
      min: def.args?.[0] ?? 0,
      max: def.args?.[1] ?? Infinity,
      returns: def.returns ?? 'unknown',
      fn: (...args) => {
        try {
          const result = def.fn(...args);
          return typeof result === 'number' ? checkNumber(result) : result;
        } catch {
          return new FormulaError('#VALUE!', message);
        }
      },
    };
  }
  return table;
}

/** Reads a dotted path such as `customer.name` (split at the dots), like the table does. */
function readPath(source: unknown, keys: readonly string[]): unknown {
  let value = source;
  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

function entry<T>(
  formula: string,
  inputs: readonly unknown[],
  type: ValueType,
  evaluate: Evaluate<Scope<T>>,
): Compiled<T> {
  const cache = new WeakMap<object, unknown>();
  const result = (row: T, index: number): unknown => {
    if (typeof row !== 'object' || row === null) return evaluate({ row, index });
    if (cache.has(row)) return cache.get(row);
    const value = evaluate({ row, index });
    cache.set(row, value);
    return value;
  };
  return {
    formula,
    inputs,
    type,
    result,
    accessor: (row, index) => {
      const value = result(row, index);
      return isFormulaError(value) ? undefined : value;
    },
  };
}

const sameInputs = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, i) => Object.is(value, b[i]));

/** A result as cell text, the way a spreadsheet shows it. */
function display(value: unknown): CellContent {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) {
    const midnight = !value.getHours() && !value.getMinutes() && !value.getSeconds();
    return midnight ? value.toLocaleDateString() : value.toLocaleString();
  }
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- objects are handled here
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

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
 * per row. List it before `headerMenu()`, which turns text headers into
 * functions. One plugin can serve several tables.
 */
export function formulas<T = unknown>(options: FormulasOptions = {}): ArgusPlugin<T> {
  const functions = functionTable(options.functions);
  const marker = options.marker ?? true;
  const parsed = new Map<string, FormulaNode | FormulaSyntaxError>();
  const states = new WeakMap<HTMLElement, TableState<T>>();

  const parseOnce = (formula: string): FormulaNode | FormulaSyntaxError => {
    let tree = parsed.get(formula);
    if (!tree) {
      try {
        tree = parse(formula);
      } catch (error) {
        if (!(error instanceof FormulaSyntaxError)) throw error;
        tree = error;
      }
      parsed.set(formula, tree);
    }
    return tree;
  };

  const stateOf = (host: PluginHost<T>): TableState<T> => {
    let state = states.get(host.element);
    if (!state) {
      state = { compiled: new Map(), warned: new Set() };
      states.set(host.element, state);
    }
    return state;
  };

  const compileAll = (defs: readonly ColumnDef<T>[], state: TableState<T>) => {
    const byId = new Map(defs.map((d) => [d.id, d]));
    const byHeader = new Map<string, ColumnDef<T>>();
    const byIdCase = new Map<string, ColumnDef<T>>();
    for (const def of defs) {
      if (typeof def.header === 'string' && !byHeader.has(def.header.trim().toLowerCase())) {
        byHeader.set(def.header.trim().toLowerCase(), def);
      }
      if (!byIdCase.has(def.id.toLowerCase())) byIdCase.set(def.id.toLowerCase(), def);
    }
    // By id, then by text header, then by id in any case.
    const lookup = (name: string) =>
      byId.get(name) ?? byHeader.get(name.toLowerCase()) ?? byIdCase.get(name.toLowerCase());

    const trees = new Map<string, FormulaNode | FormulaSyntaxError>();
    const uses = new Map<string, string[]>();
    for (const def of defs) {
      if (def.formula === undefined) continue;
      const tree = parseOnce(def.formula);
      trees.set(def.id, tree);
      const names = tree instanceof FormulaSyntaxError ? [] : refsOf(tree);
      uses.set(
        def.id,
        names.flatMap((name) => {
          const target = lookup(name);
          return target?.formula !== undefined ? [target.id] : [];
        }),
      );
    }

    const { order, cyclic } = analyze(uses);
    const previous = state.compiled;
    const next = new Map<string, Compiled<T>>();
    const reuse = (id: string, formula: string, inputs: readonly unknown[]) => {
      const old = previous.get(id);
      return old?.formula === formula && sameInputs(old.inputs, inputs) ? old : undefined;
    };
    const broken = (def: ColumnDef<T>, formula: string, error: FormulaSyntaxError) => {
      const key = `${def.id}\u0000${formula}`;
      if (!state.warned.has(key)) {
        state.warned.add(key);
        console.warn(`argus-table: formula column "${def.id}": ${error.message}`);
      }
      const value = new FormulaError('#ERROR!', error.message);
      return entry<T>(formula, ['broken'], 'unknown', () => value);
    };

    for (const id of order) {
      const def = byId.get(id);
      const tree = trees.get(id);
      if (def?.formula === undefined || !tree) continue;
      const formula = def.formula;
      if (tree instanceof FormulaSyntaxError) {
        next.set(id, reuse(id, formula, ['broken']) ?? broken(def, formula, tree));
        continue;
      }
      if (cyclic.has(id)) {
        const value = new FormulaError('#CYCLE!', 'The formula depends on its own result.');
        next.set(
          id,
          reuse(id, formula, ['cycle']) ?? entry<T>(formula, ['cycle'], 'unknown', () => value),
        );
        continue;
      }

      // What each name reads: a formula column's compiled entry (built earlier,
      // `order` puts dependencies first) or a data column's accessor.
      const inputs = refsOf(tree).flatMap((name) => {
        const target = lookup(name);
        const source = target
          ? target.formula !== undefined
            ? next.get(target.id)
            : target.accessor
          : undefined;
        return [name, target?.id, source];
      });
      const kept = reuse(id, formula, inputs);
      if (kept) {
        next.set(id, kept);
        continue;
      }
      try {
        const evaluate = compile<Scope<T>>(tree, {
          functions,
          ref(name) {
            const target = lookup(name);
            if (!target) return new FormulaError('#REF!', `There is no column [${name}].`);
            if (target.formula !== undefined) {
              const other = next.get(target.id);
              return other ? (s) => other.result(s.row, s.index) : () => undefined;
            }
            const { accessor } = target;
            if (typeof accessor === 'function') return (s) => accessor(s.row, s.index);
            if (typeof accessor === 'string') {
              const keys = accessor.split('.');
              return (s) => readPath(s.row, keys);
            }
            return () => undefined;
          },
        });
        const type = inferType(tree, functions, (name) => {
          const target = lookup(name);
          return (target && next.get(target.id)?.type) ?? 'unknown';
        });
        next.set(id, entry(formula, inputs, type, evaluate));
      } catch (error) {
        if (!(error instanceof FormulaSyntaxError)) throw error;
        next.set(id, broken(def, formula, error));
      }
    }
    state.compiled = next;
    return next;
  };

  const cellFor =
    (def: ColumnDef<T>, compiled: Compiled<T>) =>
    (row: T, context: CellContext<T>): CellContent => {
      // A cache hit: the table read the value (through the accessor) first.
      const value = compiled.result(row, context.index);
      if (isFormulaError(value)) return errorContent(value);
      return def.cell ? def.cell(row, context) : display(value);
    };

  const headerFor = (def: ColumnDef<T>) => () => {
    const own = typeof def.header === 'function' ? def.header() : def.header;
    return html`<span class="argus-formula-header"
      ><span class="argus-formula-mark" aria-hidden="true">ƒx</span
      ><span class="argus-formula-label">${own ?? nothing}</span></span
    >`;
  };

  return {
    name: 'formulas',

    connect(host) {
      adoptStyles(host.element);
      return undefined;
    },

    columns(defs, host) {
      const state = stateOf(host);
      if (!defs.some((def) => def.formula !== undefined)) {
        state.compiled = new Map();
        return defs;
      }
      const compiled = compileAll(defs, state);
      // The server sorts with `dataSource`, and it doesn't know the formulas.
      const remote = host.element.dataSource !== undefined;
      return defs.map((def) => {
        const c = compiled.get(def.id);
        if (!c) return def;
        const numeric = c.type === 'number' || c.type === 'date';
        return {
          ...def,
          accessor: c.accessor,
          cell: cellFor(def, c),
          align: def.align ?? (numeric ? 'end' : undefined),
          header: marker ? headerFor(def) : def.header,
          sortable: remote ? false : def.sortable,
        };
      });
    },
  };
}
