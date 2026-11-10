import { describe, expect, it } from 'vitest';
import { FormulaSyntaxError } from './errors.js';
import { parse, refsOf, type FormulaNode } from './parse.js';
import { tokenize } from './tokenize.js';

/** The tree as compact text: `(+ 1 (* 2 3))`. */
function show(node: FormulaNode): string {
  switch (node.type) {
    case 'number':
      return String(node.value);
    case 'text':
      return JSON.stringify(node.value);
    case 'boolean':
      return node.value ? 'TRUE' : 'FALSE';
    case 'ref':
      return `[${node.name}]`;
    case 'call':
      return `${node.name}(${node.args.map(show).join(', ')})`;
    case 'unary':
      return `(${node.operator}${show(node.operand)})`;
    case 'percent':
      return `(${show(node.operand)}%)`;
    case 'binary':
      return `(${node.operator} ${show(node.left)} ${show(node.right)})`;
  }
}

const tree = (formula: string) => show(parse(formula));

function syntaxError(formula: string): FormulaSyntaxError {
  try {
    parse(formula);
  } catch (error) {
    if (error instanceof FormulaSyntaxError) return error;
    throw error;
  }
  throw new Error(`"${formula}" parsed`);
}

describe('tokenize', () => {
  it('reads every kind of token with its offsets', () => {
    expect(tokenize('ROUND([Unit price] * 1.5e2, "a""b") <> TRUE')).toEqual([
      { kind: 'name', value: 'ROUND', start: 0, end: 5 },
      { kind: 'open', value: '(', start: 5, end: 6 },
      { kind: 'ref', value: 'Unit price', start: 6, end: 18 },
      { kind: 'operator', value: '*', start: 19, end: 20 },
      { kind: 'number', value: '1.5e2', start: 21, end: 26 },
      { kind: 'comma', value: ',', start: 26, end: 27 },
      { kind: 'string', value: 'a"b', start: 28, end: 34 },
      { kind: 'close', value: ')', start: 34, end: 35 },
      { kind: 'operator', value: '<>', start: 36, end: 38 },
      { kind: 'name', value: 'TRUE', start: 39, end: 43 },
      { kind: 'end', value: '', start: 43, end: 43 },
    ]);
  });

  it('reads two-character operators first', () => {
    expect(tokenize('<=>=<>').map((t) => t.value)).toEqual(['<=', '>=', '<>', '']);
  });

  it('trims column names', () => {
    expect(tokenize('[ price ]')[0]?.value).toBe('price');
  });

  it('reports unclosed text and column names, empty names and stray characters', () => {
    expect(syntaxError('"abc')).toMatchObject({ start: 0, end: 4 });
    expect(syntaxError('[abc').message).toMatch(/closing \]/);
    expect(syntaxError('[ ]').message).toMatch(/empty/);
    expect(syntaxError('1 $ 2')).toMatchObject({ start: 2, end: 3 });
  });
});

describe('parse', () => {
  it.each([
    ['1 + 2 * 3', '(+ 1 (* 2 3))'],
    ['(1 + 2) * 3', '(* (+ 1 2) 3)'],
    ['1 - 2 - 3', '(- (- 1 2) 3)'],
    // Left to right, as in spreadsheets.
    ['2 ^ 3 ^ 2', '(^ (^ 2 3) 2)'],
    // A leading minus binds tighter than ^: -2^2 is 4.
    ['-2 ^ 2', '(^ (-2) 2)'],
    ['2 * -3', '(* 2 (-3))'],
    ['50%', '(50%)'],
    ['2 ^ 50%', '(^ 2 (50%))'],
    ['10 * 5% + 1', '(+ (* 10 (5%)) 1)'],
    ['"a" & 1 + 2', '(& "a" (+ 1 2))'],
    ['1 + 2 = 3 & ""', '(= (+ 1 2) (& 3 ""))'],
    ['[a] >= [b]', '(>= [a] [b])'],
    ['+[a]', '(+[a])'],
    ['true', 'TRUE'],
    ['False', 'FALSE'],
    ['round([x], 2)', 'ROUND([x], 2)'],
    ['TODAY()', 'TODAY()'],
    [
      'IF([a] > 1, "big", IF([a] > 0, "small", "none"))',
      'IF((> [a] 1), "big", IF((> [a] 0), "small", "none"))',
    ],
    ['= [a] * 2', '(* [a] 2)'],
  ])('%s', (formula, expected) => {
    expect(tree(formula)).toBe(expected);
  });

  it('keeps each node’s span', () => {
    const node = parse('ROUND([a] * 2, 1)');
    expect(node).toMatchObject({ type: 'call', start: 0, end: 17 });
    if (node.type !== 'call') throw new Error('not a call');
    expect(node.args[0]).toMatchObject({ type: 'binary', start: 6, end: 13 });
  });

  it.each([
    ['', /empty/, 0, 1],
    ['=', /empty/, 1, 2],
    ['1 +', /ends too early/, 3, 4],
    ['(1 + 2', /\)" is missing/, 6, 7],
    ['1 + 2)', /too many/, 5, 6],
    ['SUM(1, 2', /missing in SUM/, 8, 9],
    ['SUM(1,)', /Unexpected "\)"/, 6, 7],
    ['price * 2', /Put column names in brackets: \[price\]/, 0, 5],
    ['1 2', /Unexpected "2"/, 2, 3],
    ['* 2', /Unexpected "\*"/, 0, 1],
  ])('reports %j', (formula, message, start, end) => {
    const error = syntaxError(formula);
    expect(error.message).toMatch(message);
    expect([error.start, error.end]).toEqual([start, end]);
  });
});

describe('refsOf', () => {
  it('lists each column once, in order', () => {
    expect(refsOf(parse('IF([b] > 0, [a] / [b], -[c]%) & [a]'))).toEqual(['b', 'a', 'c']);
  });
});
