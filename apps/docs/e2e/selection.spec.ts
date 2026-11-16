import { expect, test } from '@playwright/test';
import { bodyCell, expectAccessible, FLAVOURS, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: multi selection with clicks and keys`, async ({ page }) => {
    await page.goto('features/selection/');
    const example = await openFlavour(page, 'selection/multi', flavour);
    const table = example.locator('argus-table');
    const output = example.locator('output');
    await bodyCell(table, 1).click();
    await bodyCell(table, 3).click({ modifiers: ['Shift'] });
    await bodyCell(table, 6).click({ modifiers: ['ControlOrMeta'] });
    await expect(output).toHaveText('4 selected: o2, o3, o4, o7');
    await expect(table.locator('[part~="row-selected"]')).toHaveCount(4);
    // From the keyboard: Space toggles, Shift+ArrowDown extends, Ctrl+A selects all.
    await bodyCell(table, 6).click({ modifiers: ['ControlOrMeta'] });
    await bodyCell(table, 0).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(output).toHaveText(/^\d+ selected: o1, o2, o3/);
    await page.keyboard.press('ControlOrMeta+a');
    await expect(output).toHaveText(/^200 selected/);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: single selection keeps one row`, async ({ page }) => {
    await page.goto('features/selection/');
    const example = await openFlavour(page, 'selection/single', flavour);
    const table = example.locator('argus-table');
    const output = example.locator('output');
    await bodyCell(table, 4).click();
    await expect(output).toHaveText('1 selected: o5');
    // Ctrl+click replaces the row (multi mode would add it), and clears the selected one.
    await bodyCell(table, 2).click({ modifiers: ['ControlOrMeta'] });
    await expect(output).toHaveText('1 selected: o3');
    await expect(table.locator('[part~="row-selected"]')).toHaveCount(1);
    await bodyCell(table, 2).click({ modifiers: ['ControlOrMeta'] });
    await expect(output).toHaveText('0 selected');
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: checkboxes select rows, and all of them`, async ({ page }) => {
    await page.goto('features/selection/');
    const example = await openFlavour(page, 'selection/checkboxes', flavour);
    const table = example.locator('argus-table');
    const box = (row: number) => bodyCell(table, row, '--argus-selection').locator('input');
    const all = table.locator('[part~="header-cell-selection"] input');
    await box(1).click();
    await box(3).click();
    await expect(example.locator('output')).toHaveText('2 selected: o2, o4');
    // Shift+click adds the range from the last row clicked.
    await box(6).click({ modifiers: ['Shift'] });
    await expect(example.locator('output')).toHaveText('5 selected: o2, o4, o5, o6, o7');
    await expect
      .poll(() => all.evaluate((el) => (el as HTMLInputElement).indeterminate))
      .toBe(true);
    await all.click();
    await expect(example.locator('output')).toHaveText(/^200 selected/);
    await expect(all).toBeChecked();
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: controlled selection refuses more than five rows`, async ({ page }) => {
    await page.goto('features/selection/');
    const example = await openFlavour(page, 'selection/controlled', flavour);
    const table = example.locator('argus-table');
    const output = example.locator('output');
    await bodyCell(table, 0).click();
    await expect(output).toHaveText('1 selected: o1');
    await bodyCell(table, 9).click({ modifiers: ['Shift'] });
    await expect(output).toHaveText('Refused 10 rows: at most 5. 1 selected: o1');
    await expect(table.locator('[part~="row-selected"]')).toHaveCount(1);
    await bodyCell(table, 4).click({ modifiers: ['Shift'] });
    await expect(output).toHaveText('5 selected: o1, o2, o3, o4, o5');
    await example.getByRole('button', { name: 'Clear' }).click();
    await expect(output).toHaveText('0 selected');
    await expect(table.locator('[part~="row-selected"]')).toHaveCount(0);
    await expectAccessible(page, example);
  });
}
