import { expect, test } from '@playwright/test';
import { cellText, expectAccessible, FLAVOURS, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: sorting sorts on a header click and follows its own state`, async ({
    page,
  }) => {
    await page.goto('features/sorting/');
    // Every tab but the first is hidden at load: its table must work once shown.
    const example = await openFlavour(page, 'sorting/basic', flavour);
    const table = example.locator('argus-table');
    const output = example.locator('output');
    await expect(output).toHaveText('total descending');
    await expect(table.locator('strong').first()).toBeVisible();
    await table.locator('[role="columnheader"][data-col="customer"]').click();
    await expect(output).toHaveText('customer ascending');
    await expect.poll(() => cellText(table, 2, 'customer')).toBe('Customer 1');
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: controlled sorting applies proposals, except the one it refuses`, async ({
    page,
  }) => {
    await page.goto('features/sorting/');
    const example = await openFlavour(page, 'sorting/controlled', flavour);
    const table = example.locator('argus-table');
    const output = example.locator('output');
    const customer = table.locator('[role="columnheader"][data-col="customer"]');
    await expect(output).toHaveText('total descending');
    await customer.click();
    await expect(output).toHaveText('customer ascending');
    await expect(customer).toHaveAttribute('aria-sort', 'ascending');
    // The second click proposes descending: refused, so the table stays ascending.
    await customer.click();
    await expect(output).toHaveText('Refused: customer descending');
    await expect(customer).toHaveAttribute('aria-sort', 'ascending');
    await expectAccessible(page, example);
  });
}
