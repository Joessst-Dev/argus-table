import { expect, test, type Page } from '@playwright/test';
import { focused, headerOrder, open, settle } from './helpers.js';

const header = (page: Page, id: string) =>
  page.locator(`argus-table [role="columnheader"][data-col="${id}"]`);

async function center(page: Page, id: string): Promise<{ x: number; y: number }> {
  const box = await header(page, id).boundingBox();
  if (!box) throw new Error(`no header ${id}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses on a header, moves to `x` and releases there (unless `release` is false). */
async function drag(page: Page, id: string, x: number, release = true): Promise<void> {
  const from = await center(page, id);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + Math.sign(x - from.x) * 10, from.y, { steps: 2 });
  await page.mouse.move(x, from.y, { steps: 6 });
  await settle(page);
  if (release) {
    await page.mouse.up();
    await settle(page);
  }
}

test.describe('column reordering', () => {
  test('dragging a header moves the column and its cells, without sorting', async ({ page }) => {
    await open(page, { rows: 200, cols: 8 });
    expect(await headerOrder(page)).toEqual([
      'index',
      'name',
      'email',
      'city',
      'country',
      'status',
      'amount',
      'actions',
    ]);
    // Past the middle of Status: City lands between Status and Amount.
    await drag(page, 'city', (await center(page, 'status')).x + 10);
    expect(await headerOrder(page)).toEqual([
      'index',
      'name',
      'email',
      'country',
      'status',
      'city',
      'amount',
      'actions',
    ]);
    // City is sortable, but the click that ends a drag doesn't sort.
    await expect(header(page, 'city')).not.toHaveAttribute('aria-sort');
    // The body cells follow, with their content.
    const firstRow = page.locator('argus-table [part~="row"][aria-rowindex="2"]');
    await expect(firstRow.locator('[data-col="city"]')).toHaveAttribute('aria-colindex', '6');
    const cityBox = await header(page, 'city').boundingBox();
    const cellBox = await firstRow.locator('[data-col="city"]').boundingBox();
    expect(cellBox?.x).toBeCloseTo(cityBox?.x ?? 0, 0);
    // A plain click still sorts.
    await header(page, 'city').click();
    await expect(header(page, 'city')).toHaveAttribute('aria-sort', 'ascending');
  });

  test('shows a drop line while dragging, and Escape cancels', async ({ page }) => {
    await open(page, { rows: 200, cols: 8 });
    await drag(page, 'amount', (await center(page, 'email')).x - 10, false);
    await expect(header(page, 'amount')).toHaveAttribute('part', /header-cell-dragging/);
    await expect(header(page, 'email').locator('[part="drop-indicator"]')).toHaveAttribute(
      'data-edge',
      'start',
    );
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await settle(page);
    await expect(page.locator('argus-table [part="drop-indicator"]')).toHaveCount(0);
    expect((await headerOrder(page)).slice(2, 7)).toEqual([
      'email',
      'city',
      'country',
      'status',
      'amount',
    ]);
    await expect(header(page, 'amount')).not.toHaveAttribute('aria-sort');
  });

  test('columns stay in their pin group', async ({ page }) => {
    await open(page, { rows: 200, cols: 8 });
    // A scrolling column dropped over the pinned ones becomes the first scrolling column.
    await drag(page, 'country', (await center(page, 'index')).x);
    expect((await headerOrder(page)).slice(0, 4)).toEqual(['index', 'name', 'country', 'email']);
    // Pinned columns reorder among themselves.
    await drag(page, 'name', (await center(page, 'index')).x - 20);
    expect((await headerOrder(page)).slice(0, 3)).toEqual(['name', 'index', 'country']);
    // The sticky offsets follow: Index now sits right after Name.
    const name = await header(page, 'name').boundingBox();
    const index = await header(page, 'index').boundingBox();
    expect(index?.x).toBeCloseTo((name?.x ?? 0) + (name?.width ?? 0), 0);
  });

  test('scrolls while a column is dragged to the edge of a wide table', async ({ page }) => {
    await open(page, { rows: 200, cols: 20 });
    const box = await page
      .locator('argus-table')
      .evaluate((el) => el.shadowRoot?.querySelector('[part~="table"]')?.getBoundingClientRect());
    if (!box) throw new Error('no scroller');
    // Hold the pointer just inside the scrolling area's end edge (before the pinned actions column).
    await drag(page, 'email', box.right - 100, false);
    const scrolled = () =>
      page
        .locator('argus-table')
        .evaluate(
          (el) => el.shadowRoot?.querySelector<HTMLElement>('[part~="table"]')?.scrollLeft ?? 0,
        );
    await expect.poll(scrolled).toBeGreaterThan(300);
    await page.mouse.up();
    await settle(page);
    const after = await headerOrder(page);
    expect(after.indexOf('email')).toBeGreaterThan(6);
    expect(after.at(-1)).toBe('actions');
  });

  test('Alt+Shift+Arrow moves the focused header and keeps focus on it', async ({ page }) => {
    await open(page, { rows: 200, cols: 8 });
    await header(page, 'email').focus();
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await settle(page);
    expect((await headerOrder(page)).slice(2, 5)).toEqual(['city', 'country', 'email']);
    expect(await focused(page)).toEqual({ role: 'columnheader', col: 'email', rowIndex: 1 });
    // The live region tells screen readers where it went.
    await expect(page.locator('[data-argus-announcer]')).toHaveText('Email moved to column 5 of 8');
    // Arrows keep moving focus as before.
    await page.keyboard.press('ArrowRight');
    expect(await focused(page)).toEqual({ role: 'columnheader', col: 'status', rowIndex: 1 });
  });

  test('in RTL, dragging toward the inline end (left) moves the column later', async ({ page }) => {
    await open(page, { rows: 200, cols: 8, dir: 'rtl' });
    // In RTL, Status is left of Country; dropping past its middle puts Email after it.
    await drag(page, 'email', (await center(page, 'status')).x - 10);
    expect((await headerOrder(page)).slice(2, 7)).toEqual([
      'city',
      'country',
      'status',
      'email',
      'amount',
    ]);
    await header(page, 'email').focus();
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await settle(page);
    expect((await headerOrder(page)).slice(2, 7)).toEqual([
      'city',
      'country',
      'email',
      'status',
      'amount',
    ]);
  });
});
