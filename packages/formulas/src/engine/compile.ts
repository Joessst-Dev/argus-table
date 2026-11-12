import { checkNumber, compare, toNumber, toText } from './coerce.js';
import { DIV0, FormulaError, FormulaSyntaxError, isFormulaError, NUM } from './errors.js';
import type { FunctionTable } from './functions/index.js';
import { nodesOf, type BinaryOperator, type FormulaNode } from './parse.js';
import { isRange, NO_RANGES, RANGE_AS_VALUE } from './range.js';

/** Evaluates a formula, or part of one, for one row (`scope`). */
export type Evaluate<S> = (scope: S) => unknown;

export interface CompileOptions<S> {
  functions: FunctionTable;
  /** How to read a column the formula names: a reader, or the error every row gets. */
  ref(name: string): Evaluate<S> | FormulaError;
  /**
   * How to read a whole column (`[[name]]`): a reader of its `ColumnRange`, or the
   * error every row gets. Without it, whole columns are `#N/A`.
   */
  range?(name: string): Evaluate<S> | FormulaError;
}

/** Whether a node reads the row: names a column's value in it (`[name]`). */
const readsRow = (n: FormulaNode): boolean => nodesOf(n).some((x) => x.type === 'ref');

/** Whether a node uses a whole column (`[[name]]`). */
const usesRange = (n: FormulaNode): boolean => nodesOf(n).some((x) => x.type === 'range');

/** A range where one value belongs is `#VALUE!`. */
const scalar = (value: unknown): unknown => (isRange(value) ? RANGE_AS_VALUE : value);

/** Evaluates `fn` once, on first use: for parts that are the same in every row. */
function once<S>(fn: Evaluate<S>): Evaluate<S> {
  let done = false;
  let value: unknown;
  return (scope) => {
    if (!done) {
      value = fn(scope);
      done = true;
    }
    return value;
  };
}

const arithmetic = (operator: BinaryOperator, a: number, b: number): number | FormulaError => {
  switch (operator) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b === 0 ? DIV0 : a / b;
    default:
      // ^
      return a === 0 && b <= 0 ? NUM : a ** b;
  }
};

const comparison = (operator: BinaryOperator, order: number): boolean => {
  switch (operator) {
    case '=':
      return order === 0;
    case '<>':
      return order !== 0;
    case '<':
      return order < 0;
    case '<=':
      return order <= 0;
    case '>':
      return order > 0;
    default:
      // >=
      return order >= 0;
  }
};

function arity(name: string, min: number, max: number): string {
  if (min === max) return `${name} takes ${String(min)} argument${min === 1 ? '' : 's'}.`;
  if (max === Infinity)
    return `${name} takes at least ${String(min)} argument${min === 1 ? '' : 's'}.`;
  return `${name} takes ${String(min)} to ${String(max)} arguments.`;
}

/**
 * Turns a syntax tree into a function of the row, once: names are looked up
 * here, so evaluating is closures calling closures. There is no `eval`, and a
 * formula can only reach what `ref`, `range` and `functions` give it.
 *
 * A function call that uses a whole column but no value of the row
 * (`SUM([[amount]])`) is evaluated once and kept: compile again for other rows
 * of the whole columns.
 *
 * @throws FormulaSyntaxError when a function gets the wrong number of arguments.
 */
export function compile<S>(node: FormulaNode, options: CompileOptions<S>): Evaluate<S> {
  const build = (n: FormulaNode): Evaluate<S> => {
    switch (n.type) {
      case 'number':
      case 'text':
      case 'boolean': {
        const { value } = n;
        return () => value;
      }
      case 'ref': {
        const read = options.ref(n.name);
        return isFormulaError(read) ? () => read : read;
      }
      case 'range': {
        const read = options.range ? options.range(n.name) : NO_RANGES;
        return isFormulaError(read) ? () => read : read;
      }
      case 'unary': {
        const operand = build(n.operand);
        if (n.operator === '+') return (scope) => scalar(operand(scope));
        return (scope) => {
          const value = toNumber(scalar(operand(scope)));
          return isFormulaError(value) ? value : checkNumber(-value);
        };
      }
      case 'percent': {
        const operand = build(n.operand);
        return (scope) => {
          const value = toNumber(scalar(operand(scope)));
          return isFormulaError(value) ? value : value / 100;
        };
      }
      case 'binary': {
        const left = build(n.left);
        const right = build(n.right);
        const { operator } = n;
        if (operator === '&') {
          return (scope) => {
            const a = toText(scalar(left(scope)));
            if (isFormulaError(a)) return a;
            const b = toText(scalar(right(scope)));
            return isFormulaError(b) ? b : a + b;
          };
        }
        if (['=', '<>', '<', '<=', '>', '>='].includes(operator)) {
          return (scope) => {
            const order = compare(scalar(left(scope)), scalar(right(scope)));
            return isFormulaError(order) ? order : comparison(operator, order);
          };
        }
        return (scope) => {
          const a = toNumber(scalar(left(scope)));
          if (isFormulaError(a)) return a;
          const b = toNumber(scalar(right(scope)));
          if (isFormulaError(b)) return b;
          const result = arithmetic(operator, a, b);
          return isFormulaError(result) ? result : checkNumber(result);
        };
      }
      case 'call': {
        const def = options.functions[n.name];
        if (!def) {
          const error = new FormulaError('#NAME?', `There is no function ${n.name}.`);
          return () => error;
        }
        if (n.args.length < def.min || n.args.length > def.max) {
          throw new FormulaSyntaxError(arity(n.name, def.min, def.max), n.start, n.end);
        }
        const args = n.args.map(build);
        const { fn, lazy, ranges } = def;
        let call: Evaluate<S>;
        if (lazy) {
          // Lazy functions pass on what they pick, a range too: SUM(IF(…, [[a]], [[b]])).
          call = (scope) => lazy(args.map((arg) => () => arg(scope)));
        } else {
          call = (scope) => {
            const values: unknown[] = [];
            for (const arg of args) {
              const value = arg(scope);
              if (isFormulaError(value)) return value;
              if (!ranges && isRange(value)) return RANGE_AS_VALUE;
              values.push(value);
            }
            return fn?.(...values);
          };
        }
        return usesRange(n) && !readsRow(n) ? once(call) : call;
      }
    }
  };
  const evaluate = build(node);
  return usesRange(node) ? (scope) => scalar(evaluate(scope)) : evaluate;
}
