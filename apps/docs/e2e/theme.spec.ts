import { expect, test, type Locator } from '@playwright/test';
import { openFlavour } from './flavours';

/** The relative luminance (0 dark … 1 light) of an element's background. */
async function lightness(element: Locator): Promise<number> {
  const color = await element.evaluate((el) => getComputedStyle(el).backgroundColor);
  const [r = 0, g = 0, b = 0] = (color.match(/[\d.]+/g) ?? []).map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

test('the tables follow the site’s light and dark theme', async ({ page }) => {
  await page.goto('features/sorting/');
  const example = await openFlavour(page, 'sorting/basic', 'react');
  // The host paints --argus-bg (the theme's background).
  const table = example.locator('argus-table');
  const select = page.locator('starlight-theme-select select').first();
  await select.selectOption('dark');
  await expect.poll(() => lightness(table)).toBeLessThan(0.3);
  await select.selectOption('light');
  await expect.poll(() => lightness(table)).toBeGreaterThan(0.8);
});
