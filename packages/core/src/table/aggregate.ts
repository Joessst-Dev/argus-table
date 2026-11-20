import { isEmptyValue, numberOf } from '../filters/filter.js';
import type { ColumnAggregate } from '../types.js';

const isDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

/**
 * A group's total of a column's values (`ColumnDef.aggregate`). `sum` and `avg`
 * read numbers (and numeric strings); `min` and `max` numbers or dates; `count`
 * counts values that aren't empty. `rowIds` is asked for only by a function.
 */
export function aggregate(
  kind: ColumnAggregate,
  values: readonly unknown[],
  rowIds: () => readonly string[],
): unknown {
  if (typeof kind === 'function') {
    return kind(values, {
      get rowIds() {
        return rowIds();
      },
    });
  }
  if (kind === 'count') return values.filter((v) => !isEmptyValue(v)).length;
  let sum = 0;
  let n = 0;
  let best: unknown;
  let bestKey = 0;
  for (const value of values) {
    const date = isDate(value);
    const number = date ? value.getTime() : numberOf(value);
    if (number === undefined || (date && (kind === 'sum' || kind === 'avg'))) continue;
    sum += number;
    n++;
    if (best === undefined || (kind === 'min' ? number < bestKey : number > bestKey)) {
      best = date ? value : number;
      bestKey = number;
    }
  }
  if (kind === 'sum') return sum;
  if (kind === 'avg') return n === 0 ? undefined : sum / n;
  return best;
}
