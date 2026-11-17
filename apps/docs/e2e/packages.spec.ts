import { expect, test } from '@playwright/test';
import { expectPageAccessible as expectAccessible } from './pages';

/** Each package guide's id and title (src/lib/packages.ts). */
const GUIDES = {
  'header-menu': 'Header menu add-on',
  formulas: 'Formulas add-on',
  export: 'Export add-on',
  editing: 'Editing add-on',
  react: 'React',
  vue: 'Vue',
  angular: 'Angular',
};

for (const [id, title] of Object.entries(GUIDES)) {
  test(`${id}: the README, with its title and the npm note`, async ({ page }) => {
    await page.goto(`guides/${id}/`);
    await expect(page.locator('h1')).toHaveText(title);
    // The README's own `# @argus-table/<id>` is dropped: the page's is the only h1.
    await expect(page.locator('h1')).toHaveCount(1);
    const main = page.locator('main');
    await expect(
      main.locator(`a[href="https://www.npmjs.com/package/@argus-table/${id}"]`),
    ).toBeAttached();
    // The README's Install section.
    await expect(
      main
        .locator('.expressive-code', { hasText: new RegExp(`npm i .*@argus-table/${id}\\b`) })
        .first(),
    ).toBeVisible();
    await expectAccessible(page);
  });
}
