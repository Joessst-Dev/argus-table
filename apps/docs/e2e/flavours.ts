import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';
import { FLAVOURS, type Flavour } from '../src/lib/sources';

export { FLAVOURS, type Flavour };

const TAB_NAMES: Record<Flavour, string> = {
  html: 'HTML',
  react: 'React',
  vue: 'Vue',
  angular: 'Angular',
};

/**
 * Opens a flavour's tab and waits for its table's first body row. Returns the
 * flavour's container (`[data-example][data-flavour]`), which holds the
 * running example and its source.
 */
export async function openFlavour(page: Page, example: string, flavour: Flavour): Promise<Locator> {
  const container = page.locator(`[data-example="${example}"][data-flavour="${flavour}"]`);
  await container
    .locator('xpath=ancestor::starlight-tabs[1]')
    .getByRole('tab', { name: TAB_NAMES[flavour], exact: true })
    .click();
  await container.locator('argus-table [role="row"][aria-rowindex="2"]').first().waitFor();
  return container;
}

/** No axe violations (WCAG 2.2 A and AA) inside the container. */
export async function expectAccessible(page: Page, container: Locator): Promise<void> {
  const selector = await container.evaluate(
    (el) =>
      `[data-example="${el.dataset.example ?? ''}"][data-flavour="${el.dataset.flavour ?? ''}"]`,
  );
  const results = await new AxeBuilder({ page })
    .include(selector)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

/**
 * The text a body cell shows (its slotted light-DOM content), by the row's
 * `aria-rowindex` and the column id.
 */
export function cellText(table: Locator, rowIndex: number, columnId: string): Promise<string> {
  return table
    .locator(`[role="row"][aria-rowindex="${String(rowIndex)}"] [data-col="${columnId}"] slot`)
    .evaluate((slot) =>
      (slot as HTMLSlotElement)
        .assignedNodes({ flatten: true })
        .map((node) => node.textContent ?? '')
        .join('')
        .trim(),
    );
}
