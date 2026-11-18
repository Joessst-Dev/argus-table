import type { ColumnDef } from 'argus-table';
import { lookupOf, type Compiled } from './columns.js';
import { FormulaSyntaxError } from './engine/errors.js';
import type { FunctionTable } from './engine/functions/index.js';
import type { FormulaNode } from './engine/parse.js';

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
  const byId = new Map(defs.map((d) => [d.id, d]));
  // Per column: its tree, or `null` once it's known to be left out.
  const done = new Map<string, FormulaTree | null>();

  const convert = (node: FormulaNode): FormulaTree | null => {
    switch (node.type) {
      case 'number':
      case 'text':
      case 'boolean':
        return { type: node.type, value: node.value } as FormulaTree;
      case 'range':
        return null;
      case 'ref': {
        const target = lookup(node.name);
        if (!target) return null;
        if (target.formula !== undefined && !treeOf(target.id)) return null;
        return { type: 'ref', column: target.id };
      }
      case 'call': {
        if (!options.functions[node.name]) return null;
        const args: FormulaTree[] = [];
        for (const arg of node.args) {
          const tree = convert(arg);
          if (!tree) return null;
          args.push(tree);
        }
        return { type: 'call', name: node.name, args };
      }
      case 'unary':
      case 'percent': {
        const operand = convert(node.operand);
        if (!operand) return null;
        return node.type === 'unary'
          ? { type: 'unary', operator: node.operator, operand }
          : { type: 'percent', operand };
      }
      case 'binary': {
        const left = convert(node.left);
        if (!left) return null;
        const right = convert(node.right);
        return right && { type: 'binary', operator: node.operator, left, right };
      }
    }
  };

  const treeOf = (id: string): FormulaTree | null => {
    const known = done.get(id);
    if (known !== undefined) return known;
    // Cycles are `broken`, so a column never reaches itself here; mark it anyway.
    done.set(id, null);
    const formula = byId.get(id)?.formula;
    const entry = compiled.get(id);
    const node = formula === undefined ? undefined : options.parse(formula);
    const tree =
      entry && !entry.broken && !entry.ranges && node && !(node instanceof FormulaSyntaxError)
        ? convert(node)
        : null;
    done.set(id, tree);
    return tree;
  };

  const trees: Record<string, FormulaTree> = {};
  for (const def of defs) {
    if (def.formula === undefined) continue;
    const tree = treeOf(def.id);
    if (tree) trees[def.id] = tree;
  }
  return trees;
}
