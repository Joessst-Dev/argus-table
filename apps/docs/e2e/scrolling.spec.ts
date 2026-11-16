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

    await example.getByRole('button', { name: 'Scroll to column' }).click();
    await expect(output).toHaveText('Scrolled.');
    expect(
      await table.evaluate(
        (el) => el.shadowRoot?.querySelector<HTMLElement>('[part~="table"]')?.scrollLeft ?? 0,
      ),
    ).toBeGreaterThan(0);

    await example.getByRole('textbox', { name: 'Order id' }).fill('nope');
    await example.getByRole('button', { name: 'Scroll to row' }).click();
    await expect(output).toHaveText('Not found.');
    await expectAccessible(page, example);
  });
}
