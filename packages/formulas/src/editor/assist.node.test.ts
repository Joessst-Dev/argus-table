import { describe, expect, it } from 'vitest';
import { tokenize } from '../engine/tokenize.js';
import { callAt, completionAt, highlight } from './assist.js';

/** A formula with its cursor marked by one `|`: the formula without it, and the cursor's offset. */
function unmark(marked: string): { source: string; cursor: number } {
  const parts = marked.split('|');
  if (parts.length !== 2) throw new Error(`mark the cursor once: ${marked}`);
  const [before = '', after = ''] = parts;
  return { source: before + after, cursor: before.length };
}

const FUNCTIONS = ['ABS', 'AND', 'AVERAGE', 'IF', 'IFERROR', 'ROUND', 'ROUNDUP', 'TODAY', 'TRIM'];
const COLUMNS = ['Unit price', 'Quantity', 'Total', 'Status'];

describe('tokenize, lenient', () => {
  it('marks what can’t be read and goes on', () => {
    expect(tokenize('1 $ [a', true).map((t) => [t.kind, t.value])).toEqual([
      ['number', '1'],
      ['error', '$'],
      ['error', '[a'],
      ['end', ''],
    ]);
    expect(tokenize('"open', true).map((t) => t.kind)).toEqual(['error', 'end']);
    expect(tokenize('[] + 1', true).map((t) => t.kind)).toEqual([
      'error',
      'operator',
      'number',
      'end',
    ]);
  });
});

describe('highlight', () => {
  it('covers the whole formula, spaces included, by kind', () => {
    const segments = highlight('ROUND([Total] * 1.19, 2) & "x" <> TRUE');
    expect(segments.map((s) => s.text).join('')).toBe('ROUND([Total] * 1.19, 2) & "x" <> TRUE');
    expect(segments.filter((s) => s.kind !== 'plain').map((s) => [s.kind, s.text])).toEqual([
      ['function', 'ROUND'],
      ['operator', '('],
      ['ref', '[Total]'],
      ['operator', '*'],
      ['number', '1.19'],
      ['operator', ','],
      ['number', '2'],
      ['operator', ')'],
      ['operator', '&'],
      ['text', '"x"'],
      ['operator', '<>'],
      ['boolean', 'TRUE'],
    ]);
    expect(segments.find((s) => s.text === '[Total]')?.start).toBe(6);
  });

  it('marks bare names and unreadable parts', () => {
    expect(highlight('price + "a').map((s) => s.kind)).toEqual([
      'name',
      'plain',
      'operator',
      'plain',
      'error',
    ]);
  });
});

describe('callAt', () => {
  it.each([
    ['ROUND(|', { name: 'ROUND', argument: 0 }],
    ['ROUND([a], |', { name: 'ROUND', argument: 1 }],
    ['round(1,2|', { name: 'ROUND', argument: 1 }],
    ['IF([a] > 1, ROUND(|', { name: 'ROUND', argument: 0 }],
    ['IF([a] > 1, ROUND(2), |', { name: 'IF', argument: 2 }],
    ['IF((1 + |', { name: 'IF', argument: 0 }],
    ['ROUND(1)|', undefined],
    ['[a] + |', undefined],
    ['ROUND|', undefined],
  ])('%s', (marked, expected) => {
    const { source, cursor } = unmark(marked);
    expect(callAt(source, cursor)).toEqual(expected);
  });

  it('only counts what is before the cursor', () => {
    expect(callAt('ROUND(1, 2)', 7)).toEqual({ name: 'ROUND', argument: 0 });
  });
});

describe('completionAt', () => {
  const at = (marked: string) => {
    const { source, cursor } = unmark(marked);
    return completionAt(source, cursor, COLUMNS, FUNCTIONS);
  };

  it('offers columns after an unclosed [, starting matches first', () => {
    expect(at('[|')?.items.map((i) => i.label)).toEqual(COLUMNS);
    const t = at('1 + [t|');
    expect(t?.items.map((i) => i.label)).toEqual(['Total', 'Unit price', 'Quantity', 'Status']);
    expect(t).toMatchObject({ from: 4, to: 6 });
    expect(t?.items[0]).toEqual({ label: 'Total', insert: '[Total]', kind: 'column' });
  });

  it('replaces the whole name when the bracket is already closed', () => {
    expect(at('[Tot|al] * 2')).toMatchObject({ from: 0, to: 7 });
  });

  it('offers functions and TRUE/FALSE for a name being typed', () => {
    const r = at('1 + ro|');
    expect(r?.items.map((i) => i.insert)).toEqual(['ROUND(', 'ROUNDUP(']);
    expect(r).toMatchObject({ from: 4, to: 6 });
    expect(at('t|')?.items.map((i) => i.label)).toEqual(['TODAY', 'TRIM', 'TRUE']);
  });

  it('doesn’t add a parenthesis that is already there, nor offer the name typed', () => {
    expect(at('ro|(1)')?.items.map((i) => i.insert)).toEqual(['ROUND', 'ROUNDUP']);
    expect(at('ROUND|(1)')?.items.map((i) => i.insert)).toEqual(['ROUNDUP']);
  });

  it('offers nothing in text, in numbers, right after a value, or without a match', () => {
    expect(at('"ro|')).toBeUndefined();
    expect(at('"a "" ro|')).toBeUndefined();
    expect(at('1e|')).toBeUndefined();
    expect(at('[a]r|')).toBeUndefined();
    expect(at('xyz|')).toBeUndefined();
    expect(at('[zzz|')).toBeUndefined();
    expect(at('|')).toBeUndefined();
  });

  it('works again after text and a closed column', () => {
    expect(at('"a" & [Total] & ro|')?.items[0]?.label).toBe('ROUND');
  });
});
