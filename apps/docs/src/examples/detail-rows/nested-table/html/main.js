import 'argus-table';
import { columns, idOf, lineColumns, linesOf, orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
/** @typedef {import('../../data.ts').Line} Line */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#detail-rows-nested-table-table')
);

/**
 * A panel's table of lines, made once per row and kept, so its sorting and
 * scrolling stay as the user left them.
 * @type {Map<string, import('argus-table').ArgusTable<Line>>}
 */
const nested = new Map();

table.columns = columns;
table.data = orders;
table.getRowId = idOf;
table.rowDetail = (/** @type {import('argus-table').RowDetailContext<Order>} */ { row, rowId }) => {
  let lines = nested.get(rowId);
  if (!lines) {
    lines = /** @type {import('argus-table').ArgusTable<Line>} */ (
      document.createElement('argus-table')
    );
    lines.setAttribute('aria-label', `Lines of ${row.id}`);
    // As tall as its rows, up to 240px; past that it scrolls.
    lines.style.cssText = 'block-size: auto; max-block-size: 240px';
    lines.columns = lineColumns;
    lines.data = linesOf(row);
    nested.set(rowId, lines);
  }
  return lines;
};
// Setting expanded makes the app its owner: apply what a chevron proposes.
table.expanded = ['o1', 'o3'];
table.addEventListener('argus-expanded-change', (event) => {
  table.expanded = event.detail.expanded;
});
