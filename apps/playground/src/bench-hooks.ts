// In-page measurement for benchmarks/run.ts. Scenarios run inside the page so
// they are deterministic and identical in every engine.
import type { ArgusTable } from 'argus-table';
import { seeded, type Person } from './data.js';

export interface ScenarioResult {
  frames: number[];
  blankFrames: number;
  longTasks: number[];
  shadowNodes: number;
  lightNodes: number;
  renderedRows: number;
  /** The furthest the body scrolled during the scenario (px); 0 means it didn't scroll at all. */
  maxScrollTop: number;
  /** jumps only: the slowest frame right after each jump (ms). */
  jumpFrames?: number[];
  mismatches?: number;
}

export interface MountResult {
  /** From appending the table to the first frame with its rows painted (ms). */
  loadMs: number;
}

export interface SortResult {
  /** From setting `sorting` to the first frame with the sorted rows painted (ms). */
  sortMs: number;
}

export interface ReachEndResult {
  /** The last body row index the table should show. */
  expected: number;
  /** The highest body row index rendered after scrolling to the very bottom. */
  byScroll: number;
  /** The highest body row index rendered after `scrollToRow(expected)`. */
  byMethod: number;
  /** Both ways reach the last row. False once the rows outgrow the engine's maximum element height. */
  reachable: boolean;
}

/** Body rows only: pinned rows (`pinned=…`) also carry the `row` part. */
const BODY_ROWS = '[part~="body"] > [part~="row"]';

/** A body row's index: `aria-rowindex` after the header and the rows pinned to the top. */
const bodyIndex = (table: ArgusTable<Person>, row: Element) =>
  Number(row.getAttribute('aria-rowindex')) - 2 - (table.pinnedRows?.top?.length ?? 0);

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function installBenchHooks(table: ArgusTable<Person>, info: { dataMs: number }): void {
  const root = () => table.shadowRoot;
  const scroller = () => root()?.querySelector<HTMLElement>('[part~="table"]') ?? null;
  const rows = () => [...(root()?.querySelectorAll<HTMLElement>(BODY_ROWS) ?? [])];
  const rowHeight = () => rows()[0]?.getBoundingClientRect().height ?? 40;

  let recording = false;
  let frames: number[] = [];
  let blankFrames = 0;
  let longTasks: number[] = [];
  let last = 0;
  let maxScrollTop = 0;

  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    new PerformanceObserver((list) => {
      if (!recording) return;
      for (const entry of list.getEntries()) longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: false });
  }

  /**
   * A frame is blank if the rendered rows don't cover the visible body area: below
   * the header and top pinned rows, above the bottom ones (or down to the last
   * row). Measured on screen, not from row index × height: once the body is
   * taller than the engine renders, its scroll position is scaled.
   */
  const isBlank = (el: HTMLElement): boolean => {
    const rendered = rows();
    if (rendered.length === 0) return true;
    const box = el.getBoundingClientRect();
    const side = (s: string) =>
      root()?.querySelector(`.pinned[data-side="${s}"]`)?.getBoundingClientRect().height ?? 0;
    const header = root()?.querySelector('[part~="header"]')?.getBoundingClientRect().height ?? 0;
    const viewTop = box.top + header + side('top');
    const viewBottom = box.top + el.clientHeight - side('bottom');
    let top = Infinity;
    let bottom = -Infinity;
    let showsLastRow = false;
    for (const row of rendered) {
      const rect = row.getBoundingClientRect();
      top = Math.min(top, rect.top);
      bottom = Math.max(bottom, rect.bottom);
      if (bodyIndex(table, row) === table.data.length - 1) showsLastRow = true;
    }
    return top > viewTop + 1 || (bottom < viewBottom - 1 && !showsLastRow);
  };

  const tick = (now: number) => {
    if (!recording) return;
    if (last) frames.push(now - last);
    last = now;
    const el = scroller();
    if (el) maxScrollTop = Math.max(maxScrollTop, el.scrollTop);
    if (el && isBlank(el)) blankFrames++;
    requestAnimationFrame(tick);
  };

  const start = () => {
    frames = [];
    blankFrames = 0;
    longTasks = [];
    last = 0;
    maxScrollTop = 0;
    recording = true;
    requestAnimationFrame(tick);
  };

  const stop = (): ScenarioResult => {
    recording = false;
    return {
      frames,
      blankFrames,
      longTasks,
      shadowNodes: root()?.querySelectorAll('*').length ?? 0,
      lightNodes: table.querySelectorAll('*').length,
      renderedRows: rows().length,
      maxScrollTop,
    };
  };

  const reset = async () => {
    const el = scroller();
    if (el) {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    }
    await nextFrame();
    await nextFrame();
  };

  /** The highest body row index rendered now, or -1. */
  const lastRendered = () => Math.max(-1, ...rows().map((r) => bodyIndex(table, r)));

  /** Waits for the next update and the frame that paints it. */
  const painted = async () => {
    await table.updateComplete;
    await nextFrame();
  };

  const api = {
    /** The data is generated; the table isn't mounted yet (see `mount`). */
    ready: Promise.resolve({ dataMs: Math.round(info.dataMs), rows: table.data.length }),
    start,
    stop,
    reset,

    /** Appends the table and times its first render, up to the frame that paints the rows. */
    async mount(): Promise<MountResult> {
      const t0 = performance.now();
      document.body.append(table);
      // The virtualizer only knows the viewport after the first update, so the
      // rows can arrive one update later.
      await painted();
      while (rows().length === 0 && performance.now() - t0 < 30_000) await painted();
      return { loadMs: Math.round(performance.now() - t0) };
    },

    /** Sorts by amount and times it up to the frame that paints the sorted rows; then unsorts. */
    async sort(): Promise<SortResult> {
      await reset();
      const t0 = performance.now();
      table.sorting = [{ id: 'amount', desc: false }];
      await painted();
      const sortMs = Math.round(performance.now() - t0);
      // Hand the sort back to the table, unsorted.
      table.sorting = [];
      await painted();
      table.sorting = undefined;
      await painted();
      return { sortMs };
    },

    /**
     * Tries to reach the last row by scrolling to the bottom and with `scrollToRow()`.
     * The body's height is rows × row height, so past the engine's maximum element
     * height the last rows can't be reached.
     */
    async reachEnd(): Promise<ReachEndResult> {
      await reset();
      const el = scroller();
      if (!el) throw new Error('no scroller');
      const expected = table.data.length - 1;
      el.scrollTop = el.scrollHeight;
      await wait(300);
      const byScroll = lastRendered();
      await reset();
      await table.scrollToRow(expected);
      await wait(300);
      const byMethod = lastRendered();
      await reset();
      return {
        expected,
        byScroll,
        byMethod,
        reachable: byScroll === expected && byMethod === expected,
      };
    },

    /** Constant-speed vertical scroll: `px` per frame for `ms`. */
    async steady(ms: number, px: number): Promise<ScenarioResult> {
      await reset();
      const el = scroller();
      if (!el) throw new Error('no scroller');
      start();
      const end = performance.now() + ms;
      while (performance.now() < end) {
        el.scrollTop += px;
        await nextFrame();
      }
      return stop();
    },

    /** Jump to `count` seeded random rows, holding `holdMs` after each. */
    async jumps(count: number, holdMs: number): Promise<ScenarioResult> {
      await reset();
      const el = scroller();
      if (!el) throw new Error('no scroller');
      const rand = seeded(7);
      let mismatches = 0;
      const jumpFrames: number[] = [];
      start();
      for (let i = 0; i < count; i++) {
        // A random point of the scroll range (row × height px would miss the end
        // of a scaled body).
        const before = frames.length;
        el.scrollTop = rand() * (el.scrollHeight - el.clientHeight);
        await wait(holdMs);
        // The jump's re-render lands in one of the next few frames.
        jumpFrames.push(Math.max(0, ...frames.slice(before, before + 3)));
        mismatches += checkContent(table);
      }
      return { ...stop(), mismatches, jumpFrames };
    },

    /**
     * Constant-speed horizontal scroll: `px` per frame for `ms`, turning back at
     * each end. A fixed speed, not "the full width in a fixed time", so the
     * result means the same for 20 columns as for 500.
     */
    async horizontal(ms: number, px: number): Promise<ScenarioResult> {
      await reset();
      const el = scroller();
      if (!el) throw new Error('no scroller');
      el.scrollTop = 5000 * rowHeight();
      // Let the jump's re-render finish before recording.
      await wait(300);
      start();
      const end = performance.now() + ms;
      const max = el.scrollWidth - el.clientWidth;
      const sign = document.dir === 'rtl' ? -1 : 1;
      let x = 0;
      let step = px;
      while (performance.now() < end) {
        x += step;
        if (x >= max || x <= 0) {
          x = Math.min(Math.max(x, 0), max);
          step = -step;
        }
        el.scrollLeft = x * sign;
        await nextFrame();
      }
      return stop();
    },
  };

  (window as Window & { __argusBench?: typeof api }).__argusBench = api;
}

/**
 * Checks that each rendered row's "#" cell shows that row's index, which proves slot
 * recycling put the content into the right row. Returns the number of mismatches.
 */
function checkContent(table: ArgusTable<Person>): number {
  let mismatches = 0;
  for (const row of table.shadowRoot?.querySelectorAll<HTMLElement>(BODY_ROWS) ?? []) {
    const expected = String(bodyIndex(table, row));
    const text = row
      // By column: with virtualize-columns, cells are in pool order.
      .querySelector<HTMLSlotElement>('[role="gridcell"][data-col="index"] slot')
      ?.assignedElements()
      .map((e) => e.textContent.trim())
      .join('');
    if (text !== expected) mismatches++;
  }
  return mismatches;
}
