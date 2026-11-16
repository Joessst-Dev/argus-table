import { expect, test } from '@playwright/test';
import { expectAccessible, FLAVOURS, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: pinned columns keeps them in place while the rest scroll`, async ({ page }) => {
    await page.goto('features/pinned-columns/');
    const example = await openFlavour(page, 'pinned-columns/basic', flavour);
    const table = example.locator('argus-table');
    const row = table.locator('[part~="row"]').first();
    await expect(row.locator('[part~="cell-pinned"]')).toHaveCount(3);
    await expect(row.locator('[part~="cell-pinned-edge"]')).toHaveCount(2);
    const pinned = row.locator('[data-col="name"]');
    const before = await pinned.boundingBox();
    const moving = row.locator('[data-col="m1"]');
    const movingBefore = await moving.boundingBox();
    await table.evaluate((el) => {
      el.shadowRoot?.querySelector('[part~="table"]')?.scrollBy({ left: 400 });
    });
    await expect.poll(async () => (await moving.boundingBox())?.x).not.toBe(movingBefore?.x);
    expect((await pinned.boundingBox())?.x).toBe(before?.x);
    await expectAccessible(page, example);
  });
}
