import { expect, test, type Locator } from '@playwright/test';
import { expectAccessible, FLAVOURS, openFlavour } from './flavours';

const header = (table: Locator, id: string) =>
  table.locator(`[role="columnheader"][data-col="${id}"]`);
const width = (cell: Locator) => cell.evaluate((el) => (el as HTMLElement).offsetWidth);

for (const flavour of FLAVOURS) {
  test(`${flavour}: resizing resizes within the column’s bounds`, async ({ page }) => {
    await page.goto('features/resizing/');
    const example = await openFlavour(page, 'resizing/basic', flavour);
    const table = example.locator('argus-table');
    // `resizable: false` on # leaves three handles.
    await expect(table.locator('[part~="resize-handle"]')).toHaveCount(3);
    const owner = header(table, 'owner');
    await owner.focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect.poll(() => width(owner)).toBe(130);
    for (let i = 0; i < 15; i++) await page.keyboard.press('Alt+ArrowRight');
    // maxWidth 240.
    await expect.poll(() => width(owner)).toBe(240);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: controlled resizing keeps the widths across a reload`, async ({ page }) => {
    await page.goto('features/resizing/');
    let example = await openFlavour(page, 'resizing/controlled', flavour);
    let owner = header(example.locator('argus-table'), 'owner');
    const before = await width(owner);
    await owner.focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect.poll(() => width(owner)).toBe(before + 10);
    await expect(example.locator('output')).toContainText(`"owner":${String(before + 10)}`);
    await page.reload();
    example = await openFlavour(page, 'resizing/controlled', flavour);
    owner = header(example.locator('argus-table'), 'owner');
    await expect.poll(() => width(owner)).toBe(before + 10);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: stretched columns fill the table's width`, async ({ page }) => {
    await page.goto('features/resizing/');
    const example = await openFlavour(page, 'resizing/stretch', flavour);
    const table = example.locator('argus-table');
    const fill = () =>
      table.evaluate((el) => {
        const scroller = el.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
        const cells = [
          ...(el.shadowRoot?.querySelectorAll<HTMLElement>('[role="columnheader"][data-col]') ??
            []),
        ];
        const total = cells.reduce((sum, cell) => sum + cell.getBoundingClientRect().width, 0);
        return {
          gap: Math.abs((scroller?.clientWidth ?? 0) - total),
          scrolls: (scroller?.scrollWidth ?? 0) > (scroller?.clientWidth ?? 0),
        };
      });
    await expect.poll(async () => (await fill()).gap).toBeLessThanOrEqual(2);
    expect((await fill()).scrolls).toBe(false);
    // # keeps its maxWidth.
    await expect.poll(() => width(header(table, 'id'))).toBe(70);
    await expectAccessible(page, example);
  });
}
