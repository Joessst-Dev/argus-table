import { expect, test, type Locator } from '@playwright/test';
import { expectAccessible, FLAVOURS, openFlavour } from './flavours';

const style = (target: Locator, property: string) =>
  target.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property);

for (const flavour of FLAVOURS) {
  test(`${flavour}: ::part() rules style the table`, async ({ page }) => {
    await page.goto('features/styling/');
    const example = await openFlavour(page, 'styling/parts', flavour);
    const table = example.locator('argus-table');
    const header = table.locator('[part~="header-cell"]').first();
    expect(await style(header, 'text-transform')).toBe('uppercase');
    // Sorting adds header-cell-sorted and cell-sorted.
    const customer = table.locator('[role="columnheader"][data-col="customer"]');
    await customer.click();
    await expect.poll(() => style(customer, 'text-decoration-line')).toBe('underline');
    const cell = table.locator('[part~="cell-sorted"]').first();
    expect(await style(cell, 'font-weight')).toBe('600');
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: page CSS styles slotted content`, async ({ page }) => {
    await page.goto('features/styling/');
    const example = await openFlavour(page, 'styling/slotted-content', flavour);
    const table = example.locator('argus-table');
    expect(await style(table.locator('.badge').first(), 'border-radius')).toBe('999px');
    const hidden = table.locator('.visually-hidden', { hasText: 'Actions' });
    await expect(hidden).toHaveCount(1);
    const box = await hidden.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeLessThanOrEqual(1);
    // Hidden from sight, not from screen readers.
    await expect(table.getByRole('columnheader', { name: 'Actions' })).toBeAttached();
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: tokens give striped, taller rows`, async ({ page }) => {
    await page.goto('features/styling/');
    const example = await openFlavour(page, 'styling/striped', flavour);
    const table = example.locator('argus-table');
    const row = table.locator('[part~="row"]').first();
    expect(await row.evaluate((el) => (el as HTMLElement).offsetHeight)).toBe(44);
    const odd = await style(table.locator('[part~="row-odd"]').first(), 'background-color');
    const even = await style(table.locator('[part~="row-even"]').first(), 'background-color');
    expect(odd).not.toBe(even);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: tokens give a rounded, bordered table`, async ({ page }) => {
    await page.goto('features/styling/');
    const example = await openFlavour(page, 'styling/rounded', flavour);
    const table = example.locator('argus-table');
    expect(await style(table, 'border-top-right-radius')).toBe('12px');
    expect(await style(table, 'border-top-width')).toBe('1px');
    await expectAccessible(page, example);
  });
}
