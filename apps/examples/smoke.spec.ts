// Types only: brings in the 'argus-table' entry of HTMLElementTagNameMap.
import type {} from 'argus-table';
import { expect, test, type Page } from '@playwright/test';
import { starters } from './starters.mjs';
import { createOrders } from './html/data.js';

// Every starter generates the same seeded orders, so the expected text comes
// from the HTML starter's generator.
const orders = createOrders();
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' });
const first = orders[0];
const cheapest = Math.min(...orders.map((o) => o.total));

/** The text of a cell in the first body row (aria-rowindex 2), read from its slotted light DOM. */
async function firstRowCell(page: Page, col: string): Promise<string> {
  return page.evaluate((col) => {
    const root = document.querySelector('argus-table')?.shadowRoot;
    const cell = root?.querySelector(`[part~="row"][aria-rowindex="2"] [data-col="${col}"]`);
    return (cell?.querySelector('slot')?.assignedNodes() ?? [])
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
  }, col);
}

for (const { name, port } of starters) {
  test(`${name} starter`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto(`http://localhost:${String(port)}/`);
    const table = page.locator('argus-table');
    await table.locator('[part~="row"][aria-rowindex="2"]').waitFor();

    // Renders the generated rows, cell functions included.
    expect(first).toBeDefined();
    await expect.poll(() => firstRowCell(page, 'id')).toBe(`#${first?.id ?? ''}`);
    expect(await firstRowCell(page, 'customer')).toBe(first?.customer);
    expect(await firstRowCell(page, 'status')).toBe(first?.status);

    // Sorts on a header click.
    const total = table.locator('[role="columnheader"][data-col="total"]');
    await total.click();
    await expect(total).toHaveAttribute('aria-sort', 'ascending');
    await expect.poll(() => firstRowCell(page, 'total')).toBe(currency.format(cheapest));

    // The row-click event reaches the app, through the wrapper where there is one.
    const id = await firstRowCell(page, 'id');
    await table.locator('[part~="row"][aria-rowindex="2"] [data-col="customer"]').click();
    await expect(page.locator('p[role="status"]')).toHaveText(new RegExp(`Selected order ${id} `));

    expect(errors).toEqual([]);
  });
}
