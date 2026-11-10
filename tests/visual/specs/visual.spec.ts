// Types only: brings in the 'argus-table' entry of HTMLElementTagNameMap.
import type {} from 'argus-table';
import { expect, test, type Page } from '@playwright/test';

/** Opens the playground and waits until the table and the theme have rendered. */
async function open(page: Page, query: Record<string, string>): Promise<void> {
  await page.goto(`/?${new URLSearchParams({ rows: '40', cols: '8', ...query }).toString()}`);
  await page.locator('argus-table [part~="row"]').first().waitFor();
  // Leave a strip below the table and park the mouse there, so no header or
  // row shows its hover state.
  await page.addStyleTag({ content: 'argus-table { block-size: 360px; }' });
  await page.mouse.move(8, 410);
  await page.evaluate(async () => {
    await document.querySelector('argus-table')?.updateComplete;
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

for (const theme of ['default', 'material', 'fluent', 'bootstrap']) {
  for (const density of ['compact', 'comfortable', 'spacious']) {
    for (const scheme of ['light', 'dark']) {
      test(`${theme} theme, ${density}, ${scheme}`, async ({ page }) => {
        await open(page, { theme, density, scheme });
        await expect(page).toHaveScreenshot(`${theme}-${density}-${scheme}.png`);
      });
    }
  }
}

// No data-argus-theme: the theme follows the system scheme. Scrolled, so rows
// sit under the sticky header.
for (const colorScheme of ['light', 'dark'] as const) {
  test(`default theme, automatic scheme, ${colorScheme}, scrolled`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await open(page, { theme: 'default' });
    await page.evaluate(async () => {
      const table = document.querySelector('argus-table');
      const scroller = table?.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
      if (scroller) scroller.scrollTop = 100;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await table?.updateComplete;
    });
    await expect(page).toHaveScreenshot(`default-auto-${colorScheme}.png`);
  });
}

for (const theme of ['default', 'material', 'fluent', 'bootstrap']) {
  test(`${theme} theme, RTL, pinned and scrolled sideways`, async ({ page }) => {
    await open(page, { theme, scheme: 'light', dir: 'rtl', cols: '14' });
    await page.evaluate(async () => {
      const table = document.querySelector('argus-table');
      const scroller = table?.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
      if (scroller) scroller.scrollLeft = -400;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await table?.updateComplete;
    });
    await expect(page).toHaveScreenshot(`${theme}-rtl-pinned.png`);
  });
}

test('no theme (base styles), light', async ({ page }) => {
  await open(page, { scheme: 'light' });
  await expect(page).toHaveScreenshot('base-light.png');
});
