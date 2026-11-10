import { FormulaSyntaxError } from './errors.js';

export type TokenKind =
  'number' | 'string' | 'ref' | 'name' | 'operator' | 'comma' | 'open' | 'close' | 'end';

/**
 * A piece of a formula. `value` is the number's digits, the text without its
 * quotes, the column name without its brackets, or the name or operator as
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

/** Splits a formula into tokens, ending with an `end` token. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
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
      at++;
      for (;;) {
        if (at >= source.length) {
          throw new FormulaSyntaxError('The text has no closing quote.', start, source.length);
        }
        const c = source.charAt(at);
        if (c === '"') {
          if (source.charAt(at + 1) === '"') {
            value += '"';
            at += 2;
            continue;
          }
          at++;
          break;
        }
        value += c;
        at++;
      }
      tokens.push({ kind: 'string', value, start, end: at });
      continue;
    }

    if (char === '[') {
      const close = source.indexOf(']', at + 1);
      if (close < 0) {
        throw new FormulaSyntaxError('The column name has no closing ].', start, source.length);
      }
      const value = source.slice(at + 1, close).trim();
      at = close + 1;
      if (!value) throw new FormulaSyntaxError('The column name is empty.', start, at);
      tokens.push({ kind: 'ref', value, start, end: at });
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

    throw new FormulaSyntaxError(`Unexpected character "${char}".`, start, start + 1);
  }

  tokens.push({ kind: 'end', value: '', start: source.length, end: source.length });
  return tokens;
}
