// The Markdown summary of a results file, for the terminal, results/*.md and the
// GitHub job summary. Shared by run.ts and merge.ts.
import type { Meta, PageStats, Results, ScrollStats } from './types.ts';

/** Scroll gate: p95 within budget and no long task (or frame, where long tasks aren't observable) over the limit. */
export function scrollVerdict(s: ScrollStats, gate: Meta['gate']): 'pass' | 'FAIL' {
  if (!s.scrolled) return 'FAIL';
  const longTaskOk = s.longTaskMax === null ? s.over50 === 0 : s.longTaskMax <= gate.longTask;
  return s.p95 <= gate.p95 && longTaskOk ? 'pass' : 'FAIL';
}

/** Page gate: every run reached the last row. (Load and sort times are reported, not gated.) */
export const pageVerdict = (s: PageStats): 'pass' | 'FAIL' => (s.reachable ? 'pass' : 'FAIL');

const n = (value: number | null): string => (value === null ? 'n/a' : String(value));
function rows(count: number): string {
  if (count >= 1_000_000 && count % 1_000_000 === 0) return `${String(count / 1_000_000)}M`;
  if (count >= 1000 && count % 1000 === 0) return `${String(count / 1000)}k`;
  return String(count);
}

export function toMarkdown({ meta, results, pages }: Results): string {
  const withVariant = meta.variants.length > 0;
  const v = (variant: string) => (withVariant ? ` ${variant} |` : '');
  const vh = withVariant ? ' Variant |' : '';
  const vs = withVariant ? ' --- |' : '';
  const lines = [
    `## argus-table ${meta.version} benchmark`,
    '',
    `${meta.date} · ${meta.runner} · ${meta.os} · ${meta.cpu} · median of ${String(meta.runs)} runs`,
    '',
    `Browsers: ${Object.entries(meta.versions)
      .map(([k, version]) => `${k} ${version}`)
      .join(', ')}`,
    '',
    `Gate: p95 ≤ ${String(meta.gate.p95)} ms and no long task > ${String(meta.gate.longTask)} ms while scrolling, and the last row reachable. Advisory: this run never fails a PR.`,
    'Long tasks come from PerformanceObserver in Chromium; elsewhere "frames > 50 ms" stands in. `wheel` drives real input through Playwright and its frame pacing is limited by the harness, so it is a sanity check, not a gate.',
    `Page: apps/playground, ${meta.rows.map(rows).join(' / ')} rows × ${String(meta.columns)} columns, slotted cell content, pooled rows. Scenarios: steady = 60 px/frame for 10 s; fast = 240 px/frame for 10 s; jumps = 20 random jumps held 500 ms; horizontal = 60 px/frame for 5 s, back and forth across the width.`,
    '',
    '### Scrolling',
    '',
    `| Rows | Browser |${vh} Scenario | p50 | p95 | p99 | max | jump frame p50 / max | frames > 50 ms | long tasks (max) | blank frames | wrong content | rendered rows | light-DOM nodes | Gate |`,
    `| --: | --- |${vs} --- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --- |`,
  ];
  for (const { browser, rows: count, variant, scenario, stats: s } of results) {
    const lt = s.longTasks === null ? 'n/a' : `${String(s.longTasks)} (${n(s.longTaskMax)})`;
    const jump = s.jumpP50 === null ? '' : `${String(s.jumpP50)} / ${n(s.jumpMax)}`;
    lines.push(
      `| ${rows(count)} | ${browser} |${v(variant)} ${scenario}${s.scrolled ? '' : ' (didn’t scroll)'} | ${String(s.p50)} | ${String(s.p95)} | ${String(s.p99)} | ${String(s.max)} | ${jump} | ${String(s.over50)} | ${lt} | ${String(s.blankFrames)} | ${String(s.mismatches)} | ${String(s.renderedRows)} | ${String(s.lightNodes)} | ${scrollVerdict(s, meta.gate)} |`,
    );
  }
  lines.push(
    '',
    '### Load, sort, memory',
    '',
    'Load: appending the table to the frame that paints its rows. Sort: setting `sorting` (by amount) to the frame that paints the sorted rows. Data: generating the rows, which is the page’s cost, not the table’s. Memory (Chromium only, after a forced GC): the JS heap the mounted table adds to the data, its growth over the scroll scenarios, and the document’s DOM nodes. Last row: the highest row index reached by scrolling to the bottom / by `scrollToRow()`.',
    '',
    `| Rows | Browser |${vh} data ms | load ms | sort ms | table heap MB | heap growth MB | DOM nodes | last row (scroll / method) | Gate |`,
    `| --: | --- |${vs} --: | --: | --: | --: | --: | --: | --: | --- |`,
  );
  for (const { browser, rows: count, variant, stats: s } of pages) {
    lines.push(
      `| ${rows(count)} | ${browser} |${v(variant)} ${String(s.dataMs)} | ${String(s.loadMs)} | ${s.sortMs === null ? `> ${String(meta.sortTimeoutMs)}` : String(s.sortMs)} | ${n(s.tableHeapMB)} | ${n(s.growthMB)} | ${n(s.domNodes)} | ${String(s.lastByScroll)} / ${String(s.lastByMethod)} of ${String(count - 1)} | ${pageVerdict(s)} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}
