import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers.js';

// The playground's production build minifies the theme with Lightning CSS
// (Vite 8's default), which polyfills light-dark(): the same thing happens in
// a user's build. The automatic scheme (no data-argus-theme) must keep the
// theme's colours.

/** The computed header-cell background and border of the first column. */
async function headerStyle(page: Page): Promise<{ background: string; border: string }> {
  return page.evaluate(() => {
    const cell = document
      .querySelector('argus-table')
      ?.shadowRoot?.querySelector('[part~="header-cell"]');
    if (!cell) throw new Error('no header cell');
    const style = getComputedStyle(cell);
    return { background: style.backgroundColor, border: style.borderBlockEndStyle };
  });
}

for (const theme of ['default', 'material']) {
  test.describe(`${theme} theme in the automatic colour scheme`, () => {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`header is opaque and bordered (${colorScheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await open(page, { theme, rows: 200, cols: 8 });
        const { background, border } = await headerStyle(page);
        expect(background).not.toBe('rgba(0, 0, 0, 0)');
        expect(border).toBe('solid');
      });
    }

    test('header follows the system scheme', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await open(page, { theme, rows: 200, cols: 8 });
      const light = await headerStyle(page);
      await page.emulateMedia({ colorScheme: 'dark' });
      await expect
        .poll(async () => (await headerStyle(page)).background)
        .not.toBe(light.background);
    });
  });
}

test('material theme rounds and outlines the table, with taller rows', async ({ page }) => {
  await open(page, { theme: 'material', rows: 200, cols: 8 });
  const style = await page.evaluate(() => {
    const table = document.querySelector('argus-table');
    const row = table?.shadowRoot?.querySelector('[part~="row"]');
    if (!table || !row) throw new Error('no table');
    const host = getComputedStyle(table);
    return {
      radius: host.borderTopLeftRadius,
      outline: host.borderTopStyle,
      rowHeight: row.getBoundingClientRect().height,
    };
  });
  expect(style).toEqual({ radius: '12px', outline: 'solid', rowHeight: 52 });
});
