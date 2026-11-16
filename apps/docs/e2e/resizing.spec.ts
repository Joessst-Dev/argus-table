import { expect, test, type Locator } from '@playwright/test';
import { expectAccessible, FLAVOURS, openFlavour } from './flavours';

const header = (table: Locator, id: string) =>
  table.locator(`[role="columnheader"][data-col="${id}"]`);
const width = (cell: Locator) => cell.evaluate((el) => (el as HTMLElement).offsetWidth);

test('every flavour of resizing resizes within the column’s bounds', async ({ page }) => {
  await page.goto('features/resizing/');
  for (const flavour of FLAVOURS) {
    await test.step(flavour, async () => {
      const example = await openFlavour(page, 'resizing/basic', flavour);
      const table = example.locator('argus-table');
      // `resizable: false` on # leaves three handles.
      await expect(table.locator('[part~="resize-handle"]')).toHaveCount(3);
      const owner = header(table, 'owner');
      await owner.focus();
      await page.keyboard.press('Alt+ArrowRight');
      await expect.poll(() => width(owner)).toBe(130);
      for (let i = 0; i < 15; i++) await page.keyboard.press('Alt+ArrowRight');
      // maxWidth 240.
      await expect.poll(() => width(owner)).toBe(240);
      await expectAccessible(page, example);
    });
  }
});

test('every flavour of controlled resizing keeps the widths across a reload', async ({ page }) => {
  await page.goto('features/resizing/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  for (const flavour of FLAVOURS) {
    await test.step(flavour, async () => {
      let example = await openFlavour(page, 'resizing/controlled', flavour);
      let owner = header(example.locator('argus-table'), 'owner');
      const before = await width(owner);
      await owner.focus();
      await page.keyboard.press('Alt+ArrowRight');
      await expect.poll(() => width(owner)).toBe(before + 10);
      await expect(example.locator('output')).toContainText(`"owner":${String(before + 10)}`);
      await page.reload();
      example = await openFlavour(page, 'resizing/controlled', flavour);
      owner = header(example.locator('argus-table'), 'owner');
      await expect.poll(() => width(owner)).toBe(before + 10);
      await expectAccessible(page, example);
    });
  }
});
