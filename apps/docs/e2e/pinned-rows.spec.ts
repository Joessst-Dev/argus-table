import { expect, test } from '@playwright/test';
import { expectAccessible, FLAVOURS, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: a totals row stays at the bottom while the body scrolls`, async ({ page }) => {
    await page.goto('features/pinned-rows/');
    const example = await openFlavour(page, 'pinned-rows/totals', flavour);
    const table = example.locator('argus-table');
    const totals = table.locator('[part~="row-pinned-bottom"]');
    // 200 data rows after the header: the totals row comes last.
    await expect(totals).toHaveAttribute('aria-rowindex', '202');
    // The cell content sees `pinned` and shows the summary its own way.
    await expect(table.locator('strong', { hasText: 'Total' })).toBeVisible();
    const before = (await totals.boundingBox())?.y;
    await table.evaluate((el) => {
      const scroller = el.shadowRoot?.querySelector('[part~="table"]');
      if (scroller) scroller.scrollTop = 2000;
    });
    await expect(table.locator('[role="row"][aria-rowindex="2"]')).toHaveCount(0);
    expect((await totals.boundingBox())?.y).toBe(before);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: the keyboard moves through pinned rows like any row`, async ({ page }) => {
    await page.goto('features/pinned-rows/');
    const example = await openFlavour(page, 'pinned-rows/top-and-bottom', flavour);
    const table = example.locator('argus-table');
    const focused = () =>
      table.evaluate(
        (el) => el.shadowRoot?.activeElement?.closest('[part~="row"]')?.getAttribute('part') ?? '',
      );
    await table.locator('[role="columnheader"][tabindex="0"]').focus();
    await page.keyboard.press('ArrowDown');
    await expect.poll(focused).toContain('row-pinned-top');
    await page.keyboard.press('Control+End');
    await expect.poll(focused).toContain('row-pinned-bottom');
    await page.keyboard.press('Enter');
    await expect(example.locator('output')).toHaveText('argus-row-click: total (pinned: bottom)');
    // The checkboxes add and remove the pinned rows.
    await example.getByRole('checkbox', { name: 'Average row on top' }).uncheck();
    await expect(table.locator('[part~="row-pinned-top"]')).toHaveCount(0);
    await expectAccessible(page, example);
  });
}
