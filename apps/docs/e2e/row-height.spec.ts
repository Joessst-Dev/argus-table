import { expect, test } from '@playwright/test';
import { expectAccessible, FLAVOURS, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: wrapped text wraps within a fixed row height`, async ({ page }) => {
    await page.goto('features/row-height/');
    const example = await openFlavour(page, 'row-height/wrapped-text', flavour);
    const row = example.locator('argus-table [part~="row"]').first();
    expect(await row.evaluate((el) => (el as HTMLElement).offsetHeight)).toBe(56);
    await expect(row.locator('[data-col="note"]')).toHaveAttribute('data-wrap');
    // The second order's note is long: it takes more than one line.
    const lines = await example.locator('argus-table').evaluate((el) => {
      const cell = el.shadowRoot?.querySelector('[aria-rowindex="3"] [data-col="note"]');
      const content = cell?.querySelector('slot')?.assignedElements()[0] as HTMLElement | undefined;
      if (!content) return 0;
      const style = getComputedStyle(content);
      // `normal` line height: about 1.2 times the font size.
      const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
      return content.scrollHeight / line;
    });
    expect(lines).toBeGreaterThan(1.5);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: auto row height fits each row to its content`, async ({ page }) => {
    await page.goto('features/row-height/');
    const example = await openFlavour(page, 'row-height/auto', flavour);
    const table = example.locator('argus-table');
    const layout = () =>
      table.evaluate((el) => {
        const root = el.shadowRoot;
        const rows = [
          ...(root?.querySelectorAll<HTMLElement>('[part~="body"] > [part~="row"]') ?? []),
        ]
          .map((row) => ({
            index: Number(row.getAttribute('aria-rowindex')),
            box: row.getBoundingClientRect(),
          }))
          .sort((a, b) => a.index - b.index)
          .slice(0, 6);
        const header = root?.querySelector<HTMLElement>('[part~="header"]')?.offsetHeight ?? 0;
        return {
          heights: rows.map((r) => Math.round(r.box.height)),
          gaps: rows.slice(1).map((r, i) => Math.abs(r.box.top - (rows[i]?.box.bottom ?? 0))),
          header,
        };
      });
    await expect.poll(async () => new Set((await layout()).heights).size).toBeGreaterThan(1);
    const { heights, gaps, header } = await layout();
    for (const gap of gaps) expect(gap).toBeLessThanOrEqual(1);
    expect(header).toBeLessThanOrEqual(Math.min(...heights));
    await expectAccessible(page, example);
  });
}
