import { expect, test } from '@playwright/test';
import { expectAccessible, FLAVOURS, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: saved state comes back on restore`, async ({ page }) => {
    await page.goto('features/saved-state/');
    const example = await openFlavour(page, 'saved-state/save-restore', flavour);
    const table = example.locator('argus-table');
    const output = example.locator('output');
    const header = (id: string) => table.locator(`[role="columnheader"][data-col="${id}"]`);
    const topRow = () =>
      table.evaluate(
        (el) =>
          (el as HTMLElement & { getState(): { scroll: { row: number } } }).getState().scroll.row,
      );
    const scrollTo = (row: number) =>
      table.evaluate(
        (el, r) =>
          (el as HTMLElement & { scrollToRow(r: number): Promise<boolean> }).scrollToRow(r),
        row,
      );

    await header('total').click();
    await expect(header('total')).toHaveAttribute('aria-sort', 'ascending');
    await scrollTo(250);
    await example.getByRole('button', { name: 'Save' }).click();
    await expect(output).toHaveText('Saved.');

    await header('city').click();
    await expect(header('total')).not.toHaveAttribute('aria-sort', 'ascending');
    await scrollTo(0);
    await example.getByRole('button', { name: 'Restore' }).click();
    await expect(output).toHaveText('Restored.');
    await expect(header('total')).toHaveAttribute('aria-sort', 'ascending');
    await expect.poll(topRow).toBe(250);

    await example.getByRole('button', { name: 'Forget' }).click();
    await example.getByRole('button', { name: 'Restore' }).click();
    await expect(output).toHaveText('Nothing saved yet.');
    await expectAccessible(page, example);
  });
}
