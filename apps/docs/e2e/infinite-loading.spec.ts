import { expect, test, type Locator } from '@playwright/test';
import { cellText, expectAccessible, FLAVOURS, openFlavour } from './flavours';
import { orders } from '../src/examples/infinite-loading/data';

const toEnd = (table: Locator) =>
  table.evaluate((el) => {
    const scroller = el.shadowRoot?.querySelector('[part~="table"]');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });

/** The highest `aria-rowindex` among rows that have loaded. */
const lastLoaded = (table: Locator) =>
  table.evaluate((el) =>
    Math.max(
      0,
      ...[...(el.shadowRoot?.querySelectorAll('[part~="body"] > [part~="row"]') ?? [])]
        .filter((row) => !row.getAttribute('part')?.includes('row-loading'))
        .map((row) => Number(row.getAttribute('aria-rowindex'))),
    ),
  );

for (const flavour of FLAVOURS) {
  test(`${flavour}: a data source with a total loads pages and sorts on the server`, async ({
    page,
  }) => {
    await page.goto('features/infinite-loading/');
    const example = await openFlavour(page, 'infinite-loading/known-total', flavour);
    const table = example.locator('argus-table');
    await expect.poll(() => cellText(table, 2, 'id'), { timeout: 5000 }).toBe('o1');
    await toEnd(table);
    await expect(table.getByText(`o${String(orders.length)}`, { exact: true })).toBeVisible({
      timeout: 5000,
    });
    // Two clicks on Total: descending, from the top.
    const total = table.locator('[role="columnheader"][data-col="total"]');
    await total.click();
    await total.click();
    const largest = Math.max(...orders.map((o) => o.total));
    await expect.poll(() => cellText(table, 2, 'total'), { timeout: 5000 }).toBe(String(largest));
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: a data source without a total grows as it scrolls`, async ({ page }) => {
    await page.goto('features/infinite-loading/');
    const example = await openFlavour(page, 'infinite-loading/unknown-total', flavour);
    const table = example.locator('argus-table');
    await expect.poll(() => lastLoaded(table), { timeout: 5000 }).toBeGreaterThan(1);
    const first = await lastLoaded(table);
    await toEnd(table);
    await expect.poll(() => lastLoaded(table), { timeout: 5000 }).toBeGreaterThan(first);
    const second = await lastLoaded(table);
    await toEnd(table);
    await expect.poll(() => lastLoaded(table), { timeout: 5000 }).toBeGreaterThan(second);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: a failed page is logged and retried`, async ({ page }) => {
    await page.goto('features/infinite-loading/');
    const example = await openFlavour(page, 'infinite-loading/failed-page', flavour);
    const table = example.locator('argus-table');
    await expect(example.locator('output')).toHaveText(
      'argus-load-error: rows 0–100, Error: Rows 0–100 timed out',
      { timeout: 5000 },
    );
    const retry = table.locator('[part~="retry"]');
    await expect(retry).toHaveAttribute('aria-label', 'Retry loading rows 1 to 100');
    await expectAccessible(page, example);
    await retry.click();
    await expect.poll(() => cellText(table, 2, 'id'), { timeout: 5000 }).toBe('o1');
  });
}
