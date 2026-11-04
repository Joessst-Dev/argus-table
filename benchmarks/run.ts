// Rendering-spike benchmark. Serves dist/, runs each scenario in every browser and
// variant (interleaved, RUNS times), and writes medians plus a gate verdict.
//
//   BROWSERS=chromium,firefox,webkit RUNS=5 node bench/run.ts
//
// Headless numbers on shared machines are noisy: treat absolute values as a lower
// bound and the slotted/shadow ratio (same machine, interleaved) as the main signal.
import { createServer, type Server } from 'node:http';
import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { chromium, firefox, webkit, type Browser, type BrowserType, type Page } from 'playwright';

type Variant = 'shadow' | 'slotted';
type Keying = 'row' | 'pool' | 'sorted';
type BrowserName = 'chromium' | 'firefox' | 'webkit';
type Scenario = 'steady' | 'fast' | 'jumps' | 'horizontal' | 'wheel';

interface Raw {
  frames: number[];
  blankFrames: number;
  longTasks: number[];
  shadowNodes: number;
  lightNodes: number;
  poolSize: number;
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
  poolSize: number;
  heapMB: number | null;
  /** jumps only: median and max of the slowest frame after each jump. */
  jumpP50: number | null;
  jumpMax: number | null;
}

const GATE_P95 = 20;
const GATE_LONG_TASK = 50;
const GATE_RATIO = 1.2;

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const outDir = join(here, 'results');
const RUNS = Number(process.env.RUNS ?? 5);
const engines: Record<BrowserName, BrowserType> = { chromium, firefox, webkit };
const requested = process.env.BROWSERS ?? 'chromium';
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
    poolSize: raw.poolSize,
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
    poolSize: Math.max(...runs.map((r) => r.poolSize)),
    heapMB: pick('heapMB'),
    jumpP50: pick('jumpP50'),
    jumpMax: pick('jumpMax'),
  };
}

async function open(
  browser: Browser,
  url: string,
  variant: Variant,
  keying: Keying,
  dir = 'ltr',
): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${url}/?variant=${variant}&keying=${keying}&dir=${dir}&bench`);
  await page.waitForFunction(() => '__spike' in window);
  await page.evaluate(
    () => (window as unknown as { __spike: { ready: Promise<unknown> } }).__spike.ready,
  );
  return page;
}

interface Spike {
  steady(ms: number, px: number): Promise<Raw>;
  jumps(n: number, hold: number): Promise<Raw>;
  horizontal(ms: number): Promise<Raw>;
  start(): void;
  stop(): Raw;
  reset(): Promise<void>;
}

async function runScenarios(page: Page, name: BrowserName): Promise<Record<Scenario, Raw | null>> {
  const steady = await page.evaluate(() =>
    (window as unknown as { __spike: Spike }).__spike.steady(10_000, 60),
  );
  const fast = await page.evaluate(() =>
    (window as unknown as { __spike: Spike }).__spike.steady(10_000, 240),
  );
  const jumps = await page.evaluate(() =>
    (window as unknown as { __spike: Spike }).__spike.jumps(20, 500),
  );
  const horizontal = await page.evaluate(() =>
    (window as unknown as { __spike: Spike }).__spike.horizontal(5_000),
  );
  let wheel: Raw | null = null;
  if (name === 'chromium') {
    await page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.reset());
    await page.mouse.move(640, 400);
    await page.evaluate(() => {
      (window as unknown as { __spike: Spike }).__spike.start();
    });
    for (let i = 0; i < 150; i++) {
      await page.mouse.wheel(0, 240);
      await page.waitForTimeout(16);
    }
    wheel = await page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.stop());
  }
  return { steady, fast, jumps, horizontal, wheel };
}

async function screenshot(page: Page, path: string) {
  await page.evaluate(() => {
    const grid = document.querySelector('spike-grid');
    const el = grid?.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
    if (el) {
      el.scrollTop = 1000 * 36;
      el.scrollLeft =
        (Math.abs(el.scrollWidth - el.clientWidth) / 2) * (document.dir === 'rtl' ? -1 : 1);
    }
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path });
}

const scenarios: Scenario[] = ['steady', 'fast', 'jumps', 'horizontal', 'wheel'];
const variants: Variant[] = ['shadow', 'slotted'];
const keyings: Keying[] = (process.env.KEYING ?? 'row,pool')
  .split(',')
  .filter((k): k is Keying => k === 'row' || k === 'pool' || k === 'sorted');

async function main() {
  const { server, url } = await serve();
  await mkdir(join(outDir, 'screens'), { recursive: true });
  const results: Record<string, unknown>[] = [];
  const versions: Record<string, string> = {};

  for (const name of browsers) {
    const browser = await engines[name].launch();
    versions[name] = browser.version();
    const empty = (): Record<Scenario, Stats[]> => ({
      steady: [],
      fast: [],
      jumps: [],
      horizontal: [],
      wheel: [],
    });
    const collected = new Map<string, Record<Scenario, Stats[]>>();
    for (const k of keyings) for (const v of variants) collected.set(`${k}/${v}`, empty());
    for (let run = 0; run < RUNS; run++) {
      for (const keying of keyings) {
        // Alternate the order so neither variant always runs on a "warm" machine.
        const order = run % 2 ? [...variants].reverse() : variants;
        for (const variant of order) {
          const page = await open(browser, url, variant, keying);
          const longTasksSupported = await page.evaluate(() =>
            PerformanceObserver.supportedEntryTypes.includes('longtask'),
          );
          const raw = await runScenarios(page, name);
          const bucket = collected.get(`${keying}/${variant}`);
          for (const s of scenarios) {
            const r = raw[s];
            if (r && bucket) bucket[s].push(stats(r, longTasksSupported));
          }
          if (run === 0)
            await screenshot(page, join(outDir, 'screens', `${name}-${keying}-${variant}.png`));
          await page.close();
          process.stdout.write(
            `${name} run ${String(run + 1)}/${String(RUNS)} ${keying}/${variant} done\n`,
          );
        }
      }
    }
    const rtl = await open(browser, url, 'slotted', keyings[0] ?? 'row', 'rtl');
    await screenshot(rtl, join(outDir, 'screens', `${name}-slotted-rtl.png`));
    await rtl.close();
    await browser.close();

    for (const keying of keyings) {
      for (const s of scenarios) {
        const shadowRuns = collected.get(`${keying}/shadow`)?.[s] ?? [];
        const slottedRuns = collected.get(`${keying}/slotted`)?.[s] ?? [];
        if (!shadowRuns.length || !slottedRuns.length) continue;
        const shadow = medianStats(shadowRuns);
        const slotted = medianStats(slottedRuns);
        // For jumps the p95 is dominated by idle frames; compare the per-jump cost instead.
        const a = s === 'jumps' ? (slotted.jumpP50 ?? 0) : slotted.p95;
        const b = s === 'jumps' ? (shadow.jumpP50 ?? 0) : shadow.p95;
        const ratio = b ? Math.round((a / b) * 100) / 100 : null;
        results.push({ browser: name, keying, scenario: s, shadow, slotted, ratio });
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
    gate: { p95: GATE_P95, longTask: GATE_LONG_TASK, ratio: GATE_RATIO },
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

function toMarkdown(meta: Record<string, unknown>, results: Record<string, unknown>[]): string {
  const lines = [
    `## Rendering spike benchmark`,
    '',
    `${String(meta.date)} · ${String(meta.runner)} · ${String(meta.os)} · ${String(meta.cpu)} · median of ${String(meta.runs)} runs`,
    '',
    `Browsers: ${Object.entries(meta.versions as Record<string, string>)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}`,
    '',
    `Gate: p95 ≤ ${String(GATE_P95)} ms and no long task > ${String(GATE_LONG_TASK)} ms (absolute); slotted ≤ ${String(GATE_RATIO)} × shadow (relative: p95, or the median jump frame for jumps).`,
    'Long tasks come from PerformanceObserver in Chromium; elsewhere "frames > 50 ms" stands in. `wheel` drives real input through Playwright and its frame pacing is limited by the harness, so it is a sanity check, not a gate.',
    'Keying: row = row DOM keyed by row id (recreated when a row enters the window); pool = row DOM recycled per pool slot, light DOM in pool order; sorted = recycled per pool slot but row DOM kept in row-index order (light DOM in pool order).',
    'Scenarios: steady = 60 px/frame for 10 s; fast = 240 px/frame for 10 s; jumps = 20 random jumps held 500 ms; horizontal = full width and back over 5 s.',
    '',
    '| Browser | Keying | Scenario | Variant | p50 | p95 | p99 | max | jump frame p50 / max | frames > 50 ms | long tasks (max) | blank frames | wrong content | light-DOM nodes | heap MB | Absolute | slotted / shadow |',
    '| --- | --- | --- | --- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --- | --: |',
  ];
  for (const r of results) {
    for (const v of variants) {
      const s = r[v] as Stats;
      const lt = s.longTasks === null ? 'n/a' : `${String(s.longTasks)} (${String(s.longTaskMax)})`;
      const ratio =
        v === 'slotted'
          ? `${String(r.ratio)} ${(r.ratio as number) <= GATE_RATIO ? 'pass' : 'FAIL'}`
          : '';
      lines.push(
        `| ${String(r.browser)} | ${String(r.keying)} | ${String(r.scenario)} | ${v} | ${String(s.p50)} | ${String(s.p95)} | ${String(s.p99)} | ${String(s.max)} | ${s.jumpP50 === null ? '' : `${String(s.jumpP50)} / ${String(s.jumpMax)}`} | ${String(s.over50)} | ${lt} | ${String(s.blankFrames)} | ${String(s.mismatches)} | ${String(s.lightNodes)} | ${String(s.heapMB ?? 'n/a')} | ${verdict(s)} | ${ratio} |`,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

await main();
