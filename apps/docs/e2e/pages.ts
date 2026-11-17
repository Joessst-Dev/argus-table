// Helpers for the specs of text pages (guides, references): axe once the
// page's scroll regions are settled.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Waits until every code block and Markdown table that scrolls sideways has a
 * tab stop: Expressive Code's script and the site's (Head.astro) add it after a
 * resize observer settles.
 */
export async function scrollersSettled(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll('.expressive-code pre, .sl-markdown-content table')].every(
          (el) => el.scrollWidth <= el.clientWidth || el.getAttribute('tabindex') === '0',
        ),
      ),
    )
    .toBe(true);
}

/** axe on the page's `main` (WCAG 2.2 AA and best practices), once it has settled. */
export async function expectPageAccessible(page: Page): Promise<void> {
  await scrollersSettled(page);
  const results = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}
