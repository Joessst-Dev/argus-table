import { expect, test } from '@playwright/test';
import { expectAccessible, FLAVOURS, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: density renders compact, comfortable and spacious rows`, async ({ page }) => {
    await page.goto('features/density/');
    const example = await openFlavour(page, 'density/all', flavour);
    const heights = () =>
      example
        .locator('argus-table')
        .evaluateAll((tables) =>
          tables.map(
            (t) => t.shadowRoot?.querySelector<HTMLElement>('[part~="row"]')?.offsetHeight,
          ),
        );
    await expect.poll(heights).toEqual([32, 40, 52]);
    await expectAccessible(page, example);
  });
}
