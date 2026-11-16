import { expect, test } from '@playwright/test';
import { expectAccessible, FLAVOURS, headerTexts, openFlavour } from './flavours';

test('every flavour of declarative columns renders its children in order', async ({ page }) => {
  await page.goto('features/declarative-columns/');
  for (const flavour of FLAVOURS) {
    await test.step(flavour, async () => {
      const example = await openFlavour(page, 'declarative-columns/markup', flavour);
      const table = example.locator('argus-table');
      await expect
        .poll(() => headerTexts(table))
        .toEqual(['Order', 'Customer', 'City', 'Status', 'Total', 'Actions']);
      await expect(table.getByRole('button', { name: 'Open' }).first()).toBeVisible();
      await expect(table.locator('strong').first()).toBeVisible();
      await expectAccessible(page, example);
    });
  }
});

test('every flavour of dynamic columns follows its children', async ({ page }) => {
  await page.goto('features/declarative-columns/');
  for (const flavour of FLAVOURS) {
    await test.step(flavour, async () => {
      const example = await openFlavour(page, 'declarative-columns/dynamic', flavour);
      const table = example.locator('argus-table');
      await expect.poll(() => headerTexts(table)).toEqual(['Order', 'Customer', 'Total']);
      await example.getByRole('checkbox', { name: 'Show City' }).check();
      await expect.poll(() => headerTexts(table)).toEqual(['Order', 'Customer', 'City', 'Total']);
      await example.getByRole('checkbox', { name: 'Show City' }).uncheck();
      await expect.poll(() => headerTexts(table)).toEqual(['Order', 'Customer', 'Total']);
      await expectAccessible(page, example);
    });
  }
});
