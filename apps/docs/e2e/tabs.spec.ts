import { expect, test } from '@playwright/test';
import { openFlavour } from './flavours';

test('the chosen flavour is kept across a reload', async ({ page }) => {
  await page.goto('features/sorting/');
  await openFlavour(page, 'sorting/basic', 'vue');
  await page.reload();
  const vue = page
    .locator('[data-example="sorting/basic"]')
    .first()
    .locator('xpath=ancestor::starlight-tabs[1]')
    .getByRole('tab', { name: 'Vue', exact: true });
  await expect(vue).toHaveAttribute('aria-selected', 'true');
});
