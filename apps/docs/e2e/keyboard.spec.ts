import { expect, test } from '@playwright/test';
import { expectAccessible, FLAVOURS, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: the keyboard moves focus and Enter clicks a cell`, async ({ page }) => {
    await page.goto('features/keyboard/');
    const example = await openFlavour(page, 'keyboard/navigation', flavour);
    const table = example.locator('argus-table');
    const active = () =>
      table.evaluate((el) => {
        const cell = el.shadowRoot?.activeElement as HTMLElement | null;
        return {
          col: cell?.dataset.col,
          row: Number(cell?.parentElement?.getAttribute('aria-rowindex')),
        };
      });
    // One tab stop, on the first header.
    const first = table.locator('[role="columnheader"][tabindex="0"]');
    await expect(first).toHaveAttribute('data-col', 'id');
    await first.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await expect.poll(active).toEqual({ col: 'customer', row: 2 });
    // A page down moves by several rows and keeps the column.
    await page.keyboard.press('PageDown');
    await expect.poll(async () => (await active()).row).toBeGreaterThan(3);
    expect((await active()).col).toBe('customer');
    const row = (await active()).row;
    await page.keyboard.press('Enter');
    await expect(example.locator('output')).toHaveText(
      `argus-cell-click: customer = Customer ${String(row - 1)}`,
    );
    await expectAccessible(page, example);
  });
}
