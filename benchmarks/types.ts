// The shape of a results file: written by run.ts, merged by merge.ts and read by
// the Storybook "Benchmarks" page (apps/storybook/stories/benchmarks.mdx).

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
export type Scenario = 'steady' | 'fast' | 'jumps' | 'horizontal' | 'wheel';

/** Frame timing for one scroll scenario: the median over the runs. */
export interface ScrollStats {
  frames: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  over50: number;
  longTasks: number | null;
  longTaskMax: number | null;
  blankFrames: number;
  mismatches: number;
  shadowNodes: number;
  lightNodes: number;
  renderedRows: number;
  /**
   * Every run scrolled the body. False when the body can't scroll at all: Firefox
   * drops a height over its maximum to 0, so at 1M rows nothing scrolls and the
   * frame times would look perfect.
   */
  scrolled: boolean;
  /** jumps only: median and max of the slowest frame after each jump. */
  jumpP50: number | null;
  jumpMax: number | null;
}

/** Per page rather than per scenario: load, sort, memory and the reach-the-end check. */
export interface PageStats {
  /** Generating the fake rows (not the table's cost). */
  dataMs: number;
  /** Appending the table to the frame that paints its first rows. */
  loadMs: number;
  /** Setting `sorting` to the frame that paints the sorted rows; null if it took longer than `sortTimeoutMs`. */
  sortMs: number | null;
  /** Chromium only: JS heap after mounting minus the heap with the data alone, after GC. */
  tableHeapMB: number | null;
  /** Chromium only: JS heap after the scroll scenarios minus after mounting, after GC. */
  growthMB: number | null;
  /** Chromium only: DOM nodes in the document after mounting. */
  domNodes: number | null;
  /** The highest body row reached by scrolling to the bottom and by `scrollToRow()` (worst run). */
  lastByScroll: number;
  lastByMethod: number;
  /** Every run reached the last row both ways. */
  reachable: boolean;
}

export interface ScrollResult {
  browser: BrowserName;
  rows: number;
  variant: string;
  scenario: Scenario;
  stats: ScrollStats;
}

export interface PageResult {
  browser: BrowserName;
  rows: number;
  variant: string;
  stats: PageStats;
}

export interface Meta {
  date: string;
  /** The `argus-table` version measured: `0.2.0` on its release tag, `0.2.0+<commit>` otherwise. */
  version: string;
  runner: string;
  os: string;
  cpu: string;
  versions: Partial<Record<BrowserName, string>>;
  runs: number;
  rows: number[];
  variants: string[];
  columns: number;
  gate: { p95: number; longTask: number };
  /** A sort that takes longer is abandoned (the page is closed) and reported as null. */
  sortTimeoutMs: number;
}

export interface Results {
  meta: Meta;
  results: ScrollResult[];
  pages: PageResult[];
}
