import { expect, test } from '@playwright/test';
import { encodeDraft, validateDraft } from '../../../skills/argus-table-theme/scripts/draft.mjs';

// Storybook's URLs from before the switch (src/lib/old-urls.ts).

test('a theme link from Storybook opens the theme on the creator page', async ({ page }) => {
  const { draft, errors } = validateDraft({ name: 'Old link', preset: 'material' });
  expect(errors).toEqual([]);
  if (!draft) throw new Error('no draft');
  const hash = await encodeDraft(draft);
  await page.goto(`iframe.html?id=themes-theme-creator--creator&viewMode=story#theme=${hash}`);
  await expect(page).toHaveURL(/\/argus-table\/themes\/creator\/(#.*)?$/);
  await expect(page.locator('argus-theme-creator')).toContainText(
    'Opened the theme from the link.',
  );
});

test('manager URLs land on their pages', async ({ page }) => {
  await page.goto('?path=/docs/features-sorting--docs');
  await expect(page).toHaveURL(/\/argus-table\/features\/sorting\/$/);
  await expect(page.locator('h1')).toHaveText('Sorting');
  await page.goto('?path=/story/recipes-vue--docs&globals=theme:default');
  await expect(page).toHaveURL(/\/argus-table\/guides\/vue\/$/);
});

test('an unknown Storybook page lands on the home page', async ({ page }) => {
  await page.goto('?path=/story/features-gone--x');
  await expect(page).toHaveURL(/\/argus-table\/$/);
  await expect(page.locator('h1')).toBeVisible();
  await page.goto('iframe.html?id=nope--x');
  await expect(page).toHaveURL(/\/argus-table\/$/);
  await page.goto('iframe.html');
  await expect(page).toHaveURL(/\/argus-table\/$/);
});

test('the home page on its own stays', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('h1')).toBeVisible();
  await page.waitForTimeout(500);
  expect(new URL(page.url()).pathname).toBe('/argus-table/');
  expect(new URL(page.url()).search).toBe('');
});
