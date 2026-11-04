// Scroll benchmark. Serves the built playground (apps/playground/dist), runs each
// scenario RUNS times in every browser, and writes medians plus a gate verdict.
//
//   pnpm bench                                   # Chromium, 5 runs
//   BROWSERS=chromium,firefox,webkit RUNS=3 pnpm bench
//   VARIANTS=pin=cells,pin=groups pnpm bench      # compare playground variants, interleaved
//
// Headless numbers on shared machines are noisy: treat absolute values as a lower
// bound and compare runs from the same machine.
import { createServer, type Server } from 'node:http';
import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { chromium, firefox, webkit, type Browser, type BrowserType, type Page } from 'playwright';

type BrowserName = 'chromium' | 'firefox' | 'webkit';
type Scenario = 'steady' | 'fast' | 'jumps' | 'horizontal' | 'wheel';

interface Raw {
  frames: number[];
  blankFrames: number;
  longTasks: number[];
  shadowNodes: number;
  lightNodes: number;
  renderedRows: number;
  heapMB: number | null;
  mismatches?: number;
  jumpFrames?: number[];
}

interface Stats {
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
  heapMB: number | null;
  /** jumps only: median and max of the slowest frame after each jump. */
  jumpP50: number | null;
  jumpMax: number | null;
}

const GATE_P95 = 20;
const GATE_LONG_TASK = 50;

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'apps', 'playground', 'dist');
const outDir = join(here, 'results');
const RUNS = Number(process.env.RUNS ?? 5);
const engines: Record<BrowserName, BrowserType> = { chromium, firefox, webkit };
const requested = process.env.BROWSERS ?? 'chromium';
// Playground query strings to compare in the same job, e.g. `pin=cells,pin=groups`.
// Runs interleave the variants, so they share the runner's state; CI runners vary
// too much between jobs to compare separate runs.
const VARIANTS = (process.env.VARIANTS ?? '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);
const variants = VARIANTS.length ? VARIANTS : [''];
const browsers = (requested === 'all' ? 'chromium,firefox,webkit' : requested)
  .split(',')
  .map((b) => b.trim())
  .filter((b): b is BrowserName => b in engines);

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
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

function stats(raw: Raw, longTasksSupported: boolean): Stats {
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
    heapMB: raw.heapMB,
    jumpP50: raw.jumpFrames?.length ? median(raw.jumpFrames) : null,
    jumpMax: raw.jumpFrames?.length ? Math.max(...raw.jumpFrames) : null,
  };
}

function medianStats(runs: Stats[]): Stats {
  const pick = (k: keyof Stats): number | null => {
    const values = runs.map((r) => r[k]).filter((v): v is number => typeof v === 'number');
    return values.length ? round(median(values)) : null;
  };
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
    heapMB: pick('heapMB'),
    jumpP50: pick('jumpP50'),
    jumpMax: pick('jumpMax'),
  };
}

async function open(browser: Browser, url: string, dir = 'ltr', variant = ''): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${url}/?dir=${dir}&bench${variant ? `&${variant}` : ''}`);
  await page.waitForFunction(() => '__argusBench' in window);
  await page.evaluate(
    () => (window as unknown as { __argusBench: { ready: Promise<unknown> } }).__argusBench.ready,
  );
  return page;
}

interface Bench {
  steady(ms: number, px: number): Promise<Raw>;
  jumps(n: number, hold: number): Promise<Raw>;
  horizontal(ms: number): Promise<Raw>;
  start(): void;
  stop(): Raw;
  reset(): Promise<void>;
}
type BenchWindow = Window & { __argusBench: Bench };

async function runScenarios(page: Page, name: BrowserName): Promise<Record<Scenario, Raw | null>> {
  const steady = await page.evaluate(() =>
    (window as unknown as BenchWindow).__argusBench.steady(10_000, 60),
  );
  const fast = await page.evaluate(() =>
    (window as unknown as BenchWindow).__argusBench.steady(10_000, 240),
  );
  const jumps = await page.evaluate(() =>
    (window as unknown as BenchWindow).__argusBench.jumps(20, 500),
  );
  const horizontal = await page.evaluate(() =>
    (window as unknown as BenchWindow).__argusBench.horizontal(5_000),
  );
  let wheel: Raw | null = null;
  if (name === 'chromium') {
    await page.evaluate(() => (window as unknown as BenchWindow).__argusBench.reset());
    await page.mouse.move(640, 400);
    await page.evaluate(() => {
      (window as unknown as BenchWindow).__argusBench.start();
    });
    for (let i = 0; i < 150; i++) {
      await page.mouse.wheel(0, 240);
      await page.waitForTimeout(16);
    }
    wheel = await page.evaluate(() => (window as unknown as BenchWindow).__argusBench.stop());
  }
  return { steady, fast, jumps, horizontal, wheel };
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
  const results: { browser: BrowserName; variant: string; scenario: Scenario; stats: Stats }[] = [];
  const versions: Record<string, string> = {};

  for (const name of browsers) {
    const browser = await engines[name].launch();
    versions[name] = browser.version();
    const collected = new Map<string, Stats[]>();
    const key = (variant: string, s: Scenario) => `${variant}|${s}`;
    for (let run = 0; run < RUNS; run++) {
      // Rotate the order each run so no variant always goes first.
      for (let i = 0; i < variants.length; i++) {
        const variant = variants[(run + i) % variants.length] ?? '';
        const page = await open(browser, url, 'ltr', variant);
        const longTasksSupported = await page.evaluate(() =>
          PerformanceObserver.supportedEntryTypes.includes('longtask'),
        );
        const raw = await runScenarios(page, name);
        for (const s of scenarios) {
          const r = raw[s];
          if (!r) continue;
          const list = collected.get(key(variant, s)) ?? [];
          list.push(stats(r, longTasksSupported));
          collected.set(key(variant, s), list);
        }
        if (run === 0) {
          const suffix = variant ? `-${variant.replace(/[^\w-]+/g, '_')}` : '';
          await screenshot(page, join(outDir, 'screens', `${name}${suffix}.png`));
        }
        await page.close();
      }
      process.stdout.write(`${name} run ${String(run + 1)}/${String(RUNS)} done\n`);
    }
    const rtl = await open(browser, url, 'rtl');
    await screenshot(rtl, join(outDir, 'screens', `${name}-rtl.png`));
    await rtl.close();
    await browser.close();

    for (const variant of variants) {
      for (const s of scenarios) {
        const list = collected.get(key(variant, s));
        if (list?.length)
          results.push({ browser: name, variant, scenario: s, stats: medianStats(list) });
      }
    }
  }
  server.close();

  const meta = {
    date: new Date().toISOString(),
    runner: process.env.RUNNER_NAME ?? os.hostname(),
    os: `${os.type()} ${os.release()}`,
    cpu: `${os.cpus()[0]?.model ?? 'unknown'} × ${String(os.cpus().length)}`,
    versions,
    runs: RUNS,
    variants: VARIANTS,
    gate: { p95: GATE_P95, longTask: GATE_LONG_TASK },
  };
  const stamp = meta.date.slice(0, 16).replace(/[:T]/g, '-');
  const base = join(outDir, `${stamp}-${browsers.join('+')}`);
  await writeFile(`${base}.json`, JSON.stringify({ meta, results }, null, 2));
  const md = toMarkdown(meta, results);
  await writeFile(`${base}.md`, md);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md);
  process.stdout.write(`\n${md}\n`);
}

function verdict(s: Stats): string {
  const longTaskOk = s.longTaskMax === null ? s.over50 === 0 : s.longTaskMax <= GATE_LONG_TASK;
  return s.p95 <= GATE_P95 && longTaskOk ? 'pass' : 'FAIL';
}

function toMarkdown(
  meta: {
    date: string;
    runner: string;
    os: string;
    cpu: string;
    versions: Record<string, string>;
    runs: number;
    variants: string[];
  },
  results: { browser: BrowserName; variant: string; scenario: Scenario; stats: Stats }[],
): string {
  const withVariant = meta.variants.length > 0;
  const lines = [
    `## argus-table scroll benchmark`,
    '',
    `${meta.date} · ${meta.runner} · ${meta.os} · ${meta.cpu} · median of ${String(meta.runs)} runs`,
    '',
    `Browsers: ${Object.entries(meta.versions)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}`,
    '',
    `Gate: p95 ≤ ${String(GATE_P95)} ms and no long task > ${String(GATE_LONG_TASK)} ms. Advisory: this run never fails a PR.`,
    'Long tasks come from PerformanceObserver in Chromium; elsewhere "frames > 50 ms" stands in. `wheel` drives real input through Playwright and its frame pacing is limited by the harness, so it is a sanity check, not a gate.',
    'Page: apps/playground, 100,000 rows × 20 columns, slotted cell content, pooled rows. Scenarios: steady = 60 px/frame for 10 s; fast = 240 px/frame for 10 s; jumps = 20 random jumps held 500 ms; horizontal = full width and back over 5 s.',
    '',
    `| Browser |${withVariant ? ' Variant |' : ''} Scenario | p50 | p95 | p99 | max | jump frame p50 / max | frames > 50 ms | long tasks (max) | blank frames | wrong content | rendered rows | light-DOM nodes | heap MB | Gate |`,
    `| --- |${withVariant ? ' --- |' : ''} --- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --- |`,
  ];
  for (const { browser, variant, scenario, stats: s } of results) {
    const lt = s.longTasks === null ? 'n/a' : `${String(s.longTasks)} (${String(s.longTaskMax)})`;
    const jump = s.jumpP50 === null ? '' : `${String(s.jumpP50)} / ${String(s.jumpMax)}`;
    lines.push(
      `| ${browser} |${withVariant ? ` ${variant} |` : ''} ${scenario} | ${String(s.p50)} | ${String(s.p95)} | ${String(s.p99)} | ${String(s.max)} | ${jump} | ${String(s.over50)} | ${lt} | ${String(s.blankFrames)} | ${String(s.mismatches)} | ${String(s.renderedRows)} | ${String(s.lightNodes)} | ${String(s.heapMB ?? 'n/a')} | ${verdict(s)} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

await main();
