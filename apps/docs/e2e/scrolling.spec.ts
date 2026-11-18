import { expect, test } from '@playwright/test';
import { expectAccessible, FLAVOURS, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: scrolls to a row by id and to a column`, async ({ page }) => {
    await page.goto('features/scrolling/');
    const example = await openFlavour(page, 'scrolling/scroll-to', flavour);
    const table = example.locator('argus-table');
    const output = example.locator('output');

    await example.getByRole('button', { name: 'Scroll to row' }).click();
    await expect(output).toHaveText('Scrolled.');
    await expect(table.getByText('o50000', { exact: true })).toBeInViewport();

    // Month 15 (the select's default) lands between the pinned Order and Total columns.
    await example.getByRole('button', { name: 'Scroll to column' }).click();
    await expect(output).toHaveText('Scrolled.');
    const box = (id: string) =>
      table.locator(`[role="columnheader"][data-col="${id}"]`).boundingBox();
    await expect
      .poll(async () => {
        const [start, target, end] = [await box('id'), await box('m15'), await box('total')];
        if (!start || !target || !end) return false;
        return target.x >= start.x + start.width - 1 && target.x + target.width <= end.x + 1;
      })
      .toBe(true);

    await example.getByRole('textbox', { name: 'Order id' }).fill('nope');
    await example.getByRole('button', { name: 'Scroll to row' }).click();
    await expect(output).toHaveText('Not found.');
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: fits its rows up to its maximum height`, async ({ page }) => {
    await page.goto('features/scrolling/');
    const example = await openFlavour(page, 'scrolling/fit-to-content', flavour);
    const table = example.locator('argus-table');
    const height = async () => (await table.boundingBox())?.height ?? 0;
    const rows = () => table.locator('[part~="body"] > [role="row"]').count();

    // The header and 4 rows: 5 rows tall.
    await expect.poll(rows).toBe(4);
    const row = (await height()) / 5;
    await example.getByRole('button', { name: 'Add row' }).click();
    await expect.poll(height).toBeCloseTo(6 * row, 0);
    await example.getByRole('button', { name: 'Remove row' }).click();
    await example.getByRole('button', { name: 'Remove row' }).click();
    await expect.poll(height).toBeCloseTo(4 * row, 0);

    // Past 320px it stops growing and scrolls.
    for (let i = 0; i < 10; i++) await example.getByRole('button', { name: 'Add row' }).click();
    await expect.poll(height).toBeCloseTo(320, 0);
    await expectAccessible(page, example);
  });
}
