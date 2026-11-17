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
 * Opens a flavour's tab, scrolls the example into view and waits for its table's
 * first body row. Returns the flavour's container (`[data-example][data-flavour]`),
 * which holds the running example and its source.
 */
export async function openFlavour(page: Page, example: string, flavour: Flavour): Promise<Locator> {
  const container = page.locator(`[data-example="${example}"][data-flavour="${flavour}"]`);
  const tab = container
    .locator('xpath=ancestor::starlight-tabs[1]')
    .getByRole('tab', { name: TAB_NAMES[flavour], exact: true });
  // A click before Starlight's tabs script has started does nothing: click until selected.
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
  }).toPass();
  // Examples load when visible (`client:visible`): clicking the tab scrolls only
  // the tab into view, which can leave the example below the fold, never loaded.
  // Scroll the flavour's container (always rendered, the example at its top) rather
  // than the table, which may have no size until its island has loaded.
  await container.evaluate((el) => {
    el.scrollIntoView({ block: 'start' });
  });
  const table = container.locator('argus-table').first();
  // Its first body row: a skeleton for a data source still loading. The first match:
  // a table nested in the example's cells or panels has rows of its own.
  await table.locator('[role="row"][aria-rowindex="2"]').first().waitFor();
  return container;
}

/** No axe violations inside the container: WCAG 2.2 A and AA, and axe's best practices (as Storybook's). */
export async function expectAccessible(page: Page, container: Locator): Promise<void> {
  const selector = await container.evaluate(
    (el) =>
      `[data-example="${el.dataset.example ?? ''}"][data-flavour="${el.dataset.flavour ?? ''}"]`,
  );
  const results = await new AxeBuilder({ page })
    .include(selector)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
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

/** The text of each column header, in order (their slotted light-DOM content). */
export function headerTexts(table: Locator): Promise<string[]> {
  return table.evaluate((el) =>
    [...(el.shadowRoot?.querySelectorAll('[role="columnheader"][data-col]') ?? [])].map((header) =>
      (header.querySelector('slot')?.assignedNodes({ flatten: true }) ?? [])
        .map((node) => node.textContent ?? '')
        .join('')
        .trim(),
    ),
  );
}

/** How many rendered cells of a column, its header included, cut their content off. */
export function truncated(table: Locator, columnId: string): Promise<number> {
  return table.evaluate(
    (el, id) =>
      [...(el.shadowRoot?.querySelectorAll(`[data-col="${id}"]`) ?? [])].filter((cell) => {
        const content = cell.querySelector('slot')?.assignedElements()[0];
        return content !== undefined && content.scrollWidth > content.clientWidth;
      }).length,
    columnId,
  );
}

/** Column ids in the order the headers show (by `aria-colindex`). */
export function headerOrder(table: Locator): Promise<string[]> {
  return table.evaluate((el) =>
    [...(el.shadowRoot?.querySelectorAll<HTMLElement>('[role="columnheader"][data-col]') ?? [])]
      .sort((a, b) => Number(a.ariaColIndex) - Number(b.ariaColIndex))
      .map((header) => header.dataset.col ?? ''),
  );
}

/** The rendered body rows in order, each as its cells' text by column id. */
export function bodyRows(table: Locator): Promise<Record<string, string>[]> {
  return table.evaluate((el) =>
    [...(el.shadowRoot?.querySelectorAll<HTMLElement>('[part~="body"] > [role="row"]') ?? [])]
      .sort(
        (a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')),
      )
      .map((row) =>
        Object.fromEntries(
          [...row.querySelectorAll<HTMLElement>('[role="gridcell"]')].map((cell) => [
            cell.dataset.col ?? '',
            (cell.querySelector('slot')?.assignedNodes({ flatten: true }) ?? [])
              .map((node) => node.textContent ?? '')
              .join('')
              .trim(),
          ]),
        ),
      ),
  );
}

/**
 * A body cell by row position (0-based in the current order) and column. Assumes one
 * header row and no top pinned rows (`aria-rowindex` = position + 2).
 */
export function bodyCell(table: Locator, rowIndex: number, columnId = 'customer'): Locator {
  return table.locator(
    `[part~="body"] > [aria-rowindex="${String(rowIndex + 2)}"] > [data-col="${columnId}"]`,
  );
}

/** Clicks a button that downloads a file, and returns the file's text without a BOM. */
export async function downloadedText(page: Page, button: Locator): Promise<string> {
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  return (await readFile(path, 'utf8')).replace(/^\uFEFF/, '');
}
