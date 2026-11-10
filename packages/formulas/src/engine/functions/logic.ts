import { isBlank, toBoolean } from '../coerce.js';
import { FormulaError, isFormulaError, VALUE } from '../errors.js';
import type { FunctionTable } from './types.js';

const NO_MATCH = new FormulaError('#N/A', 'No condition in IFS is true.');

/**
 * `AND` and `OR`: stop at the first argument that decides. Blank arguments
 * don't count; with none left the result is `#VALUE!`.
 */
function connective(decisive: boolean) {
  return (args: readonly (() => unknown)[]): unknown => {
    let counted = false;
    for (const arg of args) {
      const value = arg();
      if (isBlank(value)) continue;
      const b = toBoolean(value);
      if (isFormulaError(b)) return b;
      if (b === decisive) return decisive;
      counted = true;
    }
    return counted ? !decisive : VALUE;
  };
}

export const logic: FunctionTable = {
  IF: {
    min: 2,
    max: 3,
    returns: 'unknown',
    branches: (count) => (count === 3 ? [1, 2] : [1]),
    lazy: ([condition, then, otherwise]) => {
      const test = toBoolean(condition?.());
      if (isFormulaError(test)) return test;
      if (test) return then?.();
      return otherwise ? otherwise() : false;
    },
  },
  IFS: {
    min: 2,
    max: Infinity,
    returns: 'unknown',
    branches: (count) => Array.from({ length: Math.floor(count / 2) }, (_, i) => i * 2 + 1),
    lazy: (args) => {
      if (args.length % 2) return VALUE;
      for (let i = 0; i < args.length; i += 2) {
        const test = toBoolean(args[i]?.());
        if (isFormulaError(test)) return test;
        if (test) return args[i + 1]?.();
      }
      return NO_MATCH;
    },
  },
  AND: { min: 1, max: Infinity, returns: 'boolean', lazy: connective(false) },
  OR: { min: 1, max: Infinity, returns: 'boolean', lazy: connective(true) },
  NOT: {
    min: 1,
    max: 1,
    returns: 'boolean',
    fn: (value) => {
      const b = toBoolean(value);
      return isFormulaError(b) ? b : !b;
    },
  },
  IFERROR: {
    min: 2,
    max: 2,
    returns: 'unknown',
    branches: () => [0, 1],
    lazy: ([value, fallback]) => {
      const result = value?.();
      return isFormulaError(result) ? fallback?.() : result;
    },
  },
  ISBLANK: {
    min: 1,
    max: 1,
    returns: 'boolean',
    lazy: ([value]) => isBlank(value?.()),
  },
};
