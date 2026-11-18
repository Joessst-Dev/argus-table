// Shared by the "With a dataSource" example's four flavours: a data source whose
// getRows sends the formulas' syntax trees along, and a pretend server that
// sorts and filters by them (standing in for your API). The server part is
// written as a server author would: it knows the tree format, not the add-on.
import { formulaTrees, type FormulaTree, type FormulaTrees } from '@argus-table/formulas';
import type { ColumnFilter, ColumnFilterState, DataSource, SortState } from 'argus-table';
import { itemsOf, type Item } from './data';

/** What the server gets: the table's request, with the trees. */
export interface FormulaRequest {
  start: number;
  end: number;
  sorting: SortState;
  filters: ColumnFilterState;
  quickFilter: string;
  formulas: FormulaTrees;
}

/**
 * The browser side: `getRows` reads the trees of the table it serves (`table()`
 * gives the element, once it exists) and sends them with the request.
 * `onRequest` sees every request, for the example's log.
 */
export function createFormulaSource(
  table: () => HTMLElement | null | undefined,
  onRequest: (request: FormulaRequest) => void,
): DataSource<Item> {
  return {
    async getRows({ start, end, sorting, filters, quickFilter, signal }) {
      const element = table();
      const formulas = element
        ? formulaTrees(element)
        : { columns: {}, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      const request = { start, end, sorting, filters, quickFilter, formulas };
      onRequest(request);
      await new Promise((resolve) => setTimeout(resolve, 150));
      signal.throwIfAborted();
      return serve(request);
    },
  };
}

/** A request as one line of the log: what it sorts and filters by, and those columns' trees. */
export function describe({ start, end, sorting, filters, formulas }: FormulaRequest): string {
  const used = [...sorting.map((s) => s.id), ...Object.keys(filters)];
  const trees = Object.fromEntries(
    Object.entries(formulas.columns).filter(([id]) => used.includes(id)),
  );
  return `getRows ${String(start)}–${String(end)}, sorting ${JSON.stringify(sorting)}, filters ${JSON.stringify(filters)}, trees ${JSON.stringify(trees)}`;
}

// ---- The pretend server ----

const items = itemsOf(10_000);

/** The rows of a request: filtered, sorted, then the page asked for. */
function serve({ start, end, sorting, filters, quickFilter, formulas }: FormulaRequest) {
  const value = (item: Item, column: string): unknown => {
    const tree = formulas.columns[column];
    // A data column's id is the item's field here; map ids to your fields.
    return tree
      ? evaluate(tree, item, value)
      : (item as unknown as Record<string, unknown>)[column];
  };
  const words = quickFilter.toLowerCase().split(/\s+/).filter(Boolean);
  const searched = ['product', ...Object.keys(formulas.columns)];
  let rows = items.filter(
    (item) =>
      Object.entries(filters).every(([column, filter]) => passes(filter, value(item, column))) &&
      words.every((word) => searched.some((c) => textOf(value(item, c)).includes(word))),
  );
  for (const { id, desc } of [...sorting].reverse()) {
    // Stable sorts, last key first; blanks and errors last in both directions.
    rows = rows
      .map((item) => ({ item, v: value(item, id) }))
      .sort((a, b) => {
        if (a.v === undefined || b.v === undefined) {
          return Number(a.v === undefined) - Number(b.v === undefined);
        }
        const order =
          typeof a.v === 'number' && typeof b.v === 'number'
            ? a.v - b.v
            : textOf(a.v).localeCompare(textOf(b.v));
        return desc ? -order : order;
      })
      .map(({ item }) => item);
  }
  return { rows: rows.slice(start, end), total: rows.length };
}

/**
 * Evaluates the nodes and functions this example uses; anything else (another
 * function, a node type added later) is `undefined`, a value it can't compute,
 * which sorts last. Errors are `undefined` too, as in the browser.
 */
function evaluate(
  tree: FormulaTree,
  item: Item,
  value: (item: Item, column: string) => unknown,
): unknown {
  const at = (t: FormulaTree) => evaluate(t, item, value);
  switch (tree.type) {
    case 'number':
    case 'text':
    case 'boolean':
      return tree.value;
    case 'ref':
      return value(item, tree.column);
    case 'unary': {
      // `+` leaves the value as it is; `-` makes a number of it.
      const v = at(tree.operand);
      if (tree.operator === '+') return v;
      const n = numberOf(v);
      return n === undefined ? undefined : -n;
    }
    case 'percent': {
      const n = numberOf(at(tree.operand));
      return n === undefined ? undefined : n / 100;
    }
    case 'binary':
      return binary(tree.operator, at(tree.left), at(tree.right));
    case 'call': {
      if (tree.name === 'IF') {
        // Lazy, like the browser: only the branch taken is evaluated.
        const [test, then, otherwise] = tree.args;
        const condition = test && booleanOf(at(test));
        if (condition === undefined) return undefined;
        const chosen = condition ? then : otherwise;
        return chosen ? at(chosen) : false;
      }
      if (tree.name === 'ROUND') {
        const [n, digits] = tree.args.map((arg) => numberOf(at(arg)));
        if (n === undefined) return undefined;
        // Halves away from zero, after dropping float noise past 15 digits (1.005 → 1.01).
        const factor = 10 ** Math.trunc(digits ?? 0);
        const whole = Math.round(Number((Math.abs(n) * factor).toPrecision(15)));
        return Number(((Math.sign(n) * whole) / factor).toPrecision(15));
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

function binary(operator: string, a: unknown, b: unknown): unknown {
  if (a === undefined || b === undefined) return undefined;
  if (operator === '&') return textOf(a) + textOf(b);
  if (['=', '<>', '<', '<=', '>', '>='].includes(operator)) {
    // Numbers by size, text without case (this example compares nothing else).
    const x = typeof a === 'number' && typeof b === 'number' ? a : textOf(a);
    const y = typeof a === 'number' && typeof b === 'number' ? b : textOf(b);
    const order = x < y ? -1 : x > y ? 1 : 0;
    if (operator === '=') return order === 0;
    if (operator === '<>') return order !== 0;
    if (operator === '<') return order < 0;
    if (operator === '<=') return order <= 0;
    if (operator === '>') return order > 0;
    return order >= 0;
  }
  const x = numberOf(a);
  const y = numberOf(b);
  if (x === undefined || y === undefined) return undefined;
  switch (operator) {
    case '+':
      return x + y;
    case '-':
      return x - y;
    case '*':
      return x * y;
    case '/':
      return y === 0 ? undefined : x / y;
    default:
      return x ** y;
  }
}

/** A value as a number: blanks are 0, `TRUE` is 1, numeric text its number; anything else can't be. */
function numberOf(v: unknown): number | undefined {
  if (v === null || v === '') return 0;
  if (typeof v === 'boolean') return Number(v);
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/** A value as a condition: blank is false, numbers true unless 0, text only `TRUE` or `FALSE`. */
function booleanOf(v: unknown): boolean | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const text = typeof v === 'string' ? v.trim().toUpperCase() : '';
  return text === 'TRUE' ? true : text === 'FALSE' ? false : undefined;
}

/** A value's text in lower case, as the table matches it: `String(n)` for numbers, `true` / `false`. */
function textOf(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    ? String(v).toLowerCase()
    : '';
}

/** Whether a value passes a column's filter (the text and number kinds this example uses). */
function passes(filter: ColumnFilter, v: unknown): boolean {
  if (filter.kind === 'text') {
    const text = textOf(v);
    const needle = (filter.value ?? '').toLowerCase();
    if (filter.op === 'empty') return text === '';
    if (filter.op === 'notEmpty') return text !== '';
    if (filter.op === 'equals') return !needle || text === needle;
    if (filter.op === 'startsWith') return text.startsWith(needle);
    return text.includes(needle);
  }
  if (filter.kind === 'number') {
    const n = typeof v === 'number' ? v : undefined;
    const { value: from, to } = filter;
    if (filter.op === 'empty') return n === undefined;
    if (filter.op === 'notEmpty') return n !== undefined;
    if (from === undefined) return true;
    if (filter.op === 'eq') return n === from;
    if (filter.op === 'ne') return n !== from;
    if (n === undefined) return false;
    if (filter.op === 'lt') return n < from;
    if (filter.op === 'le') return n <= from;
    if (filter.op === 'gt') return n > from;
    if (filter.op === 'ge') return n >= from;
    return n >= from && (to === undefined || n <= to);
  }
  return true;
}
