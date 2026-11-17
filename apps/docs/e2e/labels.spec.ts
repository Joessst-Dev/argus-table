import { expect, test } from '@playwright/test';
import { bodyCell, cellText, expectAccessible, FLAVOURS, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: the table and its add-ons speak German`, async ({ page }) => {
    await page.goto('features/labels/');
    const example = await openFlavour(page, 'labels/german', flavour);
    const table = example.locator('argus-table');
    const header = (id: string) => table.locator(`[role="columnheader"][data-col="${id}"]`);
    await expect(table.locator('[part~="header-cell"] input').first()).toHaveAttribute(
      'aria-label',
      'Alle Zeilen auswählen',
    );
    await expect(header('customer').locator('[part~="resize-handle"]')).toHaveAttribute(
      'aria-label',
      'Spaltenbreite ändern',
    );

    // The editing add-on.
    await bodyCell(table, 0, 'customer').focus();
    await page.keyboard.press('Enter');
    await expect(table.locator('.argus-edit-input')).toHaveAttribute(
      'aria-label',
      'Kunde, Zeile 1',
    );
    // The example applies edits: the new value stays.
    await table.locator('.argus-edit-input').fill('Ada Lovelace');
    await page.keyboard.press('Enter');
    await expect.poll(() => cellText(table, 2, 'customer')).toBe('Ada Lovelace');

    // The column menu, with the export and formula items.
    const button = await header('total').evaluateHandle((cell) =>
      cell
        .querySelector('slot')
        ?.assignedElements({ flatten: true })[0]
        ?.querySelector('.argus-header-menu-button'),
    );
    const element = button.asElement();
    if (!element) throw new Error('no menu button');
    expect(await element.getAttribute('aria-label')).toBe('Spaltenmenü');
    await element.click();
    const menu = table.locator('.argus-header-menu:popover-open');
    await expect(menu).toContainText('Exportieren');
    for (const name of [
      'Absteigend sortieren',
      'Filtern…',
      'Rechts fixieren',
      'Spalte ausblenden',
      'Formelspalte hinzufügen…',
      'Excel (.xlsx)',
    ]) {
      await expect(menu.locator('[role^="menuitem"]', { hasText: name }).first()).toBeAttached();
    }
    await menu.locator('[role^="menuitem"]', { hasText: 'Absteigend sortieren' }).click();
    await expect(header('total')).toHaveAttribute('aria-sort', 'descending');
    await expectAccessible(page, example);
  });
}
