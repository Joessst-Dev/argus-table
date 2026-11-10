import { expect, test, type Page } from '@playwright/test';
import { open, scrollTo, settle } from './helpers.js';

/** Header ids in visual order (by `aria-colindex`). */
async function headerIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [
      ...(document
        .querySelector('argus-table')
        ?.shadowRoot?.querySelectorAll<HTMLElement>('[role="columnheader"]') ?? []),
    ]
      .sort((a, b) => Number(a.ariaColIndex) - Number(b.ariaColIndex))
      .map((h) => h.dataset.col ?? ''),
  );
}

test('hidden columns render no cells, and the rest close up', async ({ page }) => {
  await open(page, { rows: 200, cols: 8, hide: 'email,status' });
  const ids = await headerIds(page);
  expect(ids).not.toContain('email');
  expect(ids).not.toContain('status');
  const cells = await page.evaluate(() => {
    const row = document
      .querySelector('argus-table')
      ?.shadowRoot?.querySelector('[part~="body"] > [part~="row"]');
    return [...(row?.querySelectorAll<HTMLElement>('[role="gridcell"]') ?? [])].map((c) => [
      c.dataset.col,
      c.getAttribute('aria-colindex'),
    ]);
  });
  expect(cells.map(([col]) => col)).toEqual(ids);
  expect(cells.map(([, index]) => Number(index))).toEqual(ids.map((_, i) => i + 1));

  await page.evaluate(() => {
    const table = document.querySelector('argus-table');
    if (table) table.columnVisibility = {};
  });
  await settle(page);
  expect(await headerIds(page)).toContain('email');
});

test('a column pinned through columnPinning stays at the start edge while the rest scrolls', async ({
  page,
}) => {
  await open(page, { rows: 200, cols: 20, pins: 'email:start,name:false' });
  const ids = await headerIds(page);
  expect(ids.slice(0, 2)).toEqual(['index', 'email']);
  const before = await page.evaluate(
    () =>
      document
        .querySelector('argus-table')
        ?.shadowRoot?.querySelector('[role="columnheader"][data-col="email"]')
        ?.getBoundingClientRect().left,
  );
  await scrollTo(page, null, 800);
  const after = await page.evaluate(() => {
    const root = document.querySelector('argus-table')?.shadowRoot;
    const scroller = root?.querySelector<HTMLElement>('[part~="table"]');
    return {
      scrolled: scroller?.scrollLeft ?? 0,
      email: root?.querySelector('[role="columnheader"][data-col="email"]')?.getBoundingClientRect()
        .left,
      name: root?.querySelector('[role="columnheader"][data-col="name"]')?.getBoundingClientRect()
        .left,
    };
  });
  expect(after.scrolled).toBeGreaterThan(700);
  expect(after.email).toBeCloseTo(before ?? -1, 0);
  // `name`, pinned by its definition, was unpinned and scrolled away.
  expect(after.name ?? 0).toBeLessThan(before ?? 0);
});
