import { expect, test, type Locator, type Page } from '@playwright/test';
import { bodyRows, expectAccessible, FLAVOURS, headerOrder, openFlavour } from './flavours';

const header = (table: Locator, id: string) =>
  table.locator(`[role="columnheader"][data-col="${id}"]`);

/** Opens a column's menu from its button and returns the open menu. */
async function openMenu(table: Locator, id: string): Promise<Locator> {
  // The button is in the header's content, slotted in from the light DOM.
  const button = await header(table, id).evaluateHandle((cell) =>
    cell
      .querySelector('slot')
      ?.assignedElements({ flatten: true })[0]
      ?.querySelector('.argus-header-menu-button'),
  );
  const element = button.asElement();
  if (!element) throw new Error(`no menu button in ${id}`);
  await element.click();
  const menu = table.locator('.argus-header-menu:popover-open');
  await expect(menu).toBeVisible();
  return menu;
}

const item = (menu: Locator, name: string) =>
  menu
    .getByRole('menuitem', { name, exact: true })
    .or(menu.getByRole('menuitemradio', { name, exact: true }));

const focusedHeader = (table: Locator) =>
  table.evaluate((el) => (el.shadowRoot?.activeElement as HTMLElement | null)?.dataset.col);

async function check(page: Page, example: Locator) {
  await expectAccessible(page, example);
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: the menu sorts, pins and hides`, async ({ page }) => {
    await page.goto('features/header-menu/');
    const example = await openFlavour(page, 'header-menu/basic', flavour);
    const table = example.locator('argus-table');
    const start = await headerOrder(table);
    // Opening the menu doesn't sort.
    let menu = await openMenu(table, 'total');
    await expect(header(table, 'total')).not.toHaveAttribute('aria-sort', /ascending|descending/);
    await item(menu, 'Sort descending').click();
    await expect(header(table, 'total')).toHaveAttribute('aria-sort', 'descending');
    await expect.poll(() => focusedHeader(table)).toBe('total');
    await expect(table.locator('.argus-header-menu')).toHaveCount(0);
    // From the keyboard: Alt+ArrowDown opens it again, Home and Enter run the first item.
    await header(table, 'customer').focus();
    await page.keyboard.press('Alt+ArrowDown');
    menu = table.locator('.argus-header-menu:popover-open');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await expect(header(table, 'customer')).toHaveAttribute('aria-sort', 'ascending');
    // Pin, hide, show, unpin.
    await item(await openMenu(table, 'customer'), 'Pin to start').click();
    await expect(header(table, 'customer')).toHaveAttribute('part', /\bheader-cell-pinned\b/);
    await item(await openMenu(table, 'customer'), 'Hide column').click();
    await expect.poll(() => headerOrder(table)).not.toContain('customer');
    await item(await openMenu(table, 'city'), 'Show Customer').click();
    await item(await openMenu(table, 'customer'), "Don't pin").click();
    await expect.poll(() => headerOrder(table)).toEqual(start);
    await check(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: with sorting controlled, the menu only proposes`, async ({ page }) => {
    await page.goto('features/header-menu/');
    const example = await openFlavour(page, 'header-menu/controlled-sorting', flavour);
    const table = example.locator('argus-table');
    await item(await openMenu(table, 'total'), 'Sort descending').click();
    await expect(example.locator('output')).toHaveText('Proposed: [{"id":"total","desc":true}]');
    await expect(header(table, 'total')).not.toHaveAttribute('aria-sort', /ascending|descending/);
    await check(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: a framework-content header keeps its name in the menu`, async ({ page }) => {
    await page.goto('features/header-menu/');
    const example = await openFlavour(page, 'header-menu/template-headers', flavour);
    const table = example.locator('argus-table');
    await expect(table.locator('small', { hasText: '(name)' })).toBeVisible();
    await item(await openMenu(table, 'customer'), 'Hide column').click();
    await expect.poll(() => headerOrder(table)).not.toContain('customer');
    await item(await openMenu(table, 'city'), 'Show Customer').click();
    await expect.poll(() => headerOrder(table)).toContain('customer');
    await check(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: the filter form filters a column`, async ({ page }) => {
    await page.goto('features/header-menu/');
    const example = await openFlavour(page, 'header-menu/filter', flavour);
    const table = example.locator('argus-table');
    await item(await openMenu(table, 'city'), 'Filter…').click();
    const form = table.locator('.argus-header-filter:popover-open');
    await expect(form).toBeVisible();
    // Only Oslo: untick all, then tick it.
    await form.locator('.argus-header-filter-all input').click();
    await form.locator('.argus-header-filter-values label', { hasText: 'Oslo' }).click();
    await expect
      .poll(async () => {
        const rows = await bodyRows(table);
        return rows.length > 0 && rows.every((r) => r.city === 'Oslo');
      })
      .toBe(true);
    await page.keyboard.press('Escape');
    await expect(header(table, 'city')).toHaveAttribute('part', /\bheader-cell-filtered\b/);
    await item(await openMenu(table, 'city'), 'Clear filter').click();
    await expect.poll(async () => new Set((await bodyRows(table)).map((r) => r.city)).size).toBe(5);
    await check(page, example);
  });
}
