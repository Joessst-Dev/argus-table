import { html, render, type RootPart } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { ColumnView, RowPin, TableModel } from '@argus-table/core';
import type { RenderedColumn } from '../controllers/column-window.js';
import type { WindowRow } from '../controllers/virtual-controller.js';
import type { CellContent } from '../types.js';
import { cellSlot, formatValue, headerSlot, pinnedSlot } from './content.js';
import { content } from './content-directive.js';

type Column<T> = ColumnView<T, CellContent>;

/**
 * Renders header and cell content into the host's light DOM, as direct children
 * (a slot only takes the host's own children). Keyed and ordered by pool slot,
 * so recycled content updates in place instead of moving (ADR 0001). The part
 * ends at `renderBefore`, so the host's other children (`<argus-column>`) stay
 * outside it, wherever they are added. `rendered` are the columns the shadow
 * root renders, with their slots and keys. What `header` and `cell` return goes
 * through `content()`, so foreign content reaches the table's `contentRenderer`.
 * Returns the part, which the table disconnects when it is disconnected.
 */
export function renderLightDom<T>(
  host: HTMLElement,
  model: TableModel<T, CellContent>,
  rows: readonly WindowRow[],
  rendered: readonly RenderedColumn<T>[],
  renderBefore: ChildNode,
): RootPart {
  // The selection column renders its checkboxes in the shadow root: no content here.
  const columns = rendered.filter((c) => c.kind === 'data');
  return render(
    html`${repeat(
      columns,
      (c) => c.key,
      (c) => html`<div slot=${headerSlot(c.slot)}>${headerContent(c)}</div>`,
    )}${pinnedContent(model, columns, 'top')}${repeat(
      rows,
      (r) => r.slot,
      (r) =>
        repeat(
          columns,
          (c) => c.key,
          (c) =>
            html`<div slot=${cellSlot(r.slot, c.slot)}>${cellContent(model, r.index, c)}</div>`,
        ),
    )}${pinnedContent(model, columns, 'bottom')}`,
    host,
    { host, renderBefore },
  );
}

function headerContent<T>(column: Column<T>): unknown {
  const { header } = column;
  return content(typeof header === 'function' ? header() : header);
}

/** Content of the rows pinned to one side, slotted by side, index and column. */
function pinnedContent<T>(
  model: TableModel<T, CellContent>,
  columns: readonly RenderedColumn<T>[],
  side: RowPin,
) {
  const rows = Array.from({ length: model.pinnedCount(side) }, (_, i) => i);
  return rows.map((i) =>
    repeat(
      columns,
      (c) => c.key,
      (c) => html`<div slot=${pinnedSlot(side, i, c.slot)}>${pinnedCell(model, side, i, c)}</div>`,
    ),
  );
}

function pinnedCell<T>(
  model: TableModel<T, CellContent>,
  side: RowPin,
  index: number,
  column: Column<T>,
) {
  if (column.cell) {
    const context = model.pinnedCellContext(side, index, column.id);
    return context ? content(column.cell(context.row, context)) : '';
  }
  return column.hasAccessor ? formatValue(model.pinnedValueAt(side, index, column.id)) : '';
}

function cellContent<T>(model: TableModel<T, CellContent>, index: number, column: Column<T>) {
  if (column.cell) {
    const context = model.cellContext(index, column.id);
    return context ? content(column.cell(context.row, context)) : '';
  }
  return column.hasAccessor ? formatValue(model.valueAt(index, column.id)) : '';
}
