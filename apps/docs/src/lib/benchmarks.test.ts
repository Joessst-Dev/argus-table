import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { Results } from '../../../../benchmarks/types.ts';
import { benchmarkRows, sizeLabel } from './benchmarks';

const latest = JSON.parse(
  readFileSync(new URL('../../../../benchmarks/published/latest.json', import.meta.url), 'utf8'),
) as Results;

/** The real results, with `change` applied to a copy. */
function edited(change: (results: Results) => void): Results {
  const copy = structuredClone(latest);
  change(copy);
  return copy;
}

describe('sizeLabel', () => {
  test('names sizes in thousands and millions', () => {
    expect([10_000, 100_000, 1_000_000, 1_500, 12_345].map(sizeLabel)).toEqual([
      '10k',
      '100k',
      '1M',
      '1500',
      '12345',
    ]);
  });
});

describe('benchmarkRows', () => {
  test('one row per browser for every measured size', () => {
    for (const rows of latest.meta.rows) {
      const table = benchmarkRows(latest, rows);
      expect(table.map((r) => r.browser).sort()).toEqual(
        latest.pages
          .filter((p) => p.rows === rows)
          .map((p) => p.browser)
          .sort(),
      );
      for (const row of table) {
        expect(['pass', 'FAIL']).toContain(row.gate);
        expect(row.steady).toMatch(/^[\d.]+ ms$|^didn’t scroll$/);
        expect(row.load).toMatch(/^\d+ ms$/);
      }
    }
  });

  test('a missing scroll result reads n/a and fails the gate', () => {
    const [rows] = latest.meta.rows;
    if (rows === undefined) throw new Error('no sizes');
    const results = edited((r) => {
      r.results = r.results.filter(
        (s) => !(s.rows === rows && s.browser === 'chromium' && s.scenario === 'fast'),
      );
    });
    const chromium = benchmarkRows(results, rows).find((r) => r.browser === 'chromium');
    expect(chromium).toMatchObject({ fast: 'n/a', gate: 'FAIL' });
  });

  test('an abandoned sort and an unreachable last row', () => {
    const [rows] = latest.meta.rows;
    if (rows === undefined) throw new Error('no sizes');
    const results = edited((r) => {
      const page = r.pages.find((p) => p.rows === rows && p.browser === 'firefox');
      if (!page) throw new Error('no firefox page');
      page.stats.sortMs = null;
      page.stats.reachable = false;
      page.stats.lastByScroll = 99_999;
      page.stats.lastByMethod = 123_456;
    });
    const firefox = benchmarkRows(results, rows).find((r) => r.browser === 'firefox');
    expect(firefox).toMatchObject({
      sort: `> ${String(latest.meta.sortTimeoutMs / 1000)} s`,
      lastRow: 'stops at 99,999',
      gate: 'FAIL',
    });
  });

  test('a body that couldn’t scroll says so and fails', () => {
    const [rows] = latest.meta.rows;
    if (rows === undefined) throw new Error('no sizes');
    const results = edited((r) => {
      const steady = r.results.find(
        (s) => s.rows === rows && s.browser === 'webkit' && s.scenario === 'steady',
      );
      if (!steady) throw new Error('no webkit steady');
      steady.stats.scrolled = false;
    });
    const webkit = benchmarkRows(results, rows).find((r) => r.browser === 'webkit');
    expect(webkit).toMatchObject({ steady: 'didn’t scroll', gate: 'FAIL' });
  });

  test('a size nobody measured has no rows', () => {
    expect(benchmarkRows(latest, 42)).toEqual([]);
  });
});
