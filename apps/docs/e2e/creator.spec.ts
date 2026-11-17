import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
// The skill's own encoder: a link it makes must open here.
import { themeLink, validateDraft } from '../../../skills/argus-table-theme/scripts/draft.mjs';

// Each test gets a fresh browser context, so the saved draft starts empty.

const creator = (page: Page) => page.locator('argus-theme-creator');
const css = (page: Page) => creator(page).evaluate((el) => (el as unknown as { css: string }).css);
/** The two previews' tables (light, dark), in the creator's shadow root. */
const previews = (page: Page) => creator(page).locator('argus-table.main');

async function open(page: Page, hash = '') {
  await page.goto(`themes/creator/${hash}`);
  await previews(page).first().locator('[role="row"][aria-rowindex="2"]').waitFor();
}

test('a preset reaches both previews', async ({ page }) => {
  await open(page);
  await creator(page).locator('#preset').selectOption('material');
  await expect.poll(() => css(page)).toContain('--argus-border-radius: 12px;');
  await expect
    .poll(() =>
      previews(page).evaluateAll((tables) =>
        tables.map((t) => getComputedStyle(t).backgroundColor),
      ),
    )
    .toEqual(['rgb(254, 247, 255)', 'rgb(20, 18, 24)']);
});

test('the accent changes the focus ring', async ({ page }) => {
  await open(page);
  await creator(page)
    .locator('#accent-light')
    .evaluate((input: HTMLInputElement) => {
      input.value = '#0a7d5a';
      input.dispatchEvent(new Event('input'));
    });
  await expect
    .poll(() =>
      previews(page)
        .first()
        .evaluate((t) => getComputedStyle(t).getPropertyValue('--argus-focus-ring')),
    )
    .toContain('#0a7d5a');
});

test('a link opens its theme and leaves the URL', async ({ page }) => {
  const { draft, errors } = validateDraft({ name: 'Linked', preset: 'bootstrap' });
  expect(errors).toEqual([]);
  if (!draft) throw new Error('no draft');
  const link = await themeLink(draft);
  await open(page, new URL(link).hash);
  await expect(creator(page)).toContainText('Opened the theme from the link.');
  await expect
    .poll(() => css(page))
    .toContain('Linked: an argus-table theme, based on the Bootstrap-inspired theme.');
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('');
});

test('an unreadable link says so', async ({ page }) => {
  // Opened in a new tab: the creator starts from the default.
  await open(page, '#theme=not-a-theme');
  await expect(creator(page)).toContainText(
    'The link’s theme couldn’t be read; started from the default.',
  );
  // Opened where the creator already shows a theme: it keeps that one.
  await creator(page).locator('#preset').selectOption('minimal');
  await page.evaluate(() => {
    location.hash = 'theme=still-not-a-theme';
  });
  await expect(creator(page)).toContainText(
    'The link’s theme couldn’t be read; kept the current theme.',
  );
  await expect.poll(() => css(page)).toContain('Minimal');
});

test('copy a link points at this page', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only in Playwright');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  await creator(page).locator('#preset').selectOption('fluent');
  await creator(page).getByRole('button', { name: 'Copy a link' }).click();
  await expect(creator(page)).toContainText('Copied a link to this theme.');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/argus-table\/themes\/creator\/#theme=[\w-]+$/);
  const other = await context.newPage();
  await other.goto(link);
  await expect(other.locator('argus-theme-creator')).toContainText(
    'Opened the theme from the link.',
  );
});

test('fits a phone and fills a desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect
    .poll(() => creator(page).evaluate((el) => el.getBoundingClientRect().width))
    .toBeGreaterThan(1000);
  const results = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
