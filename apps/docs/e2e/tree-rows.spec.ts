import { expect, test, type Locator } from '@playwright/test';
import { bodyRows, cellText, expectAccessible, FLAVOURS, openFlavour } from './flavours';

/** The body row at an `aria-rowindex` (the header is 1). */
const rowAt = (table: Locator, ariaRowIndex: number) =>
  table.locator(`[part~="body"] > [aria-rowindex="${String(ariaRowIndex)}"]`);

for (const flavour of FLAVOURS) {
  test(`${flavour}: a file tree expands, collapses and sorts within folders`, async ({ page }) => {
    await page.goto('features/tree-rows/');
    const example = await openFlavour(page, 'tree-rows/file-tree', flavour);
    const table = example.locator('argus-table');
    await expect(table).toHaveAttribute('role', 'treegrid');
    // src is open: its entries follow it, a level deeper.
    await expect(rowAt(table, 2)).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => cellText(table, 3, 'name')).toBe('components');
    await expect(rowAt(table, 3)).toHaveAttribute('aria-level', '2');

    // public's toggle opens it.
    await expect.poll(() => cellText(table, 7, 'name')).toBe('public');
    await rowAt(table, 7).locator('[part~="tree-toggle"]').click();
    await expect(rowAt(table, 7)).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => cellText(table, 8, 'name')).toBe('favicon.svg');
    // ArrowLeft on its name cell closes it again; ArrowDown, ArrowRight open docs.
    await rowAt(table, 7).locator('[data-col="name"]').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(rowAt(table, 7)).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await expect(rowAt(table, 8)).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => cellText(table, 9, 'name')).toBe('guide.md');

    // By size: the top-level rows sort, and each folder's entries sort under it.
    await table.locator('[role="columnheader"][data-col="size"]').click();
    await expect.poll(() => cellText(table, 2, 'name')).toBe('tsconfig.json');
    await expect.poll(() => cellText(table, 5, 'name')).toBe('docs');
    await expect.poll(() => cellText(table, 6, 'name')).toBe('changelog.md');
    await expect(rowAt(table, 6)).toHaveAttribute('aria-level', '2');
    await expect.poll(() => cellText(table, 8, 'name')).toBe('src');
    await expect.poll(() => cellText(table, 9, 'name')).toBe('main.ts');

    // The app's buttons set treeExpanded.
    await example.getByRole('button', { name: 'Collapse all' }).click();
    await expect.poll(async () => (await bodyRows(table)).length).toBe(6);
    await example.getByRole('button', { name: 'Expand all' }).click();
    await expect.poll(async () => (await bodyRows(table)).length).toBeGreaterThan(6);
    await expect(table.locator('[part~="body"] > [aria-expanded="false"]')).toHaveCount(0);
    await expectAccessible(page, example);
  });

  test(`${flavour}: an org chart selects branches and filters with managers kept`, async ({
    page,
  }) => {
    await page.goto('features/tree-rows/');
    const example = await openFlavour(page, 'tree-rows/org-chart', flavour);
    const table = example.locator('argus-table');
    const output = example.locator('output');
    const box = (ariaRowIndex: number) =>
      rowAt(table, ariaRowIndex).locator('[data-col="--argus-selection"] input');
    // The chief executive is open: the four heads of team under her.
    await expect.poll(() => cellText(table, 5, 'name')).toBe('Hana Tanaka');
    await expect(rowAt(table, 5)).toHaveAttribute('aria-level', '2');

    // Ticking the head of Design ticks her two leads and their six designers.
    await box(5).click();
    await expect(output).toHaveText('9 people selected');
    await expect(box(5)).toBeChecked();
    await expect
      .poll(() => box(2).evaluate((el) => (el as HTMLInputElement).indeterminate))
      .toBe(true);

    // The designers show in their place, under their managers, opened for them.
    await example.getByRole('searchbox', { name: 'Search people' }).fill('designer');
    await expect.poll(async () => (await bodyRows(table)).length).toBe(10);
    await expect.poll(() => cellText(table, 3, 'name')).toBe('Hana Tanaka');
    await expect(rowAt(table, 3)).toHaveAttribute('aria-expanded', 'true');
    await expect(rowAt(table, 2).locator('[part~="tree-toggle"]')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect.poll(() => cellText(table, 5, 'title')).toBe('Designer');
    await expect(rowAt(table, 5)).toHaveAttribute('aria-level', '4');
    await expect(output).toHaveText('9 people selected');
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: a lazy tree loads a folder's entries when it expands`, async ({ page }) => {
    await page.goto('features/tree-rows/');
    const example = await openFlavour(page, 'tree-rows/lazy-tree', flavour);
    const table = example.locator('argus-table');
    await expect(table).toHaveAttribute('role', 'treegrid');
    await expect.poll(() => cellText(table, 2, 'name'), { timeout: 5000 }).toBe('Project 001');
    await expect(rowAt(table, 2)).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => cellText(table, 3, 'name')).toBe('Project 002');

    // Its toggle opens Project 001: its entries load in its place, a level deeper.
    await rowAt(table, 2).locator('[part~="tree-toggle"]').click();
    await expect(rowAt(table, 2)).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => cellText(table, 3, 'name'), { timeout: 5000 }).toBe('src');
    await expect(rowAt(table, 3)).toHaveAttribute('aria-level', '2');
    await expect.poll(() => cellText(table, 7, 'name')).toBe('Project 002');

    // ArrowRight on src's name cell opens it: its entries load at the third level.
    await rowAt(table, 3).locator('[data-col="name"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(rowAt(table, 3)).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => cellText(table, 4, 'name'), { timeout: 5000 }).toBe('components');
    await expect(rowAt(table, 4)).toHaveAttribute('aria-level', '3');

    // Sorting by Name: the open folders load their entries again, in the new order.
    await table.locator('[role="columnheader"][data-col="name"]').click();
    await expect.poll(() => cellText(table, 3, 'name'), { timeout: 5000 }).toBe('docs');
    await expect.poll(() => cellText(table, 5, 'name')).toBe('README.md');
    await expect.poll(() => cellText(table, 6, 'name'), { timeout: 5000 }).toBe('src');
    await expect(rowAt(table, 6)).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => cellText(table, 7, 'name'), { timeout: 5000 }).toBe('components');
    await expect(rowAt(table, 7)).toHaveAttribute('aria-level', '3');
    await expectAccessible(page, example);
  });
}
