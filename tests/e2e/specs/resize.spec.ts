import { expect, test, type Page } from '@playwright/test';
import { open, settle } from './helpers.js';

const header = (page: Page) => page.locator('argus-table [role="columnheader"][data-col="city"]');
const width = async (page: Page) => (await header(page).boundingBox())?.width ?? 0;

async function drag(page: Page, dx: number): Promise<void> {
  const box = await header(page).locator('[part~="resize-handle"]').boundingBox();
  if (!box) throw new Error('no resize handle');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 4 });
  await page.mouse.move(x + dx, y, { steps: 4 });
  await page.mouse.up();
  await settle(page);
}

test.describe('resizing', () => {
  test('dragging the handle widens and narrows the column', async ({ page }) => {
    await open(page, { rows: 200, cols: 8 });
    const before = await width(page);
    await drag(page, 60);
    expect(await width(page)).toBeCloseTo(before + 60, 0);
    await drag(page, -40);
    expect(await width(page)).toBeCloseTo(before + 20, 0);
    // A drag never sorts, even though City is sortable.
    await expect(header(page)).not.toHaveAttribute('aria-sort');
  });

  test('Alt+Arrow on the focused header resizes by 10 px', async ({ page }) => {
    await open(page, { rows: 200, cols: 8 });
    const before = await width(page);
    await header(page).focus();
    await page.keyboard.press('Alt+ArrowRight');
    await page.keyboard.press('Alt+ArrowRight');
    await settle(page);
    expect(await width(page)).toBeCloseTo(before + 20, 0);
    await page.keyboard.press('Alt+ArrowLeft');
    await settle(page);
    expect(await width(page)).toBeCloseTo(before + 10, 0);
  });

  test('a double-click on the handle fits the column to its content', async ({ page }) => {
    await open(page, { rows: 200, cols: 8 });
    await drag(page, -200);
    const handle = header(page).locator('[part~="resize-handle"]');
    await handle.dblclick();
    await settle(page);
    const fit = await page.evaluate(() => {
      const root = document.querySelector('argus-table')?.shadowRoot;
      const cells = [...(root?.querySelectorAll('[data-col="city"]') ?? [])];
      const cut = cells.filter((cell) => {
        const content = cell.querySelector('slot')?.assignedElements()[0];
        return content && content.scrollWidth > content.clientWidth;
      });
      return { cells: cells.length, cut: cut.length };
    });
    expect(fit.cells).toBeGreaterThan(1);
    expect(fit.cut).toBe(0);
    // A double-click never sorts.
    await expect(header(page)).not.toHaveAttribute('aria-sort');
  });

  test('in RTL, dragging toward the inline end (left) widens the column', async ({ page }) => {
    await open(page, { rows: 200, cols: 8, dir: 'rtl' });
    const before = await width(page);
    await drag(page, -50);
    expect(await width(page)).toBeCloseTo(before + 50, 0);
  });
});
