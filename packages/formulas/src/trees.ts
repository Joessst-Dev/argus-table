import type { ColumnDef } from 'argus-table';
import { lookupOf, type Compiled } from './columns.js';
import { FormulaSyntaxError } from './engine/errors.js';
import type { FunctionTable } from './engine/functions/index.js';
import { nodesOf, type FormulaNode } from './engine/parse.js';

/** The operators of a `binary` node in a `FormulaTree`. */
export type FormulaOperator =
  '+' | '-' | '*' | '/' | '^' | '&' | '=' | '<>' | '<' | '<=' | '>' | '>=';

/**
 * A formula's syntax tree, as `formulaTrees()` gives it to a `dataSource`:
 * plain JSON, column references resolved to column ids. Later releases may add
 * node types: treat one you don't know as a formula you can't evaluate.
 */
export type FormulaTree =
  | { type: 'number'; value: number }
  | { type: 'text'; value: string }
  | { type: 'boolean'; value: boolean }
  /** This row's value of another column, by its id (a formula column's too: its tree is in the same record). */
  | { type: 'ref'; column: string }
  /** A function call; `name` is upper case: a built-in function or one of yours (`functions`). */
  | { type: 'call'; name: string; args: FormulaTree[] }
  | { type: 'unary'; operator: '-' | '+'; operand: FormulaTree }
  /** Postfix `%`: divides by 100. */
  | { type: 'percent'; operand: FormulaTree }
  | { type: 'binary'; operator: FormulaOperator; left: FormulaTree; right: FormulaTree };

/** What a `dataSource` needs to sort and filter by formula columns. */
export interface FormulaTrees {
  /** Each formula column's syntax tree, by column id. */
  columns: Record<string, FormulaTree>;
  /**
   * The browser's IANA time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`):
   * `TODAY()`, `YEAR()` and the other date functions use local time.
   */
  timeZone: string;
}

export interface TreesOptions {
  /** Parses a formula (the plugin caches them). */
  parse(formula: string): FormulaNode | FormulaSyntaxError;
  functions: FunctionTable;
}

/**
 * The trees of the formula columns a server can evaluate, by id: not those whose
 * formula is broken (it doesn't parse, names an unknown column or function, or
 * is in a cycle), uses whole columns, or reads such a column.
 */
export function treesOf<T>(
  defs: readonly ColumnDef<T, unknown>[],
  compiled: ReadonlyMap<string, Compiled<T>>,
  options: TreesOptions,
): Record<string, FormulaTree> {
  const lookup = lookupOf(defs);
  // Per formula column: its tree, or `null` once it's known to be left out.
  const done = new Map<string, FormulaTree | null>();

  const treeOf = (def: ColumnDef<T, unknown>): FormulaTree | null => {
    let tree = done.get(def.id);
    if (tree !== undefined) return tree;
    // Cycles are `broken`, so a column never reaches itself here; mark it anyway.
    done.set(def.id, null);
    const entry = compiled.get(def.id);
    const node = options.parse(def.formula ?? '');
    const ok =
      entry &&
      !entry.broken &&
      !entry.ranges &&
      !(node instanceof FormulaSyntaxError) &&
      nodesOf(node).every((n) => {
        if (n.type === 'call') return n.name in options.functions;
        if (n.type !== 'ref') return n.type !== 'range';
        const target = lookup(n.name);
        return target && (target.formula === undefined || treeOf(target));
      });
    // The parser's node without its offsets, and references by column id.
    tree = ok
      ? (JSON.parse(
          JSON.stringify(node, (key, value: FormulaNode | undefined) =>
            key === 'start' || key === 'end'
              ? undefined
              : value?.type === 'ref'
                ? { type: 'ref', column: lookup(value.name)?.id }
                : value,
          ),
        ) as FormulaTree)
      : null;
    done.set(def.id, tree);
    return tree;
  };

  const trees: Record<string, FormulaTree> = {};
  for (const def of defs) {
    const tree = def.formula === undefined ? null : treeOf(def);
    if (tree) trees[def.id] = tree;
  }
  return trees;
}

/** Each table's trees, read on demand: set by the plugin's `columns` hook, any instance's. */
const stored = new WeakMap<HTMLElement, () => Record<string, FormulaTree>>();

/** Keeps how to read a table's trees, from the latest run of the `columns` hook. */
export function setTrees(table: HTMLElement, read: () => Record<string, FormulaTree>): void {
  stored.set(table, read);
}

/**
 * The syntax trees of a table's formula columns, for a `dataSource` that sorts
 * and filters by them (`formulas({ server: true })`). Column references are
 * resolved to column ids. Leaves out columns whose formula is broken or uses
 * whole columns, and those that read them. `columns` is `{}` for a table
 * without `formulas()`.
 *
 * ```ts
 * table.dataSource = {
 *   getRows: (request) => api.rows({ ...request, formulas: formulaTrees(table) }),
 * };
 * ```
 */
export function formulaTrees(table: HTMLElement): FormulaTrees {
  return {
    columns: structuredClone(stored.get(table)?.() ?? {}),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
