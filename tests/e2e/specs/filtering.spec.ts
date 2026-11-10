import { expect, test } from '@playwright/test';
import type { RowsRequest } from 'argus-table';
import { open, scrollTo, settle, visibleRows } from './helpers.js';

declare global {
  interface Window {
    /** Set by the playground with `source=remote`. */
    __argusRequests?: RowsRequest[];
  }
}

const cities = async (page: Parameters<typeof visibleRows>[0]) =>
  (await visibleRows(page)).map((r) => r.cells.city);

test('columnFilters from the page keeps only matching rows, down to the last one', async ({
  page,
}) => {
  const filter = { city: { kind: 'set', values: ['Osaka'] } };
  await open(page, { cols: 8, filter: JSON.stringify(filter) });
  const header = page.locator('argus-table [role="columnheader"][data-col="city"]');
  await expect(header).toHaveAttribute('part', /header-cell-filtered/);
  const top = await cities(page);
  expect(top.length).toBeGreaterThan(3);
  expect(new Set(top)).toEqual(new Set(['Osaka']));

  // The scroll range shrank with the rows: the end holds Osaka rows too.
  await scrollTo(page, -1);
  const end = await cities(page);
  expect(end.length).toBeGreaterThan(3);
  expect(new Set(end)).toEqual(new Set(['Osaka']));
});

test('a quick filter narrows 100k rows while scrolled deep, and clearing it brings them back', async ({
  page,
}) => {
  await open(page, { cols: 8 });
  await scrollTo(page, 2_000_000);
  await page.evaluate(() => {
    const table = document.querySelector('argus-table');
    if (table) table.quickFilter = 'lisbon';
  });
  await settle(page);
  await settle(page);
  const rows = await visibleRows(page);
  expect(rows.length).toBeGreaterThan(3);
  expect(rows.every((r) => r.cells.city === 'Lisbon')).toBe(true);

  await page.evaluate(() => {
    const table = document.querySelector('argus-table');
    if (table) table.quickFilter = '';
  });
  await settle(page);
  expect(new Set(await cities(page)).size).toBeGreaterThan(1);
});

test('with a dataSource, filters go to the server and the rows reload from the top', async ({
  page,
}) => {
  await open(page, { source: 'remote', latency: 0, cols: 8 });
  await scrollTo(page, 4000);
  await page.evaluate(() => {
    const table = document.querySelector('argus-table');
    if (table) {
      table.columnFilters = { city: { kind: 'set', values: ['Toronto'] } };
      table.quickFilter = 'grace';
    }
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.__argusRequests ?? []).some(
          (r) => r.quickFilter === 'grace' && 'city' in r.filters && r.start === 0,
        ),
      ),
    )
    .toBe(true);
  await expect.poll(async () => (await visibleRows(page))[0]?.rowIndex).toBe(2);
  await expect
    .poll(async () => {
      const rows = await visibleRows(page);
      return (
        rows.length > 0 &&
        rows.every((r) => r.cells.city === 'Toronto' && /grace/i.test(r.cells.name ?? ''))
      );
    })
    .toBe(true);
});
