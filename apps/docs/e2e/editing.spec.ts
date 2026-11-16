import { expect, test } from '@playwright/test';
import { bodyCell, cellText, expectAccessible, FLAVOURS, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: Enter edits a cell, and the app applies the edit`, async ({ page }) => {
    await page.goto('features/editing/');
    const example = await openFlavour(page, 'editing/basic', flavour);
    const table = example.locator('argus-table');
    await bodyCell(table, 0, 'customer').focus();
    await page.keyboard.press('Enter');
    const input = table.locator('.argus-edit-input');
    await expect(input).toHaveAttribute('aria-label', 'Customer, row 1');
    await input.fill('Ada Lovelace');
    await page.keyboard.press('Enter');
    await expect.poll(() => cellText(table, 2, 'customer')).toBe('Ada Lovelace');
    await expect(table.locator('.argus-edit-input')).toHaveCount(0);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: validation keeps the editor open, Escape cancels`, async ({ page }) => {
    await page.goto('features/editing/');
    const example = await openFlavour(page, 'editing/validation', flavour);
    const table = example.locator('argus-table');
    const before = await cellText(table, 2, 'total');
    await bodyCell(table, 0, 'total').focus();
    await page.keyboard.type('-5');
    await page.keyboard.press('Enter');
    await expect(table.locator('.argus-edit-error')).toHaveText('Enter an amount of 0 or more');
    await expect(table.locator('.argus-edit-input')).toHaveAttribute('aria-invalid', 'true');
    await page.keyboard.press('Escape');
    await expect(table.locator('.argus-edit-input')).toHaveCount(0);
    await expect.poll(() => cellText(table, 2, 'total')).toBe(before);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: a checkbox toggles, and a custom editor commits`, async ({ page }) => {
    await page.goto('features/editing/');
    const example = await openFlavour(page, 'editing/more-editors', flavour);
    const table = example.locator('argus-table');
    // Task 2 isn't done; its checkbox toggles without an editing mode.
    const box = table.locator('.argus-edit-check').nth(1);
    await expect(box).not.toBeChecked();
    await box.click();
    await expect(box).toBeChecked();
    // The custom editor: three buttons, focused when it opens.
    await bodyCell(table, 0, 'priority').focus();
    await page.keyboard.press('Enter');
    const high = table.getByRole('button', { name: 'Priority 3' });
    await expect(table.getByRole('button', { name: 'Priority 1' })).toBeFocused();
    await high.click();
    await expect.poll(() => cellText(table, 2, 'priority')).toBe('!!!');
    await expectAccessible(page, example);
  });
}
