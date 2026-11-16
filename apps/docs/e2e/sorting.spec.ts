import { expect, test } from '@playwright/test';
import { cellText, expectAccessible, FLAVOURS, openFlavour } from './flavours';

test('every flavour of Sorting sorts on a header click and follows its own state', async ({
  page,
}) => {
  await page.goto('features/sorting/');
  // One page load, every tab in turn: hidden tabs' tables must work once shown.
  for (const flavour of FLAVOURS) {
    await test.step(flavour, async () => {
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
});
