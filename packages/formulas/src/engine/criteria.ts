import { isBlank, toDate } from './coerce.js';
import { isFormulaError } from './errors.js';
import { numberIn } from './range.js';

/**
 * What a value is matched by for equality: numbers (and numeric text) by value,
 * text without case, booleans, dates by time, blanks (and `""`) as `''`.
 */
export type Key = number | string | boolean;

const DATE_KEY = 'date:';

export function keyOf(value: unknown): Key {
  if (isBlank(value)) return '';
  if (typeof value === 'boolean') return value;
  if (value instanceof Date) return `${DATE_KEY}${String(value.getTime())}`;
  const n = numberIn(value);
  if (typeof n === 'number') return n;
  if (typeof value === 'string') return value.toLowerCase();
  if (isFormulaError(value)) return `#${value.code}`;
  return String(value);
}

type Relation = '<' | '<=' | '>' | '>=';

/** A comparable side of a relational criterion: what kind of values it compares with. */
export type Operand =
  | { kind: 'number'; value: number }
  | { kind: 'date'; value: number }
  | { kind: 'text'; value: string }
  | { kind: 'boolean'; value: boolean };

/** A criterion of `COUNTIF`, `SUMIF` and `AVERAGEIF`, read once. */
export type Criterion =
  | { op: '=' | '<>'; keys: readonly Key[] }
  | { op: '=' | '<>'; pattern: RegExp; source: string }
  | { op: Relation; operand: Operand };

const OPERATOR = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/;

/** `*` any characters, `?` one; `~` takes the next character as it is. */
function wildcard(text: string): RegExp {
  let source = '';
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (c === '~' && i + 1 < text.length) {
      i++;
      source += text.charAt(i).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } else if (c === '*') source += '[\\s\\S]*';
    else if (c === '?') source += '[\\s\\S]';
    else source += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`, 'i');
}

/** The keys text written in a criterion matches: as text, and as the number, boolean or date it reads as. */
function textKeys(text: string): Key[] {
  const upper = text.trim().toUpperCase();
  if (upper === 'TRUE' || upper === 'FALSE') return [upper === 'TRUE'];
  const keys: Key[] = [keyOf(text)];
  const date = toDate(text);
  if (!isFormulaError(date)) keys.push(keyOf(date));
  return keys;
}

function operandOf(text: string): Operand {
  const n = numberIn(text);
  if (typeof n === 'number') return { kind: 'number', value: n };
  const upper = text.trim().toUpperCase();
  if (upper === 'TRUE' || upper === 'FALSE') return { kind: 'boolean', value: upper === 'TRUE' };
  const date = toDate(text);
  if (!isFormulaError(date)) return { kind: 'date', value: date.getTime() };
  return { kind: 'text', value: text.toLowerCase() };
}

/**
 * Reads a criterion as spreadsheets do: a value matches equal values (text
 * without case); text may start with `=`, `<>`, `<`, `<=`, `>` or `>=`
 * (`">10"`, `"<>done"`), and `*` and `?` are wildcards in `=` and `<>` text.
 */
export function parseCriterion(criterion: unknown): Criterion {
  if (typeof criterion !== 'string') return { op: '=', keys: [keyOf(criterion)] };
  const [, op = '=', text = ''] = OPERATOR.exec(criterion) ?? [];
  if (op === '=' || op === '<>') {
    const eq = op;
    if (/[*?]/.test(text)) return { op: eq, pattern: wildcard(text), source: text };
    return { op: eq, keys: textKeys(text) };
  }
  return { op: op as Relation, operand: operandOf(text) };
}

/** A criterion as a string, the same for criteria that match the same values (a memo key). */
export function signature(c: Criterion): string {
  if ('keys' in c) return `${c.op}${c.keys.map((k) => `${typeof k}:${String(k)}`).join('|')}`;
  if ('pattern' in c) return `${c.op}~${c.source.toLowerCase()}`;
  return `${c.op}${c.operand.kind}:${String(c.operand.value)}`;
}

/** A value of a range as the kind of value `operand` compares with, or `undefined` if it isn't one. */
export function comparable(
  value: unknown,
  kind: Operand['kind'],
): number | string | boolean | undefined {
  switch (kind) {
    case 'number': {
      if (value instanceof Date) return undefined;
      const n = numberIn(value);
      return typeof n === 'number' ? n : undefined;
    }
    case 'date': {
      if (value instanceof Date) return value.getTime();
      if (typeof value !== 'string') return undefined;
      const date = toDate(value);
      return isFormulaError(date) ? undefined : date.getTime();
    }
    case 'text':
      return typeof value === 'string' && numberIn(value) === undefined
        ? value.toLowerCase()
        : undefined;
    case 'boolean':
      return typeof value === 'boolean' ? value : undefined;
  }
}

const relate = (op: Relation, order: number): boolean =>
  op === '<' ? order < 0 : op === '<=' ? order <= 0 : op === '>' ? order > 0 : order >= 0;

/** Whether a value meets a criterion (the slow path: one value at a time). */
export function meets(c: Criterion, value: unknown): boolean {
  if ('keys' in c) {
    const key = keyOf(value);
    const equal = c.keys.includes(key);
    return c.op === '=' ? equal : !equal;
  }
  if ('pattern' in c) {
    const match = typeof value === 'string' && c.pattern.test(value);
    return c.op === '=' ? match : !match;
  }
  const x = comparable(value, c.operand.kind);
  if (x === undefined) return false;
  const y = c.operand.value;
  return relate(c.op, x < y ? -1 : x > y ? 1 : 0);
}
