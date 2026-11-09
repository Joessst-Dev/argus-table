// Records the README demo (brand/demo.gif) from the built playground: a million
// rows scrolled, a sideways scroll past the pinned columns, a sort, a column
// dragged to a new place and a column resized.
//
//   pnpm nx run playground:record-demo            # builds, then writes brand/demo.gif
//   FRAMES=/tmp/frames pnpm nx run playground:record-demo   # also keeps every frame as a PNG
//
// Headless Chromium has no cursor, so the page draws one. Every step is driven
// frame by frame (no real-time capture), so runs are repeatable.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';
// Both are CommonJS: default imports.
import gifenc from 'gifenc';
import pngjs from 'pngjs';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const { PNG } = pngjs;

const out = fileURLToPath(new URL('../../../brand/demo.gif', import.meta.url));
const width = 960;
const height = 540;
const FRAME = 80; // ms per frame: 12.5 fps

const server = await preview({
  root: fileURLToPath(new URL('..', import.meta.url)),
  preview: { port: 4174, strictPort: true },
  logLevel: 'warn',
});
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
await page.goto(
  'http://localhost:4174/?rows=1000000&cols=12&theme=material&pinned=top&scheme=light',
);
await page.locator('argus-table [part~="row"]').first().waitFor();
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => {
  const cursor = document.createElement('div');
  cursor.id = 'demo-cursor';
  cursor.innerHTML =
    '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2 L3 18 L7.5 14 L10.5 20.5 L13 19.4 L10 13 L16 13 Z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  cursor.style.cssText =
    'position:fixed;left:0;top:0;z-index:99999;pointer-events:none;transform:translate(-3px,-2px)';
  document.body.append(cursor);
});

const frames = [];
let cursor = { x: width * 0.55, y: height * 0.6 };

const settle = () =>
  page.evaluate(async () => {
    const table = document.querySelector('argus-table');
    await table.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await table.updateComplete;
  });
async function snap(delay = FRAME) {
  await settle();
  frames.push({ png: await page.screenshot({ type: 'png' }), delay });
}
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const steps = (ms) => Math.max(1, Math.round(ms / FRAME));

async function moveTo(x, y, ms) {
  const from = { ...cursor };
  const n = steps(ms);
  for (let i = 1; i <= n; i++) {
    const t = ease(i / n);
    cursor = { x: from.x + (x - from.x) * t, y: from.y + (y - from.y) * t };
    await page.mouse.move(cursor.x, cursor.y);
    await page.evaluate(
      ([cx, cy]) => {
        const el = document.getElementById('demo-cursor');
        el.style.left = `${String(cx)}px`;
        el.style.top = `${String(cy)}px`;
      },
      [cursor.x, cursor.y],
    );
    await snap();
  }
}
const scroller = (axis) =>
  page.evaluate((a) => {
    const s = document.querySelector('argus-table').shadowRoot.querySelector('[part~="table"]');
    return {
      now: s[a],
      max: a === 'scrollTop' ? s.scrollHeight - s.clientHeight : s.scrollWidth - s.clientWidth,
    };
  }, axis);
async function scrollTo(axis, to, ms) {
  const { now } = await scroller(axis);
  const n = steps(ms);
  for (let i = 1; i <= n; i++) {
    const value = now + (to - now) * ease(i / n);
    await page.evaluate(
      ([a, v]) => {
        document.querySelector('argus-table').shadowRoot.querySelector('[part~="table"]')[a] = v;
      },
      [axis, value],
    );
    await snap();
  }
}
const box = (selector) =>
  page.evaluate((s) => {
    const r = document
      .querySelector('argus-table')
      .shadowRoot.querySelector(s)
      .getBoundingClientRect();
    return { x: r.x, w: r.width, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  }, selector);
const header = (col) => box(`[role="columnheader"][data-col="${col}"]`);

// 1. The first view.
await moveTo(cursor.x, cursor.y, FRAME);
await snap(600);

// 2. Half a million rows down.
await scrollTo('scrollTop', (await scroller('scrollTop')).max * 0.5, 1800);
await snap(600);

// 3. Sideways: #, Name and the Open button stay pinned.
await scrollTo('scrollLeft', (await scroller('scrollLeft')).max, 1000);
await snap(400);

// 4. Sort by Amount, then back to the top: the smallest amounts first.
let h = await header('amount');
await moveTo(h.cx - 10, h.cy, 500);
await page.mouse.click(cursor.x, cursor.y);
await snap(250);
await moveTo(h.cx + 30, h.cy + 70, 250); // off the sort arrow
await snap(300);
await scrollTo('scrollTop', 0, 800);
await snap(600);

// 5. Back to the left, then drag Country before City.
await scrollTo('scrollLeft', 0, 600);
h = await header('country');
await moveTo(h.cx, h.cy, 450);
await page.mouse.down();
await snap();
const city = await header('city');
await moveTo(city.x + 12, h.cy, 800);
await snap(200);
await page.mouse.up();
await snap(600);

// 6. Resize Email by its handle.
const handle = await box('[role="columnheader"][data-col="email"] [part~="resize-handle"]');
await moveTo(handle.cx, handle.cy, 450);
await page.mouse.down();
await moveTo(handle.cx + 90, handle.cy, 650);
await page.mouse.up();
await snap(1200);

await browser.close();
await new Promise((resolve) => server.httpServer.close(resolve));

if (process.env.FRAMES) {
  mkdirSync(process.env.FRAMES, { recursive: true });
  frames.forEach((f, i) => {
    writeFileSync(`${process.env.FRAMES}/${String(i).padStart(3, '0')}.png`, f.png);
  });
}

// One palette for every frame (no colour flicker); identical frames merge into one.
const decoded = [];
for (const f of frames) {
  const image = PNG.sync.read(f.png);
  const last = decoded.at(-1);
  if (last && Buffer.compare(last.data, image.data) === 0) last.delay += f.delay;
  else decoded.push({ data: image.data, delay: f.delay });
}
const every = Math.max(1, Math.floor(decoded.length / 12));
const sample = decoded.filter((_, i) => i % every === 0);
const pixels = new Uint8Array(sample.reduce((n, f) => n + f.data.length, 0));
let offset = 0;
for (const f of sample) {
  pixels.set(f.data, offset);
  offset += f.data.length;
}
const palette = quantize(pixels, 256);
const gif = GIFEncoder();
decoded.forEach((f, i) => {
  gif.writeFrame(applyPalette(f.data, palette), width, height, {
    palette: i === 0 ? palette : undefined,
    delay: f.delay,
    repeat: 0,
  });
});
gif.finish();
writeFileSync(out, gif.bytes());
const seconds = decoded.reduce((n, f) => n + f.delay, 0) / 1000;
console.log(
  `${String(decoded.length)} frames, ${seconds.toFixed(1)} s, ${(gif.bytes().length / 1e6).toFixed(2)} MB: ${out}`,
);
