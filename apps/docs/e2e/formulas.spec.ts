import { expect, test, type Locator } from '@playwright/test';
import { cellText, expectAccessible, FLAVOURS, openFlavour } from './flavours';
import { items, type Item } from '../src/examples/formulas/data';

const header = (table: Locator, id: string) =>
  table.locator(`[role="columnheader"][data-col="${id}"]`);
/** A body cell's text, by position (0 = the first row). */
const at = (table: Locator, row: number, id: string) => cellText(table, row + 2, id);

/** Opens a column's menu and clicks the item whose text starts with `label`. */
async function menuItem(table: Locator, id: string, label: string) {
  const button = await header(table, id).evaluateHandle((cell) =>
    cell
      .querySelector('slot')
      ?.assignedElements({ flatten: true })[0]
      ?.querySelector('.argus-header-menu-button'),
  );
  const element = button.asElement();
  if (!element) throw new Error(`no menu button in ${id}`);
  await element.click();
  await table
    .locator('.argus-header-menu:popover-open [role^="menuitem"]', { hasText: label })
    .first()
    .click();
}

const totalOf = (item: Item) => item.price * item.qty * (1 - item.discount);

for (const flavour of FLAVOURS) {
  test(`${flavour}: formula columns compute, and sort`, async ({ page }) => {
    await page.goto('features/formulas/');
    const example = await openFlavour(page, 'formulas/basic', flavour);
    const table = example.locator('argus-table');
    await expect.poll(() => at(table, 1, 'total')).toBe('21.28');
    expect(await at(table, 1, 'gross')).toBe('25.32');
    expect(await at(table, 1, 'stock')).toBe('Low');
    expect(await at(table, 2, 'stock')).toBe('OK');
    expect(await at(table, 1, 'month')).toBe('Feb 2026');
    await header(table, 'gross').click();
    await header(table, 'gross').click();
    await expect(header(table, 'gross')).toHaveAttribute('aria-sort', 'descending');
    await expect.poll(async () => Number(await at(table, 0, 'gross'))).toBeGreaterThan(1000);
    expect(Number(await at(table, 0, 'gross'))).toBeGreaterThanOrEqual(
      Number(await at(table, 1, 'gross')),
    );
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: whole columns follow the filters`, async ({ page }) => {
    await page.goto('features/formulas/');
    const example = await openFlavour(page, 'formulas/whole-columns', flavour);
    const table = example.locator('argus-table');
    const best = items.reduce((a, b) => (totalOf(b) > totalOf(a) ? b : a));
    await expect.poll(() => at(table, 0, 'rank')).toBe('1');
    expect(await at(table, 0, 'orders')).toBe(String(items.length / 5));
    expect(await at(table, 0, 'best')).toBe(best.product);
    // Only notebooks, through the column menu's filter form.
    await menuItem(table, 'product', 'Filter…');
    const form = table.locator('.argus-header-filter:popover-open');
    await form.locator('.argus-header-filter-all input').click();
    await form.locator('.argus-header-filter-values label', { hasText: 'Notebook' }).click();
    await page.keyboard.press('Escape');
    const notebooks = items.filter((item) => item.product === 'Notebook');
    await expect.poll(() => at(table, 0, 'product')).toBe('Notebook');
    expect(await at(table, 0, 'rank')).toBe('1');
    expect(await at(table, 0, 'best')).toBe('Notebook');
    // Share % divides by the sum over the rows the filter keeps.
    const sum = notebooks.reduce((acc, item) => acc + totalOf(item), 0);
    const top = Math.max(...notebooks.map(totalOf));
    expect(Number(await at(table, 0, 'share'))).toBeCloseTo((top / sum) * 100, 2);
    // Sorting is two-way here: a header click sorts.
    await header(table, 'share').click();
    await expect(header(table, 'share')).toHaveAttribute('aria-sort', 'ascending');
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: errors are values that explain themselves`, async ({ page }) => {
    await page.goto('features/formulas/');
    const example = await openFlavour(page, 'formulas/errors', flavour);
    const table = example.locator('argus-table');
    const error = (id: string) =>
      table.evaluate((el, col) => {
        const cell = el.shadowRoot?.querySelector(`[aria-rowindex="2"] > [data-col="${col}"]`);
        const found = cell
          ?.querySelector('slot')
          ?.assignedElements()[0]
          ?.querySelector('.argus-formula-error');
        return found ? [found.textContent, found.getAttribute('title')] : null;
      }, id);
    await expect.poll(() => error('per')).toEqual(['#DIV/0!', 'Division by zero.']);
    expect(await at(table, 0, 'safe')).toBe('–');
    expect(await at(table, 1, 'safe')).toBe('0.46');
    expect(await error('missing')).toEqual(['#REF!', 'There is no column [Weight].']);
    expect(await error('loop')).toEqual(['#CYCLE!', 'The formula depends on its own result.']);
    expect(await error('unknown')).toEqual(['#NAME?', 'There is no function TAX.']);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: functions of your own`, async ({ page }) => {
    await page.goto('features/formulas/');
    const example = await openFlavour(page, 'formulas/custom-functions', flavour);
    const table = example.locator('argus-table');
    await expect.poll(() => at(table, 2, 'net')).toBe('112');
    expect(await at(table, 2, 'vat')).toBe('21.28');
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: the editor proposes a column, and the app adds it`, async ({ page }) => {
    await page.goto('features/formulas/');
    const example = await openFlavour(page, 'formulas/editing', flavour);
    const table = example.locator('argus-table');
    await menuItem(table, 'gross', 'Add formula column…');
    const dialog = table.locator('dialog.argus-formula-editor[open]');
    // The editor loads on first use.
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await page.keyboard.type('Net');
    await page.keyboard.press('Tab');
    await page.keyboard.type('ROUND([Gr');
    await expect(dialog.locator('[role="option"][aria-selected="true"]')).toContainText('Gross');
    await page.keyboard.press('Enter');
    await page.keyboard.type(' / 1.19, 2)');
    await expect(dialog.locator('.argus-formula-preview tbody tr').first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Add column' }).click();
    await expect(header(table, 'net')).toBeVisible();
    await expect.poll(() => at(table, 1, 'net')).toBe('21.28');
    await expectAccessible(page, example);
  });
}
