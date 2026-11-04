// In-page measurement for run.ts. Scenarios run from the page so they are
// deterministic and identical in every engine.
import { seeded } from './data.js';
import type { SpikeGrid } from './spike-grid.js';

export interface ScenarioResult {
  frames: number[];
  blankFrames: number;
  longTasks: number[];
  shadowNodes: number;
  lightNodes: number;
  poolSize: number;
  heapMB: number | null;
  /** jumps only: the slowest frame right after each jump (ms). */
  jumpFrames?: number[];
  mismatches?: number;
}

const ROW_HEIGHT = 36;

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function installBenchHooks(grid: SpikeGrid): void {
  const scroller = () => grid.shadowRoot?.querySelector<HTMLElement>('[part~="table"]') ?? null;

  let recording = false;
  let frames: number[] = [];
  let blankFrames = 0;
  let longTasks: number[] = [];
  let last = 0;

  const supportsLongTasks = PerformanceObserver.supportedEntryTypes.includes('longtask');
  if (supportsLongTasks) {
    new PerformanceObserver((list) => {
      if (!recording) return;
      for (const entry of list.getEntries()) longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: false });
  }

  /** A frame is blank if the rendered window doesn't cover the visible body area. */
  const isBlank = (el: HTMLElement): boolean => {
    const top = el.scrollTop; // body starts after header + 2 pinned rows, which are sticky above it
    const visibleStart = Math.max(0, top - 0);
    const visibleEnd = top + el.clientHeight - ROW_HEIGHT * 4; // header, 2 top, 1 bottom pinned
    const { start, end } = grid.renderedRange;
    return (
      start > visibleStart + 1 || end < Math.min(visibleEnd, el.scrollHeight - ROW_HEIGHT * 4) - 1
    );
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
      shadowNodes: grid.shadowRoot?.querySelectorAll('*').length ?? 0,
      lightNodes: grid.querySelectorAll('*').length,
      poolSize: grid.poolSize,
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
    ready: grid.updateComplete.then(() => nextFrame()),
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
        const row = 2 + Math.floor(rand() * (grid.rows.length - 3));
        const before = frames.length;
        el.scrollTop = (row - 2) * ROW_HEIGHT;
        await wait(holdMs);
        // The jump's re-render lands in one of the next few frames.
        jumpFrames.push(Math.max(0, ...frames.slice(before, before + 3)));
        mismatches += checkContent(grid);
      }
      return { ...stop(), mismatches, jumpFrames };
    },

    /** Scroll across the full width and back over `ms`. */
    async horizontal(ms: number): Promise<ScenarioResult> {
      await reset();
      const el = scroller();
      if (!el) throw new Error('no scroller');
      el.scrollTop = 5000 * ROW_HEIGHT;
      // Let the jump's re-render (and its long task) finish before recording.
      await wait(300);
      start();
      const t0 = performance.now();
      const max = el.scrollWidth - el.clientWidth;
      while (performance.now() - t0 < ms) {
        const phase = ((performance.now() - t0) / ms) * 2;
        el.scrollLeft = (phase <= 1 ? phase : 2 - phase) * max;
        await nextFrame();
      }
      return stop();
    },
  };

  (window as Window & { __spike?: typeof api }).__spike = api;
}

/**
 * Check that the visible "#" cells show the row index of their own row. In the slotted
 * variant this proves slot recycling put content in the right row. Returns mismatches.
 */
function checkContent(grid: SpikeGrid): number {
  let mismatches = 0;
  const rows = grid.shadowRoot?.querySelectorAll<HTMLElement>('.body > .row') ?? [];
  for (const row of rows) {
    const expected = String(Number(row.getAttribute('aria-rowindex')) - 2);
    const first = row.querySelector<HTMLElement>('[role="gridcell"]');
    if (!first) continue;
    const slot = first.querySelector('slot');
    const text = slot
      ? slot
          .assignedElements()
          .map((e) => e.textContent.trim())
          .join('')
      : first.textContent.trim();
    if (text !== expected) mismatches++;
  }
  return mismatches;
}
