import { checkNumber, compare, toNumber, toText } from './coerce.js';
import { DIV0, FormulaError, FormulaSyntaxError, isFormulaError, NUM } from './errors.js';
import type { FunctionTable } from './functions/index.js';
import type { BinaryOperator, FormulaNode } from './parse.js';

/** Evaluates a formula, or part of one, for one row (`scope`). */
export type Evaluate<S> = (scope: S) => unknown;

export interface CompileOptions<S> {
  functions: FunctionTable;
  /** How to read a column the formula names: a reader, or the error every row gets. */
  ref(name: string): Evaluate<S> | FormulaError;
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
 * formula can only reach what `ref` and `functions` give it.
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
      case 'unary': {
        const operand = build(n.operand);
        if (n.operator === '+') return operand;
        return (scope) => {
          const value = toNumber(operand(scope));
          return isFormulaError(value) ? value : checkNumber(-value);
        };
      }
      case 'percent': {
        const operand = build(n.operand);
        return (scope) => {
          const value = toNumber(operand(scope));
          return isFormulaError(value) ? value : value / 100;
        };
      }
      case 'binary': {
        const left = build(n.left);
        const right = build(n.right);
        const { operator } = n;
        if (operator === '&') {
          return (scope) => {
            const a = toText(left(scope));
            if (isFormulaError(a)) return a;
            const b = toText(right(scope));
            return isFormulaError(b) ? b : a + b;
          };
        }
        if (['=', '<>', '<', '<=', '>', '>='].includes(operator)) {
          return (scope) => {
            const order = compare(left(scope), right(scope));
            return isFormulaError(order) ? order : comparison(operator, order);
          };
        }
        return (scope) => {
          const a = toNumber(left(scope));
          if (isFormulaError(a)) return a;
          const b = toNumber(right(scope));
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
        const { fn, lazy } = def;
        if (lazy) {
          return (scope) => lazy(args.map((arg) => () => arg(scope)));
        }
        return (scope) => {
          const values: unknown[] = [];
          for (const arg of args) {
            const value = arg(scope);
            if (isFormulaError(value)) return value;
            values.push(value);
          }
          return fn?.(...values);
        };
      }
    }
  };
  return build(node);
}
