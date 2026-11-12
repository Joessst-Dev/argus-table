import { FormulaSyntaxError } from './errors.js';
import { tokenize, type Token } from './tokenize.js';

export type BinaryOperator =
  '+' | '-' | '*' | '/' | '^' | '&' | '=' | '<>' | '<' | '<=' | '>' | '>=';

interface Span {
  /** Offset of the node's first character in the formula. */
  start: number;
  /** Offset after its last character. */
  end: number;
}

/** A formula's syntax tree. */
export type FormulaNode = Span &
  (
    | { type: 'number'; value: number }
    | { type: 'text'; value: string }
    | { type: 'boolean'; value: boolean }
    /** A column's value in this row, by the name in brackets. */
    | { type: 'ref'; name: string }
    /** A whole column (`[[name]]`): the values of the rows the filters keep. */
    | { type: 'range'; name: string }
    /** A function call; `name` is upper case. */
    | { type: 'call'; name: string; args: FormulaNode[] }
    | { type: 'unary'; operator: '-' | '+'; operand: FormulaNode }
    /** Postfix `%`: divides by 100. */
    | { type: 'percent'; operand: FormulaNode }
    | { type: 'binary'; operator: BinaryOperator; left: FormulaNode; right: FormulaNode }
  );

// How tightly each operator binds, as in spreadsheets: comparisons, then &,
// then + -, then * /, then ^ (left to right: 2^3^2 is 64), then %, then a
// leading minus (so -2^2 is 4).
const INFIX: Record<string, number> = {
  '=': 10,
  '<>': 10,
  '<': 10,
  '<=': 10,
  '>': 10,
  '>=': 10,
  '&': 20,
  '+': 30,
  '-': 30,
  '*': 40,
  '/': 40,
  '^': 50,
};
const PERCENT = 55;
const PREFIX = 60;

/**
 * Parses a formula such as `ROUND([price] * 1.19, 2)`. A leading `=` is
 * allowed and ignored.
 *
 * @throws FormulaSyntaxError, with the offsets of the bad part.
 */
export function parse(source: string): FormulaNode {
  const tokens = tokenize(source);
  let at = 0;
  const last: Token = tokens[tokens.length - 1] ?? {
    kind: 'end',
    value: '',
    start: source.length,
    end: source.length,
  };
  const peek = (): Token => tokens[at] ?? last;
  const next = (): Token => {
    const token = peek();
    if (token.kind !== 'end') at++;
    return token;
  };
  const describe = (token: Token) =>
    token.kind === 'end' ? 'the end of the formula' : `"${source.slice(token.start, token.end)}"`;
  const fail = (token: Token, message?: string): never => {
    throw new FormulaSyntaxError(
      message ?? `Unexpected ${describe(token)}.`,
      token.start,
      Math.max(token.end, token.start + 1),
    );
  };

  const prefix = (): FormulaNode => {
    const token = next();
    const { start, end } = token;
    switch (token.kind) {
      case 'number':
        return { type: 'number', value: Number(token.value), start, end };
      case 'string':
        return { type: 'text', value: token.value, start, end };
      case 'ref':
        return { type: 'ref', name: token.value, start, end };
      case 'range':
        return { type: 'range', name: token.value, start, end };
      case 'open': {
        const inner = expression(0);
        const close = next();
        if (close.kind !== 'close') fail(close, 'A ")" is missing.');
        return { ...inner, start, end: close.end };
      }
      case 'operator':
        if (token.value === '-' || token.value === '+') {
          const operand = expression(PREFIX);
          return { type: 'unary', operator: token.value, operand, start, end: operand.end };
        }
        return fail(token);
      case 'name': {
        if (peek().kind === 'open') return call(token);
        const upper = token.value.toUpperCase();
        if (upper === 'TRUE' || upper === 'FALSE') {
          return { type: 'boolean', value: upper === 'TRUE', start, end };
        }
        return fail(
          token,
          `Unknown name "${token.value}". Put column names in brackets: [${token.value}].`,
        );
      }
      case 'end':
        return fail(token, at <= 1 ? 'The formula is empty.' : 'The formula ends too early.');
      default:
        return fail(token);
    }
  };

  const call = (name: Token): FormulaNode => {
    next(); // (
    const args: FormulaNode[] = [];
    if (peek().kind !== 'close') {
      args.push(expression(0));
      while (peek().kind === 'comma') {
        next();
        args.push(expression(0));
      }
    }
    const close = next();
    if (close.kind !== 'close') {
      fail(close, `A ")" or "," is missing in ${name.value.toUpperCase()}(…).`);
    }
    return {
      type: 'call',
      name: name.value.toUpperCase(),
      args,
      start: name.start,
      end: close.end,
    };
  };

  const expression = (minPower: number): FormulaNode => {
    let left = prefix();
    for (;;) {
      const token = peek();
      if (token.kind !== 'operator') break;
      if (token.value === '%') {
        if (PERCENT <= minPower) break;
        next();
        left = { type: 'percent', operand: left, start: left.start, end: token.end };
        continue;
      }
      const power = INFIX[token.value];
      if (power === undefined || power <= minPower) break;
      next();
      const right = expression(power);
      left = {
        type: 'binary',
        operator: token.value as BinaryOperator,
        left,
        right,
        start: left.start,
        end: right.end,
      };
    }
    return left;
  };

  if (peek().kind === 'operator' && peek().value === '=') next();
  const tree = expression(0);
  const rest = peek();
  if (rest.kind !== 'end') {
    fail(rest, rest.kind === 'close' ? 'There is a ")" too many.' : undefined);
  }
  return tree;
}

/**
 * The column names a formula refers to, each once, in order of appearance: in
 * this row (`[name]`) and as whole columns (`[[name]]`), or only as whole
 * columns with `wholeOnly`.
 */
export function refsOf(node: FormulaNode, wholeOnly = false): string[] {
  const names = new Set<string>();
  const visit = (n: FormulaNode): void => {
    switch (n.type) {
      case 'ref':
        if (!wholeOnly) names.add(n.name);
        break;
      case 'range':
        names.add(n.name);
        break;
      case 'call':
        n.args.forEach(visit);
        break;
      case 'unary':
      case 'percent':
        visit(n.operand);
        break;
      case 'binary':
        visit(n.left);
        visit(n.right);
        break;
      default:
        break;
    }
  };
  visit(node);
  return [...names];
}
