import { expect, test } from '@playwright/test';
import { expectAccessible, FLAVOURS, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: only the columns in view render, and the keyboard reaches all`, async ({
    page,
  }) => {
    await page.goto('features/column-virtualization/');
    const example = await openFlavour(page, 'column-virtualization/wide-table', flavour);
    const table = example.locator('argus-table');
    const headers = table.locator('[role="columnheader"]');
    await expect.poll(() => headers.count()).toBeLessThan(30);
    // End lands on the last column (Actions); one to the left is c500.
    await table.locator('[part~="body"] [data-col="name"]').first().click();
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    await expect
      .poll(() =>
        table.evaluate((el) => (el.shadowRoot?.activeElement as HTMLElement | null)?.dataset.col),
      )
      .toBe('c500');
    // In view, and clear of the pinned Actions column.
    const box = (id: string) =>
      table.locator(`[role="columnheader"][data-col="${id}"]`).boundingBox();
    await expect
      .poll(async () => {
        const [target, actions] = [await box('c500'), await box('actions')];
        return !!target && !!actions && target.x + target.width <= actions.x + 1;
      })
      .toBe(true);
    await expectAccessible(page, example);
  });
}
