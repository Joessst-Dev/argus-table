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

    // The controls: start is the right side in RTL, and the select sets the token.
    await example.getByRole('checkbox', { name: 'Right to left' }).check();
    await expect
      .poll(async () => {
        const [name, month] = [await pinned.boundingBox(), await moving.boundingBox()];
        return (name?.x ?? 0) > (month?.x ?? 0);
      })
      .toBe(true);
    const shadow = () =>
      table.evaluate((el) => getComputedStyle(el).getPropertyValue('--argus-pinned-shadow').trim());
    await example.getByRole('combobox', { name: 'Edge shadow' }).selectOption('None');
    await expect.poll(shadow).toBe('none');
    await example.getByRole('combobox', { name: 'Edge shadow' }).selectOption('Strong');
    await expect.poll(shadow).toContain('rgb');
    await expectAccessible(page, example);
  });
}
