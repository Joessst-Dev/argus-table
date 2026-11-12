import type { FunctionTable, ValueType } from './functions/index.js';
import type { FormulaNode } from './parse.js';

/**
 * What a formula returns, read from its syntax tree alone: `[a] * [b]` is a
 * number, `CONCAT(…)` text. `refType` gives the type of a column the formula
 * names (`unknown` for a data column). `unknown` when it can't be told.
 */
export function inferType(
  node: FormulaNode,
  functions: FunctionTable,
  refType: (name: string) => ValueType,
): ValueType {
  const infer = (n: FormulaNode): ValueType => {
    switch (n.type) {
      case 'number':
      case 'percent':
        return 'number';
      case 'text':
        return 'text';
      case 'boolean':
        return 'boolean';
      case 'ref':
      case 'range':
        return refType(n.name);
      case 'unary':
        return n.operator === '-' ? 'number' : infer(n.operand);
      case 'binary':
        if (n.operator === '&') return 'text';
        if (['+', '-', '*', '/', '^'].includes(n.operator)) return 'number';
        return 'boolean';
      case 'call': {
        const def = functions[n.name];
        if (!def) return 'unknown';
        if (def.returnsFrom !== undefined) {
          const from = n.args[def.returnsFrom];
          return from ? infer(from) : 'unknown';
        }
        if (!def.branches) return def.returns;
        const types = def
          .branches(n.args.length)
          .map((i) => n.args[i])
          .map((arg) => (arg ? infer(arg) : 'unknown'));
        const [first] = types;
        return first && types.every((t) => t === first) ? first : 'unknown';
      }
    }
  };
  return infer(node);
}
