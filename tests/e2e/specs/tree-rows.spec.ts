import { expect, test, type Page } from '@playwright/test';
import { focused, open, settle } from './helpers.js';

// The playground's `tree=10`: rows r0, r10, r20, … are top-level, each over the 9 rows
// after it; r1 (the first child) is the parent of r2–r4, so r2 is three levels deep.

/** The body row at an `aria-rowindex`: its tree attributes, its "#" text and its toggle. */
const rowAt = (page: Page, ariaRowIndex: number) =>
  page.evaluate((i) => {
    const row = document
      .querySelector('argus-table')
      ?.shadowRoot?.querySelector(`[part~="body"] > [aria-rowindex="${String(i)}"]`);
    if (!row) return null;
    const cell = row.querySelector('[data-col="index"]');
    const toggle = cell?.querySelector('[part~="tree-toggle"]');
    return {
      level: row.getAttribute('aria-level'),
      expanded: row.getAttribute('aria-expanded'),
      // The slotted light-DOM content: the row's data index.
      text: (cell?.querySelector('slot')?.assignedNodes() ?? [])
        .map((n) => n.textContent ?? '')
        .join('')
        .trim(),
      toggle: toggle ? { disabled: toggle.getAttribute('aria-disabled') } : null,
    };
  }, ariaRowIndex);

const treeExpanded = (page: Page) =>
  page.evaluate(() => [...(document.querySelector('argus-table')?.treeExpanded ?? [])]);

const toggleAt = (page: Page, ariaRowIndex: number) =>
  page.locator(
    `argus-table [part~="body"] > [aria-rowindex="${String(ariaRowIndex)}"] [part~="tree-toggle"]`,
  );

/** Presses a key and waits for the update and the focus that follows it. */
async function press(page: Page, key: string) {
  await page.keyboard.press(key);
  await settle(page);
}

test.describe('tree rows', () => {
  test('a toggle and the keys expand and collapse rows of a 1M-row tree', async ({ page }) => {
    await open(page, { rows: 1_000_000, tree: 10 });
    expect(await rowAt(page, 2)).toEqual({
      level: '1',
      expanded: 'false',
      text: '0',
      toggle: { disabled: null },
    });
    // Collapsed: the next row shown is the next top-level row.
    expect(await rowAt(page, 3)).toMatchObject({ level: '1', text: '10' });

    // A click on the toggle opens r0: its children follow it, one level deeper.
    await toggleAt(page, 2).click();
    await settle(page);
    expect(await treeExpanded(page)).toEqual(['r0']);
    expect(await rowAt(page, 2)).toMatchObject({ level: '1', expanded: 'true' });
    expect(await rowAt(page, 3)).toMatchObject({ level: '2', expanded: 'false', text: '1' });
    expect(await rowAt(page, 4)).toMatchObject({ level: '2', expanded: null, text: '5' });
    expect(await rowAt(page, 8)).toMatchObject({ level: '2', text: '9' });
    expect(await rowAt(page, 9)).toMatchObject({ level: '1', text: '10' });
    // Focus lands on the toggle's cell.
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'index', rowIndex: 2 });

    // ArrowRight on r1 opens it: r2–r4 at the third level.
    await press(page, 'ArrowDown');
    await press(page, 'ArrowRight');
    expect(await treeExpanded(page)).toEqual(['r0', 'r1']);
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'index', rowIndex: 3 });
    expect(await rowAt(page, 3)).toMatchObject({ level: '2', expanded: 'true', text: '1' });
    expect(await rowAt(page, 4)).toMatchObject({ level: '3', expanded: null, text: '2' });
    expect(await rowAt(page, 6)).toMatchObject({ level: '3', text: '4' });
    expect(await rowAt(page, 7)).toMatchObject({ level: '2', text: '5' });

    // Ctrl+End: the last of 100,000 top-level rows plus the 9 rows opened (6 + 3).
    await press(page, 'ControlOrMeta+End');
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'actions', rowIndex: 100_010 });
    expect(await rowAt(page, 100_010)).toMatchObject({
      level: '1',
      expanded: 'false',
      text: '999990',
    });

    // Back to r2, then ArrowLeft: to the parent, collapse it, to its parent, collapse that.
    await press(page, 'ControlOrMeta+Home');
    await press(page, 'ArrowDown');
    await press(page, 'ArrowDown');
    await press(page, 'ArrowDown');
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'index', rowIndex: 4 });
    await press(page, 'ArrowLeft');
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'index', rowIndex: 3 });
    expect(await treeExpanded(page)).toEqual(['r0', 'r1']);
    await press(page, 'ArrowLeft');
    expect(await treeExpanded(page)).toEqual(['r0']);
    expect(await rowAt(page, 3)).toMatchObject({ expanded: 'false', text: '1' });
    expect(await rowAt(page, 4)).toMatchObject({ level: '2', text: '5' });
    await press(page, 'ArrowLeft');
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'index', rowIndex: 2 });
    await press(page, 'ArrowLeft');
    expect(await treeExpanded(page)).toEqual([]);
    expect(await rowAt(page, 2)).toMatchObject({ expanded: 'false', text: '0' });
    expect(await rowAt(page, 3)).toMatchObject({ level: '1', text: '10' });
  });

  test('Ctrl+End reaches the last of 1M rows with every row expanded', async ({ page }) => {
    await open(page, { rows: 1_000_000, tree: 10, treeopen: '' });
    await page.keyboard.press('Tab');
    await press(page, 'ArrowDown');
    await press(page, 'ControlOrMeta+End');
    // Every row shows: the last one, r999999, is a child of r999990.
    expect(await focused(page)).toEqual({
      role: 'gridcell',
      col: 'actions',
      rowIndex: 1_000_001,
    });
    expect(await rowAt(page, 1_000_001)).toMatchObject({ level: '2', text: '999999' });
  });

  test('the quick filter shows a deep match with its ancestors open', async ({ page }) => {
    await open(page, { rows: 1_000_000, tree: 10 });
    const setQuickFilter = async (text: string) => {
      await page.evaluate((q) => {
        const table = document.querySelector('argus-table');
        if (table) table.quickFilter = q;
      }, text);
      await settle(page);
    };
    // Only r999992's "#" holds this text: it's under r999991, under r999990, all collapsed.
    await setQuickFilter('999992');
    const ancestor = { expanded: 'true', toggle: { disabled: 'true' } };
    expect(await rowAt(page, 2)).toEqual({ level: '1', text: '999990', ...ancestor });
    expect(await rowAt(page, 3)).toEqual({ level: '2', text: '999991', ...ancestor });
    expect(await rowAt(page, 4)).toEqual({
      level: '3',
      expanded: null,
      text: '999992',
      toggle: null,
    });
    expect(await rowAt(page, 5)).toBeNull();
    // The rows show open without changing treeExpanded, and their toggles do nothing.
    expect(await treeExpanded(page)).toEqual([]);
    // force: Playwright waits for an aria-disabled button to become enabled.
    await toggleAt(page, 2).click({ force: true });
    await settle(page);
    expect(await treeExpanded(page)).toEqual([]);
    expect(await rowAt(page, 4)).toMatchObject({ text: '999992' });

    // Cleared: back to the collapsed top-level rows.
    await setQuickFilter('');
    expect(await rowAt(page, 2)).toMatchObject({ expanded: 'false', text: '0' });
    expect(await rowAt(page, 3)).toMatchObject({ level: '1', text: '10' });
  });
});
