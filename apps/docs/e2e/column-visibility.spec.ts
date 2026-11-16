import { expect, test } from '@playwright/test';
import { expectAccessible, FLAVOURS, headerOrder, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: pin and visibility controls drives the table`, async ({ page }) => {
    await page.goto('features/column-visibility/');
    const example = await openFlavour(page, 'column-visibility/controls', flavour);
    const table = example.locator('argus-table');
    const group = (name: string) => example.getByRole('group', { name });
    // Status starts hidden.
    await expect.poll(() => headerOrder(table)).not.toContain('status');
    await expect(group('#').getByRole('checkbox', { name: 'Shown' })).toBeDisabled();

    await group('Owner').getByRole('combobox', { name: 'Pin' }).selectOption('start');
    await expect.poll(async () => (await headerOrder(table)).slice(0, 2)).toEqual(['id', 'owner']);
    await group('Title').getByRole('checkbox', { name: 'Shown' }).uncheck();
    await expect.poll(() => headerOrder(table)).not.toContain('title');
    await group('Title').getByRole('checkbox', { name: 'Shown' }).check();
    await expect.poll(() => headerOrder(table)).toContain('title');
    await group('Owner').getByRole('combobox', { name: 'Pin' }).selectOption('none');
    await expect.poll(async () => (await headerOrder(table)).slice(0, 2)).toEqual(['id', 'title']);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: declarative visibility follows the hidden attribute`, async ({ page }) => {
    await page.goto('features/column-visibility/');
    const example = await openFlavour(page, 'column-visibility/declarative', flavour);
    const table = example.locator('argus-table');
    await expect.poll(() => headerOrder(table)).toEqual(['id', 'title', 'status']);
    await example.getByRole('button', { name: 'Show Owner' }).click();
    await expect.poll(() => headerOrder(table)).toEqual(['id', 'title', 'owner', 'status']);
    await example.getByRole('button', { name: 'Hide Owner' }).click();
    await expect.poll(() => headerOrder(table)).toEqual(['id', 'title', 'status']);
    await expectAccessible(page, example);
  });
}
