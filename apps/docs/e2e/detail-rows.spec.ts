import { expect, test } from '@playwright/test';
import { expectAccessible, FLAVOURS, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: opens and closes a row's panel`, async ({ page }) => {
    await page.goto('features/detail-rows/');
    const example = await openFlavour(page, 'detail-rows/basic', flavour);
    const table = example.locator('argus-table');
    // Order o2's panel is open: under row 2 (aria-rowindex 3), at 4.
    await expect(table.locator('.order-summary')).toHaveText('Customer 2 in Oslo, paid: 79.2');
    const chevron = (ariaRowIndex: number) =>
      table.locator(
        `[part~="body"] > [aria-rowindex="${String(ariaRowIndex)}"] [part~="expand-toggle"]`,
      );
    await expect(chevron(3)).toHaveAttribute('aria-expanded', 'true');
    await chevron(3).click();
    await expect(table.locator('.order-summary')).toHaveCount(0);
    await chevron(2).click();
    await expect(table.locator('.order-summary')).toHaveText('Customer 1 in Lisbon, open: 0');
    await expectAccessible(page, example);
  });

  test(`${flavour}: a form in a panel keeps what was typed`, async ({ page }) => {
    await page.goto('features/detail-rows/');
    const example = await openFlavour(page, 'detail-rows/form', flavour);
    const table = example.locator('argus-table');
    const input = table.getByRole('textbox', { name: 'Note for Customer 1' });
    await input.fill('Leave at the door');
    // Away and back: the panel keeps its content.
    await table.evaluate(async (el) => {
      await (el as unknown as { scrollToRow(i: number): Promise<boolean> }).scrollToRow(150);
      await (el as unknown as { scrollToRow(i: number): Promise<boolean> }).scrollToRow(0);
    });
    await expect(input).toHaveValue('Leave at the door');
    await table.getByRole('button', { name: 'Save' }).click();
    await expect(table.locator('form output')).toHaveText('Saved: Leave at the door');
    await expectAccessible(page, example);
  });

  test(`${flavour}: a nested table fits its rows`, async ({ page }) => {
    await page.goto('features/detail-rows/');
    const example = await openFlavour(page, 'detail-rows/nested-table', flavour);
    const outer = example.locator('argus-table').first();
    // Order o1 has 4 lines: the nested table is a header and 4 rows tall.
    const lines = outer.getByRole('grid', { name: 'Lines of o1' });
    await expect(lines.locator('[part~="body"] > [role="row"]')).toHaveCount(4);
    const box = async () => (await lines.boundingBox())?.height ?? 0;
    const row = async () =>
      (await lines.locator('[part~="body"] > [role="row"]').first().boundingBox())?.height ?? 0;
    await expect.poll(async () => Math.abs((await box()) - 5 * (await row()))).toBeLessThan(2);
    // Its sorting is its own.
    await lines.getByRole('columnheader', { name: 'Product' }).click();
    await expect(lines.getByRole('columnheader', { name: 'Product' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await expectAccessible(page, example);
  });
}
