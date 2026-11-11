// Benchmark. Serves the built playground (apps/playground/dist) and, for every row
// count, runs the scroll scenarios plus load, sort, memory and a reach-the-end
// check RUNS times in every browser. Writes medians plus a gate verdict.
//
//   pnpm bench                                   # Chromium, 5 runs, 10k / 100k / 1M rows
//   BROWSERS=chromium,firefox,webkit RUNS=3 pnpm bench
//   ROWS=100000 pnpm bench                       # one row count
//   VARIANTS=pin=none,pin= pnpm bench            # compare playground variants, interleaved
//
// Headless numbers on shared machines are noisy: treat absolute values as a lower
// bound and compare runs from the same machine.
import { createServer, type Server } from 'node:http';
import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { chromium, firefox, webkit, type Browser, type BrowserType, type Page } from 'playwright';
import type {
  BrowserName,
  Meta,
  PageResult,
  PageStats,
  Results,
  Scenario,
  ScrollResult,
  ScrollStats,
} from './types.ts';
import { toMarkdown } from './markdown.ts';

interface Raw {
  frames: number[];
  blankFrames: number;
  longTasks: number[];
  shadowNodes: number;
  lightNodes: number;
  renderedRows: number;
  maxScrollTop: number;
  mismatches?: number;
  jumpFrames?: number[];
}

const GATE_P95 = 20;
const GATE_LONG_TASK = 50;
/** A sort can't be interrupted inside the page, so after this the page is closed instead. */
const SORT_TIMEOUT = Number(process.env.SORT_TIMEOUT ?? 60_000);
/** Scenarios that scroll the body vertically: they must move it to count. */
const VERTICAL = new Set<Scenario>(['steady', 'fast', 'jumps', 'wheel']);
/** The playground's default: 20 columns, three of them pinned. */
const COLUMNS = 20;

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'apps', 'playground', 'dist');
const outDir = join(here, 'results');
const RUNS = Number(process.env.RUNS ?? 5);
const engines: Record<BrowserName, BrowserType> = { chromium, firefox, webkit };
const requested = process.env.BROWSERS ?? 'chromium';
const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
const ROWS = list(process.env.ROWS ?? '10000,100000,1000000').map(Number);
// Playground query strings to compare in the same job, e.g. `pin=none,density=compact`.
// Runs interleave the variants, so they share the runner's state; CI runners vary
// too much between jobs to compare separate runs.
const VARIANTS = list(process.env.VARIANTS);
const variants = VARIANTS.length ? VARIANTS : [''];
const browsers = list(requested === 'all' ? 'chromium,firefox,webkit' : requested).filter(
  (b): b is BrowserName => b in engines,
);

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
};

function serve(): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    const file = join(dist, path === '/' ? 'index.html' : path);
    readFile(file).then(
      (body) => {
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
        res.end(body);
      },
      () => {
        res.writeHead(404);
        res.end();
      },
    );
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, url: `http://127.0.0.1:${String(port)}` });
    });
  });
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};
const pct = (sorted: number[], p: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
const round = (n: number): number => Math.round(n * 10) / 10;
/** The median of the numbers among `values`, or null if there are none. */
const medianOf = (values: (number | null)[]): number | null => {
  const numbers = values.filter((v): v is number => typeof v === 'number');
  return numbers.length ? round(median(numbers)) : null;
};

function stats(raw: Raw, scenario: Scenario, longTasksSupported: boolean): ScrollStats {
  const f = [...raw.frames].sort((a, b) => a - b);
  return {
    frames: f.length,
    p50: pct(f, 0.5),
    p95: pct(f, 0.95),
    p99: pct(f, 0.99),
    max: f.at(-1) ?? 0,
    over50: f.filter((x) => x > GATE_LONG_TASK).length,
    longTasks: longTasksSupported ? raw.longTasks.length : null,
    longTaskMax: longTasksSupported ? Math.max(0, ...raw.longTasks) : null,
    blankFrames: raw.blankFrames,
    mismatches: raw.mismatches ?? 0,
    shadowNodes: raw.shadowNodes,
    lightNodes: raw.lightNodes,
    renderedRows: raw.renderedRows,
    scrolled: !VERTICAL.has(scenario) || raw.maxScrollTop > 0,
    jumpP50: raw.jumpFrames?.length ? median(raw.jumpFrames) : null,
    jumpMax: raw.jumpFrames?.length ? Math.max(...raw.jumpFrames) : null,
  };
}

/** The median of a numeric field over the runs, leaving out runs without it. */
function medianAt<T>(runs: readonly T[], k: keyof T): number | null {
  return medianOf(
    runs.map((r) => {
      const v = r[k];
      return typeof v === 'number' ? v : null;
    }),
  );
}

function medianStats(runs: ScrollStats[]): ScrollStats {
  const pick = (k: keyof ScrollStats) => medianAt(runs, k);
  return {
    frames: pick('frames') ?? 0,
    p50: pick('p50') ?? 0,
    p95: pick('p95') ?? 0,
    p99: pick('p99') ?? 0,
    max: pick('max') ?? 0,
    over50: pick('over50') ?? 0,
    longTasks: pick('longTasks'),
    longTaskMax: pick('longTaskMax'),
    // Correctness counters: report the worst run, not the median.
    blankFrames: Math.max(...runs.map((r) => r.blankFrames)),
    mismatches: Math.max(...runs.map((r) => r.mismatches)),
    shadowNodes: pick('shadowNodes') ?? 0,
    lightNodes: Math.max(...runs.map((r) => r.lightNodes)),
    renderedRows: Math.max(...runs.map((r) => r.renderedRows)),
    scrolled: runs.every((r) => r.scrolled),
    jumpP50: pick('jumpP50'),
    jumpMax: pick('jumpMax'),
  };
}

function medianPageStats(runs: PageStats[]): PageStats {
  const pick = (k: keyof PageStats) => medianAt(runs, k);
  return {
    dataMs: pick('dataMs') ?? 0,
    loadMs: pick('loadMs') ?? 0,
    // A timed-out run counts as slower than any finished one.
    sortMs: runs.some((r) => r.sortMs === null) ? null : pick('sortMs'),
    tableHeapMB: pick('tableHeapMB'),
    growthMB: pick('growthMB'),
    domNodes: pick('domNodes'),
    // Correctness: the worst run.
    lastByScroll: Math.min(...runs.map((r) => r.lastByScroll)),
    lastByMethod: Math.min(...runs.map((r) => r.lastByMethod)),
    reachable: runs.every((r) => r.reachable),
  };
}

interface Bench {
  ready: Promise<{ dataMs: number; rows: number }>;
  mount(): Promise<{ loadMs: number }>;
  sort(): Promise<{ sortMs: number }>;
  reachEnd(): Promise<{
    expected: number;
    byScroll: number;
    byMethod: number;
    reachable: boolean;
  }>;
  steady(ms: number, px: number): Promise<Raw>;
  jumps(n: number, hold: number): Promise<Raw>;
  horizontal(ms: number, px: number): Promise<Raw>;
  start(): void;
  stop(): Raw;
  reset(): Promise<void>;
}
declare global {
  interface Window {
    /** The playground's hooks with `?bench` (apps/playground/src/bench-hooks.ts). */
    __argusBench: Bench;
  }
}

/** Opens the playground with the data generated and the table not mounted yet. */
async function open(
  browser: Browser,
  url: string,
  { dir = 'ltr', rows, variant = '' }: { dir?: string; rows: number; variant?: string },
): Promise<{ page: Page; dataMs: number }> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${url}/?dir=${dir}&bench&rows=${String(rows)}${variant ? `&${variant}` : ''}`);
  await page.waitForFunction(() => '__argusBench' in window, null, { timeout: 120_000 });
  const { dataMs } = await page.evaluate(() => window.__argusBench.ready);
  return { page, dataMs };
}

const mount = (page: Page) => page.evaluate(() => window.__argusBench.mount());

interface Memory {
  heapMB: number;
  nodes: number;
}

/**
 * Chromium only: the JS heap and DOM node count after a full garbage collection,
 * through the DevTools protocol. Firefox and WebKit expose nothing comparable.
 */
async function memoryProbe(page: Page, name: BrowserName): Promise<() => Promise<Memory | null>> {
  if (name !== 'chromium') return () => Promise.resolve(null);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  return async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const { metrics } = await cdp.send('Performance.getMetrics');
    const metric = (n: string) => metrics.find((m) => m.name === n)?.value ?? 0;
    return { heapMB: metric('JSHeapUsedSize') / 1e6, nodes: metric('Nodes') };
  };
}

async function runScenarios(page: Page, name: BrowserName): Promise<Record<Scenario, Raw | null>> {
  const steady = await page.evaluate(() => window.__argusBench.steady(10_000, 60));
  const fast = await page.evaluate(() => window.__argusBench.steady(10_000, 240));
  const jumps = await page.evaluate(() => window.__argusBench.jumps(20, 500));
  const horizontal = await page.evaluate(() => window.__argusBench.horizontal(5_000, 60));
  let wheel: Raw | null = null;
  if (name === 'chromium') {
    await page.evaluate(() => window.__argusBench.reset());
    await page.mouse.move(640, 400);
    await page.evaluate(() => {
      window.__argusBench.start();
    });
    for (let i = 0; i < 150; i++) {
      await page.mouse.wheel(0, 240);
      await page.waitForTimeout(16);
    }
    wheel = await page.evaluate(() => window.__argusBench.stop());
  }
  return { steady, fast, jumps, horizontal, wheel };
}

/** One page: mount, scroll scenarios, reach the end, then sort, with memory samples between. */
async function measure(
  page: Page,
  name: BrowserName,
  dataMs: number,
): Promise<{ scroll: Record<Scenario, Raw | null>; page: PageStats; longTasks: boolean }> {
  const sample = await memoryProbe(page, name);
  const baseline = await sample();
  const { loadMs } = await mount(page);
  const mounted = await sample();
  const longTasks = await page.evaluate(() =>
    PerformanceObserver.supportedEntryTypes.includes('longtask'),
  );
  const scroll = await runScenarios(page, name);
  const end = await page.evaluate(() => window.__argusBench.reachEnd());
  // Before sorting: a sorted row model is a legitimate new allocation, not growth.
  const scrolled = await sample();
  const sortMs = await withTimeout(
    page.evaluate(() => window.__argusBench.sort()).then((r) => r.sortMs),
    SORT_TIMEOUT,
  );
  return {
    scroll,
    longTasks,
    page: {
      dataMs,
      loadMs,
      sortMs,
      tableHeapMB: baseline && mounted ? round(mounted.heapMB - baseline.heapMB) : null,
      growthMB: mounted && scrolled ? round(scrolled.heapMB - mounted.heapMB) : null,
      domNodes: mounted?.nodes ?? null,
      lastByScroll: end.byScroll,
      lastByMethod: end.byMethod,
      reachable: end.reachable,
    },
  };
}

/** Resolves with the promise's value, or null after `ms` (the promise keeps running). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      resolve(null);
    }, ms);
  });
  // A late rejection (the page closed under it) is expected: don't let it go unhandled.
  promise.catch(() => undefined);
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * The argus-table version measured: the package version on its release tag, and
 * `<version>+<commit>` anywhere else, so unreleased code never passes for a release.
 */
async function measuredVersion(): Promise<string> {
  const { version } = JSON.parse(
    await readFile(join(here, '..', 'packages', 'table', 'package.json'), 'utf8'),
  ) as { version: string };
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: here,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  try {
    if (git('tag', '--points-at', 'HEAD').split('\n').includes(`argus-table@${version}`))
      return version;
    return `${version}+${git('rev-parse', '--short', 'HEAD')}`;
  } catch {
    return `${version}+unknown`;
  }
}

async function screenshot(page: Page, path: string) {
  await page.evaluate(() => {
    const table = document.querySelector('argus-table');
    const el = table?.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
    if (el) {
      el.scrollTop = 1000 * 40;
      el.scrollLeft =
        (Math.abs(el.scrollWidth - el.clientWidth) / 2) * (document.dir === 'rtl' ? -1 : 1);
    }
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path });
}

const scenarios: Scenario[] = ['steady', 'fast', 'jumps', 'horizontal', 'wheel'];

async function main() {
  const { server, url } = await serve();
  await mkdir(join(outDir, 'screens'), { recursive: true });
  const results: ScrollResult[] = [];
  const pages: PageResult[] = [];
  const versions: Meta['versions'] = {};
  const combos = ROWS.flatMap((rows) => variants.map((variant) => ({ rows, variant })));

  for (const name of browsers) {
    const browser = await engines[name].launch();
    versions[name] = browser.version();
    const collected = new Map<string, ScrollStats[]>();
    const collectedPages = new Map<string, PageStats[]>();
    const key = (rows: number, variant: string, s = '') => `${String(rows)}|${variant}|${s}`;
    for (let run = 0; run < RUNS; run++) {
      // Rotate the order each run so no row count or variant always goes first.
      for (let i = 0; i < combos.length; i++) {
        const combo = combos[(run + i) % combos.length];
        if (!combo) continue;
        const { rows, variant } = combo;
        const { page, dataMs } = await open(browser, url, { rows, variant });
        const measured = await measure(page, name, dataMs);
        for (const s of scenarios) {
          const r = measured.scroll[s];
          if (!r) continue;
          const runs = collected.get(key(rows, variant, s)) ?? [];
          runs.push(stats(r, s, measured.longTasks));
          collected.set(key(rows, variant, s), runs);
        }
        const pageRuns = collectedPages.get(key(rows, variant)) ?? [];
        pageRuns.push(measured.page);
        collectedPages.set(key(rows, variant), pageRuns);
        // A page still busy with a sort that timed out takes no screenshot.
        if (run === 0 && measured.page.sortMs !== null) {
          const suffix = `-${String(rows)}${variant ? `-${variant.replace(/[^\w-]+/g, '_')}` : ''}`;
          await screenshot(page, join(outDir, 'screens', `${name}${suffix}.png`));
        }
        // A page stuck in a sort may not answer: close its context, and don't wait forever.
        await withTimeout(page.context().close(), 10_000);
        process.stdout.write(
          `${name} run ${String(run + 1)}/${String(RUNS)}: ${String(rows)} rows${variant ? ` (${variant})` : ''} done\n`,
        );
      }
    }
    const rtl = await open(browser, url, { dir: 'rtl', rows: 100_000 });
    await mount(rtl.page);
    await screenshot(rtl.page, join(outDir, 'screens', `${name}-rtl.png`));
    await rtl.page.close();
    await browser.close();

    for (const { rows, variant } of combos) {
      for (const s of scenarios) {
        const runs = collected.get(key(rows, variant, s));
        if (runs?.length)
          results.push({ browser: name, rows, variant, scenario: s, stats: medianStats(runs) });
      }
      const pageRuns = collectedPages.get(key(rows, variant));
      if (pageRuns?.length)
        pages.push({ browser: name, rows, variant, stats: medianPageStats(pageRuns) });
    }
  }
  server.close();

  const meta: Meta = {
    date: new Date().toISOString(),
    version: await measuredVersion(),
    runner: process.env.RUNNER_NAME ?? os.hostname(),
    os: `${os.type()} ${os.release()}`,
    cpu: `${os.cpus()[0]?.model ?? 'unknown'} × ${String(os.cpus().length)}`,
    versions,
    runs: RUNS,
    rows: ROWS,
    variants: VARIANTS,
    columns: COLUMNS,
    gate: { p95: GATE_P95, longTask: GATE_LONG_TASK },
    sortTimeoutMs: SORT_TIMEOUT,
  };
  const output: Results = { meta, results, pages };
  const stamp = meta.date.slice(0, 16).replace(/[:T]/g, '-');
  const base = join(outDir, `${stamp}-${browsers.join('+')}`);
  await writeFile(`${base}.json`, JSON.stringify(output, null, 2));
  const md = toMarkdown(output);
  await writeFile(`${base}.md`, md);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md);
  process.stdout.write(`\n${md}\n`);
}

await main();
