import { expect, test } from '@playwright/test';
import { expectAccessible, FLAVOURS, headerOrder, openFlavour } from './flavours';

const START = ['id', 'title', 'owner', 'status', 'estimate'];
const MOVED = ['id', 'owner', 'title', 'status', 'estimate'];

for (const flavour of FLAVOURS) {
  test(`${flavour}: column reorder moves a column from the keyboard`, async ({ page }) => {
    await page.goto('features/column-reorder/');
    const example = await openFlavour(page, 'column-reorder/basic', flavour);
    const table = example.locator('argus-table');
    await expect.poll(() => headerOrder(table)).toEqual(START);
    await table.locator('[role="columnheader"][data-col="owner"]').focus();
    await page.keyboard.press('Alt+Shift+ArrowLeft');
    await expect.poll(() => headerOrder(table)).toEqual(MOVED);
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await expect.poll(() => headerOrder(table)).toEqual(START);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: saved column order keeps it across a reload`, async ({ page }) => {
    await page.goto('features/column-reorder/');
    let example = await openFlavour(page, 'column-reorder/controlled', flavour);
    await expect.poll(() => headerOrder(example.locator('argus-table'))).toEqual(START);
    await example.locator('[role="columnheader"][data-col="owner"]').focus();
    await page.keyboard.press('Alt+Shift+ArrowLeft');
    await expect.poll(() => headerOrder(example.locator('argus-table'))).toEqual(MOVED);
    await expect(example.locator('output')).toContainText('"id","owner","title"');
    await page.reload();
    example = await openFlavour(page, 'column-reorder/controlled', flavour);
    await expect.poll(() => headerOrder(example.locator('argus-table'))).toEqual(MOVED);
    await expectAccessible(page, example);
  });
}
