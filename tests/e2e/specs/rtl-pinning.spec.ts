import { expect, test } from '@playwright/test';
import { open, scrollTo } from './helpers.js';

test('in RTL, pinned columns stay at their edges while the rest scrolls', async ({ page }) => {
  await open(page, { rows: 200, cols: 20, dir: 'rtl' });
  // In RTL, scrollLeft runs from 0 toward negative values.
  await scrollTo(page, null, -800);
  const edges = await page.evaluate(() => {
    const root = document.querySelector('argus-table')?.shadowRoot;
    const scroller = root?.querySelector<HTMLElement>('[part~="table"]');
    const row = root?.querySelector('[part~="body"] > [part~="row"]');
    if (!scroller || !row) throw new Error('table not rendered');
    const box = scroller.getBoundingClientRect();
    const left = box.left + scroller.clientLeft;
    const cell = (col: string) => row.querySelector(`[data-col="${col}"]`)?.getBoundingClientRect();
    return {
      scrolled: scroller.scrollLeft,
      contentLeft: left,
      contentRight: left + scroller.clientWidth,
      start: cell('index'),
      end: cell('actions'),
      scrolling: cell('email'),
    };
  });
  expect(edges.scrolled).toBeLessThan(-700);
  // Start-pinned (#) at the right edge, end-pinned (actions) at the left edge.
  expect(edges.start?.right).toBeCloseTo(edges.contentRight, 0);
  expect(edges.end?.left).toBeCloseTo(edges.contentLeft, 0);
  // A scrolling column has moved out from under the pinned ones.
  expect(edges.scrolling?.right ?? 0).toBeGreaterThan(edges.contentRight);
});
