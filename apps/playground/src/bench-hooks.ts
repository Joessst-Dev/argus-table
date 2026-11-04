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
  heapMB: number | null;
  /** jumps only: the slowest frame right after each jump (ms). */
  jumpFrames?: number[];
  mismatches?: number;
}

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function installBenchHooks(table: ArgusTable<Person>): void {
  const root = () => table.shadowRoot;
  const scroller = () => root()?.querySelector<HTMLElement>('[part~="table"]') ?? null;
  const rows = () => [...(root()?.querySelectorAll<HTMLElement>('[part~="row"]') ?? [])];
  const rowHeight = () => rows()[0]?.getBoundingClientRect().height ?? 40;
  const headerHeight = () =>
    root()?.querySelector('[part~="header"]')?.getBoundingClientRect().height ?? 0;

  let recording = false;
  let frames: number[] = [];
  let blankFrames = 0;
  let longTasks: number[] = [];
  let last = 0;

  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    new PerformanceObserver((list) => {
      if (!recording) return;
      for (const entry of list.getEntries()) longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: false });
  }

  /** A frame is blank if the rendered rows don't cover the visible body area. */
  const isBlank = (el: HTMLElement): boolean => {
    const indices = rows().map((r) => Number(r.getAttribute('aria-rowindex')) - 2);
    if (indices.length === 0) return true;
    const h = rowHeight();
    const start = Math.min(...indices) * h;
    const end = (Math.max(...indices) + 1) * h;
    const visibleStart = el.scrollTop;
    const visibleEnd = Math.min(
      el.scrollTop + el.clientHeight - headerHeight(),
      table.data.length * h,
    );
    return start > visibleStart + 1 || end < visibleEnd - 1;
  };

  const tick = (now: number) => {
    if (!recording) return;
    if (last) frames.push(now - last);
    last = now;
    const el = scroller();
    if (el && isBlank(el)) blankFrames++;
    requestAnimationFrame(tick);
  };

  const start = () => {
    frames = [];
    blankFrames = 0;
    longTasks = [];
    last = 0;
    recording = true;
    requestAnimationFrame(tick);
  };

  const stop = (): ScenarioResult => {
    recording = false;
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return {
      frames,
      blankFrames,
      longTasks,
      shadowNodes: root()?.querySelectorAll('*').length ?? 0,
      lightNodes: table.querySelectorAll('*').length,
      renderedRows: rows().length,
      heapMB: memory ? Math.round(memory.usedJSHeapSize / 1e5) / 10 : null,
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

  const api = {
    ready: table.updateComplete.then(() => nextFrame()),
    start,
    stop,
    reset,

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
        const row = Math.floor(rand() * (table.data.length - 1));
        const before = frames.length;
        el.scrollTop = row * rowHeight();
        await wait(holdMs);
        // The jump's re-render lands in one of the next few frames.
        jumpFrames.push(Math.max(0, ...frames.slice(before, before + 3)));
        mismatches += checkContent(table);
      }
      return { ...stop(), mismatches, jumpFrames };
    },

    /** Scroll across the full width and back over `ms`. */
    async horizontal(ms: number): Promise<ScenarioResult> {
      await reset();
      const el = scroller();
      if (!el) throw new Error('no scroller');
      el.scrollTop = 5000 * rowHeight();
      // Let the jump's re-render finish before recording.
      await wait(300);
      start();
      const t0 = performance.now();
      const max = el.scrollWidth - el.clientWidth;
      const sign = document.dir === 'rtl' ? -1 : 1;
      while (performance.now() - t0 < ms) {
        const phase = ((performance.now() - t0) / ms) * 2;
        el.scrollLeft = (phase <= 1 ? phase : 2 - phase) * max * sign;
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
  for (const row of table.shadowRoot?.querySelectorAll<HTMLElement>('[part~="row"]') ?? []) {
    const expected = String(Number(row.getAttribute('aria-rowindex')) - 2);
    const text = row
      .querySelector<HTMLSlotElement>('[role="gridcell"] slot')
      ?.assignedElements()
      .map((e) => e.textContent.trim())
      .join('');
    if (text !== expected) mismatches++;
  }
  return mismatches;
}
