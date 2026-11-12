import { FormulaSyntaxError } from './errors.js';

export type TokenKind =
  | 'number'
  | 'string'
  | 'ref'
  /** A whole column: `[[name]]`. */
  | 'range'
  | 'name'
  | 'operator'
  | 'comma'
  | 'open'
  | 'close'
  | 'end'
  /** Only in lenient mode: a part that can't be read (an unclosed text, a stray character). */
  | 'error';

/**
 * A piece of a formula. `value` is the number's digits, the text without its
 * quotes, the column name without its brackets (one pair, or two for a whole
 * column), or the name or operator as
 * written. `start` and `end` are offsets into the formula.
 */
export interface Token {
  kind: TokenKind;
  value: string;
  start: number;
  end: number;
}

const OPERATORS = ['<=', '>=', '<>', '+', '-', '*', '/', '^', '%', '&', '=', '<', '>'];
const NUMBER = /\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?/y;
const NAME = /[A-Za-z_][A-Za-z0-9_.]*/y;
const SPACE = /\s+/y;

/**
 * Splits a formula into tokens, ending with an `end` token.
 *
 * @param lenient - instead of throwing, mark what can't be read as an `error`
 *   token and go on (for syntax highlighting while the formula is typed).
 * @throws FormulaSyntaxError, unless `lenient`.
 */
export function tokenize(source: string, lenient = false): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  // Throws, or in lenient mode records the bad part and moves past it.
  const bad = (message: string, start: number, end: number): void => {
    if (!lenient) throw new FormulaSyntaxError(message, start, end);
    tokens.push({ kind: 'error', value: source.slice(start, end), start, end });
    at = end;
  };
  const match = (pattern: RegExp): string | undefined => {
    pattern.lastIndex = at;
    return pattern.exec(source)?.[0];
  };

  while (at < source.length) {
    const space = match(SPACE);
    if (space) {
      at += space.length;
      continue;
    }
    const start = at;
    const char = source.charAt(at);

    if (char === '"') {
      // Text in double quotes; "" inside it is one quote.
      let value = '';
      let closed = false;
      at++;
      while (at < source.length) {
        const c = source.charAt(at);
        if (c === '"') {
          if (source.charAt(at + 1) === '"') {
            value += '"';
            at += 2;
            continue;
          }
          at++;
          closed = true;
          break;
        }
        value += c;
        at++;
      }
      if (closed) tokens.push({ kind: 'string', value, start, end: at });
      else bad('The text has no closing quote.', start, source.length);
      continue;
    }

    if (source.startsWith('[[', at)) {
      // A whole column: [[name]].
      const close = source.indexOf(']]', at + 2);
      if (close < 0) {
        bad('The column name has no closing ]].', start, source.length);
        continue;
      }
      const value = source.slice(at + 2, close).trim();
      if (value) tokens.push({ kind: 'range', value, start, end: close + 2 });
      else bad('The column name is empty.', start, close + 2);
      at = close + 2;
      continue;
    }

    if (char === '[') {
      const close = source.indexOf(']', at + 1);
      if (close < 0) {
        bad('The column name has no closing ].', start, source.length);
        continue;
      }
      const value = source.slice(at + 1, close).trim();
      if (value) tokens.push({ kind: 'ref', value, start, end: close + 1 });
      else bad('The column name is empty.', start, close + 1);
      at = close + 1;
      continue;
    }

    const number = match(NUMBER);
    if (number) {
      at += number.length;
      tokens.push({ kind: 'number', value: number, start, end: at });
      continue;
    }

    const name = match(NAME);
    if (name) {
      at += name.length;
      tokens.push({ kind: 'name', value: name, start, end: at });
      continue;
    }

    const operator = OPERATORS.find((op) => source.startsWith(op, at));
    if (operator) {
      at += operator.length;
      tokens.push({ kind: 'operator', value: operator, start, end: at });
      continue;
    }

    const single = char === ',' ? 'comma' : char === '(' ? 'open' : char === ')' ? 'close' : null;
    if (single) {
      at++;
      tokens.push({ kind: single, value: char, start, end: at });
      continue;
    }

    bad(`Unexpected character "${char}".`, start, start + 1);
  }

  tokens.push({ kind: 'end', value: '', start: source.length, end: source.length });
  return tokens;
}
