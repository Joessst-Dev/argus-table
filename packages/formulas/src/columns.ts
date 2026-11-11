import type { ColumnDef } from 'argus-table';
import { checkNumber, formatNumber } from './engine/coerce.js';
import { compile, type Evaluate } from './engine/compile.js';
import { FormulaError, FormulaSyntaxError, isFormulaError } from './engine/errors.js';
import { BUILTINS, type FunctionTable, type ValueType } from './engine/functions/index.js';
import { analyze } from './engine/graph.js';
import { inferType } from './engine/infer.js';
import { parse, refsOf, type FormulaNode } from './engine/parse.js';

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
  /** Argument names for the editor's hint, such as `['net']`; `'[digits]'` for an optional one. */
  params?: readonly string[];
  /** One sentence for the editor's hint: what the function gives. */
  description?: string;
}

export interface Scope<T> {
  row: T;
  index: number;
}

/** A formula column, compiled: kept while its formula and the columns it reads stay the same. */
export interface Compiled<T> {
  formula: string;
  /** What it was built from, compared by identity: per name, the column and how that column reads. */
  inputs: readonly unknown[];
  type: ValueType;
  /** The value for a row, errors included, cached per row object. */
  result: (row: T, index: number) => unknown;
  /** The column's accessor: the value, or `undefined` for an error (it sorts last). */
  accessor: (row: T, index: number) => unknown;
}

const NAME = /^[A-Za-z_][A-Za-z0-9_.]*$/;

/** The built-in functions with the caller's own on top. */
export function functionTable(own: Readonly<Record<string, FormulaFunction>> = {}): FunctionTable {
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

/** A data column's value reader (its accessor), for a formula naming it. */
export function readerOf<T>(def: ColumnDef<T>): Evaluate<Scope<T>> {
  const { accessor } = def;
  if (typeof accessor === 'function') return (s) => accessor(s.row, s.index);
  if (typeof accessor === 'string') {
    const keys = accessor.split('.');
    return (s) => readPath(s.row, keys);
  }
  return () => undefined;
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

/** Finds a column a formula names: by id, then by text header, then by id in any case. */
export function lookupOf<T>(
  defs: readonly ColumnDef<T>[],
): (name: string) => ColumnDef<T> | undefined {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const byHeader = new Map<string, ColumnDef<T>>();
  const byIdCase = new Map<string, ColumnDef<T>>();
  for (const def of defs) {
    const header = typeof def.header === 'string' ? def.header.trim().toLowerCase() : undefined;
    if (header && !byHeader.has(header)) byHeader.set(header, def);
    if (!byIdCase.has(def.id.toLowerCase())) byIdCase.set(def.id.toLowerCase(), def);
  }
  return (name) =>
    byId.get(name) ?? byHeader.get(name.toLowerCase()) ?? byIdCase.get(name.toLowerCase());
}

/** The formula columns a formula names, by id: its edges in the dependency graph. */
export function formulaRefs<T>(
  tree: FormulaNode,
  lookup: (name: string) => ColumnDef<T> | undefined,
): string[] {
  return refsOf(tree).flatMap((name) => {
    const target = lookup(name);
    return target?.formula !== undefined ? [target.id] : [];
  });
}

/** Parses a formula, keeping the error instead of throwing it. */
export function parseOrError(formula: string): FormulaNode | FormulaSyntaxError {
  try {
    return parse(formula);
  } catch (error) {
    if (error instanceof FormulaSyntaxError) return error;
    throw error;
  }
}

export interface CompileColumnsOptions<T> {
  functions: FunctionTable;
  /** Parses a formula (the plugin caches them). */
  parse(formula: string): FormulaNode | FormulaSyntaxError;
  /** The last result, whose columns are kept where nothing they depend on changed. */
  previous?: ReadonlyMap<string, Compiled<T>>;
  /** Told about each formula that can't be read or compiled (the column shows `#ERROR!`). */
  onBroken?(def: ColumnDef<T>, error: FormulaSyntaxError): void;
}

/** Each formula column of `defs`, compiled in dependency order, by id. */
export function compileColumns<T>(
  defs: readonly ColumnDef<T>[],
  options: CompileColumnsOptions<T>,
): Map<string, Compiled<T>> {
  const { functions } = options;
  const byId = new Map(defs.map((d) => [d.id, d]));
  const lookup = lookupOf(defs);

  const trees = new Map<string, FormulaNode | FormulaSyntaxError>();
  const uses = new Map<string, string[]>();
  for (const def of defs) {
    if (def.formula === undefined) continue;
    const tree = options.parse(def.formula);
    trees.set(def.id, tree);
    uses.set(def.id, tree instanceof FormulaSyntaxError ? [] : formulaRefs(tree, lookup));
  }

  const { order, cyclic } = analyze(uses);
  const next = new Map<string, Compiled<T>>();
  const reuse = (id: string, formula: string, inputs: readonly unknown[]) => {
    const old = options.previous?.get(id);
    return old?.formula === formula && sameInputs(old.inputs, inputs) ? old : undefined;
  };
  const broken = (def: ColumnDef<T>, formula: string, error: FormulaSyntaxError) => {
    options.onBroken?.(def, error);
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
      const source = target?.formula !== undefined ? next.get(target.id) : target?.accessor;
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
          return readerOf(target);
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
  return next;
}

/** A column's name as formulas use it: its text header, else its id. */
export const nameOf = <T>(def: ColumnDef<T>): string =>
  typeof def.header === 'string' && def.header.trim() ? def.header.trim() : def.id;

/** A result as cell text, the way a spreadsheet shows it. */
export function display(value: unknown): string {
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
