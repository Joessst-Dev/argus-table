import { expect, test, type Locator, type Page } from '@playwright/test';
import { focused, headerOrder, open, scrollTo, settle } from './helpers.js';

const header = (page: Page, id: string) =>
  page.locator(`argus-table [role="columnheader"][data-col="${id}"]`);
const group = (page: Page, id: string, side = 'center') =>
  page.locator(`argus-table [data-group-key="g:${side}:${id}"]`);

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('not rendered');
  return b;
}

/** The focused group header's key, or the focused cell's column id. */
async function focus(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const active = document.querySelector('argus-table')?.shadowRoot
      ?.activeElement as HTMLElement | null;
    return active?.dataset.groupKey ?? active?.dataset.col;
  });
}

test.describe('column groups', () => {
  test('group headers span their columns, in three header rows', async ({ page }) => {
    await open(page, { rows: 200, cols: 12, groups: '' });
    const contact = await box(group(page, 'contact'));
    const email = await box(header(page, 'email'));
    const country = await box(header(page, 'country'));
    expect(contact.x).toBeCloseTo(email.x, 0);
    expect(contact.x + contact.width).toBeCloseTo(country.x + country.width, 0);
    const location = await box(group(page, 'location'));
    expect(location.y).toBeCloseTo(contact.y + contact.height, 0);
    expect(email.y).toBeCloseTo(location.y + location.height, 0);
    await expect(page.locator('argus-table [part~="header-row"]')).toHaveAttribute(
      'aria-rowindex',
      '3',
    );
    // The first body row starts right below the header rows.
    const first = await box(page.locator('argus-table [part~="row"][aria-rowindex="4"]'));
    expect(first.y).toBeCloseTo(email.y + email.height, 0);
  });

  test('arrow keys climb to the groups and back down to the column', async ({ page }) => {
    await open(page, { rows: 200, cols: 12, groups: '' });
    await header(page, 'city').evaluate((h: HTMLElement) => {
      h.focus();
    });
    await page.keyboard.press('ArrowUp');
    await settle(page);
    expect(await focus(page)).toBe('g:center:location');
    await page.keyboard.press('ArrowUp');
    await settle(page);
    expect(await focus(page)).toBe('g:center:contact');
    await page.keyboard.press('ArrowRight');
    await settle(page);
    expect(await focus(page)).toBe('g:center:order');
    await page.keyboard.press('ArrowDown');
    await settle(page);
    expect(await focus(page)).toBe('status');
    // PageDown from a group header goes into the body.
    await page.keyboard.press('ArrowUp');
    await settle(page);
    await page.keyboard.press('PageDown');
    await settle(page);
    const cell = await focused(page);
    expect(cell?.role).toBe('gridcell');
    expect(cell?.col).toBe('status');
    expect(cell?.rowIndex).toBeGreaterThan(4);
  });

  test('a group moves as a block, by drag and by keyboard', async ({ page }) => {
    await open(page, { rows: 50, cols: 12, groups: '' });
    const before = await headerOrder(page);
    expect(before.slice(2, 8)).toEqual(['email', 'city', 'country', 'status', 'amount', 'date']);
    const order = await box(group(page, 'order'));
    const contact = await box(group(page, 'contact'));
    const y = order.y + order.height / 2;
    await page.mouse.move(order.x + 20, y);
    await page.mouse.down();
    await page.mouse.move(order.x + 10, y, { steps: 2 });
    await page.mouse.move(contact.x + 5, y, { steps: 6 });
    await settle(page);
    await page.mouse.up();
    await settle(page);
    expect((await headerOrder(page)).slice(2, 8)).toEqual([
      'status',
      'amount',
      'date',
      'email',
      'city',
      'country',
    ]);
    // Alt+Shift+Arrow moves it back, and says where it went.
    await group(page, 'order').evaluate((g: HTMLElement) => {
      g.focus();
    });
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await settle(page);
    expect((await headerOrder(page)).slice(2, 8)).toEqual(before.slice(2, 8));
    await expect(page.locator('[data-argus-announcer]')).toHaveText(
      'Order moved to columns 6 to 8 of 12',
    );
    // A column can't leave its group: Email stays the first of Contact.
    await header(page, 'email').evaluate((h: HTMLElement) => {
      h.focus();
    });
    await page.keyboard.press('Alt+Shift+ArrowLeft');
    await settle(page);
    expect((await headerOrder(page)).slice(2, 8)).toEqual(before.slice(2, 8));
  });

  test('a group split by pinning keeps its pinned part in place', async ({ page }) => {
    await open(page, { rows: 50, cols: 12, groups: '', pins: 'email:start' });
    const pinned = group(page, 'contact', 'start');
    await expect(pinned).toHaveAttribute('aria-colspan', '1');
    await expect(group(page, 'contact')).toHaveAttribute('aria-colspan', '2');
    const before = await box(pinned);
    await scrollTo(page, null, 600);
    const after = await box(pinned);
    expect(after.x).toBeCloseTo(before.x, 0);
  });

  test('with virtualized columns, a wide group keeps its label in view', async ({ page }) => {
    await open(page, { rows: 50, cols: 200, groups: '', vcols: '' });
    const slots = () =>
      page.evaluate(() =>
        [...(document.querySelector('argus-table')?.querySelectorAll('[slot^="g-"]') ?? [])].map(
          (s) => s.slot,
        ),
      );
    const initial = await slots();
    await scrollTo(page, null, 8000);
    expect(await slots()).toEqual(initial);
    const label = await box(group(page, 'extra').locator('.group-label'));
    const scroller = await box(page.locator('argus-table [part~="table"]'));
    expect(label.x).toBeGreaterThanOrEqual(scroller.x);
    expect(label.x + label.width).toBeLessThanOrEqual(scroller.x + scroller.width);
  });

  test('rows pinned to the top sit below every header row, with rows of any height', async ({
    page,
  }) => {
    await open(page, {
      rows: 500,
      cols: 12,
      groups: '',
      pinned: 'top',
      rowheight: 'auto',
      notes: '',
    });
    const head = await box(page.locator('argus-table [part~="header"]'));
    const pinned = page.locator('argus-table [part~="row-pinned-top"]');
    expect((await box(pinned)).y).toBeCloseTo(head.y + head.height, 0);
    await scrollTo(page, 4000);
    expect((await box(pinned)).y).toBeCloseTo(head.y + head.height, 0);
  });
});
