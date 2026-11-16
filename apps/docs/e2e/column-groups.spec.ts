import { expect, test, type Locator } from '@playwright/test';
import { expectAccessible, FLAVOURS, headerOrder, openFlavour } from './flavours';

const group = (table: Locator, key: string) => table.locator(`[data-group-key="${key}"]`);
const focusKey = (table: Locator) =>
  table.evaluate((el) => {
    const active = el.shadowRoot?.activeElement as HTMLElement | null | undefined;
    return active?.dataset.groupKey ?? active?.dataset.col;
  });

for (const flavour of FLAVOURS) {
  test(`${flavour}: groups span their columns, move together and take the keyboard`, async ({
    page,
  }) => {
    await page.goto('features/column-groups/');
    const example = await openFlavour(page, 'column-groups/basic', flavour);
    const table = example.locator('argus-table');
    await expect(group(table, 'g:center:who')).toHaveAttribute('aria-colspan', '2');
    // ArrowUp from a column header goes to its group; Right to the next; Down to its first column.
    await table.locator('[role="columnheader"][data-col="city"]').focus();
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => focusKey(table)).toBe('g:center:who');
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => focusKey(table)).toBe('g:center:state');
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => focusKey(table)).toBe('status');
    // Alt+Shift+Arrow on a group moves the whole group.
    await group(table, 'g:center:state').focus();
    await page.keyboard.press('Alt+Shift+ArrowLeft');
    await expect
      .poll(() => headerOrder(table))
      .toEqual(['id', 'status', 'total', 'customer', 'city']);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: nested groups add a header row each`, async ({ page }) => {
    await page.goto('features/column-groups/');
    const example = await openFlavour(page, 'column-groups/nested', flavour);
    const table = example.locator('argus-table');
    await expect(table.locator('[part~="header-group-row"]')).toHaveCount(2);
    await expect(table.locator('[part~="header-row"]')).toHaveAttribute('aria-rowindex', '3');
    // Shipping sits over City alone.
    await expect(group(table, 'g:center:shipping')).toHaveAttribute('aria-colspan', '1');
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: group children with a custom header`, async ({ page }) => {
    await page.goto('features/column-groups/');
    const example = await openFlavour(page, 'column-groups/declarative', flavour);
    const table = example.locator('argus-table');
    // The group's own header content, slotted into its cell.
    await expect
      .poll(() =>
        group(table, 'g:center:who').evaluate((cell) => {
          const content = cell.querySelector('slot')?.assignedElements({ flatten: true })[0];
          return content?.querySelector('strong')?.textContent.trim();
        }),
      )
      .toBe('Who');
    await expect.poll(() => headerOrder(table)).toEqual(['id', 'customer', 'city', 'total']);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: a group across pinned and scrolling columns shows on each side`, async ({
    page,
  }) => {
    await page.goto('features/column-groups/');
    const example = await openFlavour(page, 'column-groups/pinned-split', flavour);
    const table = example.locator('argus-table');
    await expect(group(table, 'g:start:ids')).toHaveAttribute('data-pin', 'start');
    await expect(group(table, 'g:center:ids')).toHaveAttribute('aria-colspan', '1');
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: a group resizes its columns, and a fixed group stays`, async ({ page }) => {
    await page.goto('features/column-groups/');
    const example = await openFlavour(page, 'column-groups/resize', flavour);
    const table = example.locator('argus-table');
    await group(table, 'g:center:state').focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(example.locator('output')).toHaveText(
      /"status":\d+.*"total":\d+|"total":\d+.*"status":\d+/,
    );
    // "Who" has reorderable: false: it stays, while its columns still move within it.
    await group(table, 'g:center:who').focus();
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await table.locator('[role="columnheader"][data-col="customer"]').focus();
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await expect
      .poll(() => headerOrder(table))
      .toEqual(['id', 'city', 'customer', 'status', 'total']);
    await expectAccessible(page, example);
  });
}
