import { describe, expect, it } from 'vitest';
import { analyze } from './graph.js';

const graph = (edges: Record<string, string[]>) => analyze(new Map(Object.entries(edges)));

describe('analyze', () => {
  it('puts the columns a formula uses before it', () => {
    const { order, cyclic } = graph({ gross: ['total'], total: ['net'], net: [], other: [] });
    expect(order.indexOf('net')).toBeLessThan(order.indexOf('total'));
    expect(order.indexOf('total')).toBeLessThan(order.indexOf('gross'));
    expect(order).toHaveLength(4);
    expect(cyclic.size).toBe(0);
  });

  it('ignores names that aren’t formula columns', () => {
    expect(graph({ a: ['price', 'b'], b: [] }).order).toEqual(['b', 'a']);
  });

  it('finds a column that uses itself', () => {
    const { order, cyclic } = graph({ a: ['a'], b: ['a'] });
    expect([...cyclic]).toEqual(['a']);
    expect(order).toEqual(['a', 'b']);
  });

  it('finds every column of a loop, but not the columns using it', () => {
    const { order, cyclic } = graph({ a: ['b'], b: ['c'], c: ['a'], d: ['c'], e: [] });
    expect([...cyclic].sort()).toEqual(['a', 'b', 'c']);
    expect(order.indexOf('d')).toBeGreaterThan(order.indexOf('c'));
    expect(order).toHaveLength(5);
  });

  it('handles two loops apart', () => {
    const { cyclic } = graph({ a: ['b'], b: ['a'], c: ['d'], d: ['c'], e: ['a', 'c'] });
    expect([...cyclic].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
