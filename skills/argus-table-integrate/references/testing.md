# Testing tables

argus-table renders rows only in a real layout: it virtualizes, so it renders the rows that fit its height, measured in the browser. **jsdom and happy-dom have no layout: the table renders no rows there.** Tests that rendered the old table in jsdom (Jest or Vitest with `environment: 'jsdom'`, React Testing Library, Vue Test Utils, Angular TestBed with jsdom) won't find cells.

Tell the user before changing a test setup. Options, best first:

1. **Browser tests** (Vitest browser mode with Playwright, Web Test Runner, Angular's Karma or `@angular/build:unit-test` with a browser): the table renders as in the app.
2. **End-to-end tests** (Playwright, Cypress) for table behaviour, keeping jsdom tests for the rest of the component (they can check that `<argus-table>` is there with the right `columns` and `data` properties).
3. **Test the data, not the DOM**: move row mapping, column definitions and `getRows` into functions and test those.

## Queries

The table is an ARIA grid:

```ts
const grid = page.getByRole('grid', { name: 'Orders' });
await expect(grid.getByRole('row')).not.toHaveCount(0);
await grid.getByRole('columnheader', { name: 'Total' }).click(); // sorts, if sortable
await expect(grid.getByRole('columnheader', { name: 'Total' })).toHaveAttribute(
  'aria-sort',
  'ascending',
);
await expect(grid.getByRole('gridcell', { name: 'Ada Lovelace' })).toBeVisible();
```

- Only rows in view (plus a few) are in the DOM. To reach a far row, call `table.scrollToRow({ id })` (or scroll) before querying.
- Rows are reused while scrolling: DOM order isn't row order. Use `aria-rowindex` for a row's position (the header row is 1).
- Cell text is in the light DOM (slotted into the grid), so `getByText`, `getByRole('gridcell', { name })` and Testing Library queries find it. The grid structure (rows, cells) is in the shadow root; Playwright and Testing Library's `*ByRole` pierce it.
- Wait for rendering after a change: the element updates asynchronously (`await table.updateComplete` with the element; in Playwright, auto-waiting assertions).
- Give the table a height in tests too (the default 400px is fine), and a viewport wide enough for the columns.
- A `dataSource`: mock `getRows` (or the network) and wait for the first rows.
- **Cell text and Playwright:** a gridcell's content is slotted from the light DOM, so `innerText()` / `allInnerTexts()` on a gridcell or columnheader return empty strings, and `filter({ hasText })` on gridcells finds nothing. Use the accessible name (`getByRole('gridcell', { name: 'Ada Lovelace' })`), `expect(grid).toMatchAriaSnapshot(…)` / `grid.ariaSnapshot()`, or read the slotted nodes: `cell.evaluate((c) => c.querySelector('slot')?.assignedElements({ flatten: true }).map((n) => n.textContent).join(''))`.
- **Header buttons:** the column menu's button is header content too, so `columnheader.getByRole('button')` doesn't find it. Query it from the grid: `grid.getByRole('button', { name: 'Column menu' }).nth(2)` (one per header, in column order).
- **Row count:** `aria-rowcount` isn't an attribute on the element, so tests can't read it. Count from your data, or call `scrollToRow()` with an index past the last row (it scrolls to the end) and read the highest `aria-rowindex`.
- **Sorting:** a sortable header cycles `aria-sort` ascending → descending → none.
