import { expect, test } from '@playwright/test';
import { openFlavour } from './flavours';

test('the chosen flavour is kept across a reload', async ({ page }) => {
  await page.goto('features/sorting/');
  await openFlavour(page, 'sorting/basic', 'vue');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Vue', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
