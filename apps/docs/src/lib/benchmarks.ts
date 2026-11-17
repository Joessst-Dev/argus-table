// The benchmark tables of the performance guide, from a results file
// (benchmarks/published/latest.json): one row per browser for a size, as
// display strings, with the gate verdicts the benchmark tools use. Storybook's
// Benchmarks page showed the same.
import { pageVerdict, scrollVerdict } from '../../../../benchmarks/markdown.ts';
import type { Results, Scenario } from '../../../../benchmarks/types.ts';

/** `10000` → `10k`, `1000000` → `1M`. */
export function sizeLabel(rows: number): string {
  if (rows >= 1e6 && rows % 1e6 === 0) return `${String(rows / 1e6)}M`;
  if (rows >= 1e3 && rows % 1e3 === 0) return `${String(rows / 1e3)}k`;
  return String(rows);
}

/** One browser's results for one size, ready to show. */
export interface BenchmarkRow {
  browser: string;
  steady: string;
  fast: string;
  jumps: string;
  sideways: string;
  longTasks: string;
  blankWrong: string;
  load: string;
  sort: string;
  heap: string;
  growth: string;
  lastRow: string;
  gate: 'pass' | 'FAIL';
}

/** The scroll scenarios the gate counts (`wheel` is a sanity check only). */
const GATED: readonly Scenario[] = ['steady', 'fast', 'jumps', 'horizontal'];

const mb = (value: number | null) => (value === null ? 'n/a' : `${String(value)} MB`);

/**
 * The rows of the table for `rows` rows: one per browser with page results for
 * that size. A missing scroll result reads `n/a` and fails the gate.
 */
export function benchmarkRows(results: Results, rows: number): BenchmarkRow[] {
  const { meta } = results;
  return results.pages
    .filter((page) => page.rows === rows)
    .map(({ browser, stats: page }): BenchmarkRow => {
      const scroll = (scenario: Scenario) =>
        results.results.find(
          (r) => r.rows === rows && r.browser === browser && r.scenario === scenario,
        )?.stats;
      const runs = GATED.map(scroll);
      const present = runs.filter((s) => s !== undefined);
      const p95 = (scenario: Scenario) => {
        const stats = scroll(scenario);
        if (!stats) return 'n/a';
        return stats.scrolled ? `${String(stats.p95)} ms` : 'didn’t scroll';
      };
      const longTasks = present.some((s) => s.longTasks !== null)
        ? String(present.reduce((sum, s) => sum + (s.longTasks ?? 0), 0))
        : `${String(present.reduce((sum, s) => sum + s.over50, 0))} frames > 50 ms`;
      const blank = present.reduce((sum, s) => sum + s.blankFrames, 0);
      const wrong = present.reduce((sum, s) => sum + s.mismatches, 0);
      const pass =
        pageVerdict(page) === 'pass' &&
        runs.every((s) => s !== undefined && scrollVerdict(s, meta.gate) === 'pass');
      return {
        browser,
        steady: p95('steady'),
        fast: p95('fast'),
        jumps: p95('jumps'),
        sideways: p95('horizontal'),
        longTasks,
        blankWrong: `${String(blank)} / ${String(wrong)}`,
        load: `${String(page.loadMs)} ms`,
        sort:
          page.sortMs === null
            ? `> ${String(meta.sortTimeoutMs / 1000)} s`
            : `${String(page.sortMs)} ms`,
        heap: mb(page.tableHeapMB),
        growth: mb(page.growthMB),
        lastRow: page.reachable
          ? 'reached'
          : `stops at ${Math.min(page.lastByScroll, page.lastByMethod).toLocaleString('en')}`,
        gate: pass ? 'pass' : 'FAIL',
      };
    });
}
