import { html, render } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { ColumnView, RowPin, TableModel } from '@argus-table/core';
import type { WindowRow } from '../controllers/virtual-controller.js';
import type { CellContent } from '../types.js';
import { cellSlot, formatValue, headerSlot, pinnedSlot, toChild } from './content.js';

type Column<T> = ColumnView<T, CellContent>;

/**
 * Renders header and cell content into the host's light DOM, as direct children
 * (a slot only takes the host's own children). Keyed and ordered by pool slot,
 * so recycled content updates in place instead of moving (ADR 0001). The part
 * ends at `renderBefore`, so the host's other children (`<argus-column>`) stay
 * outside it, wherever they are added.
 */
export function renderLightDom<T>(
  host: HTMLElement,
  model: TableModel<T, CellContent>,
  rows: readonly WindowRow[],
  renderBefore: ChildNode,
): void {
  // The selection column renders its checkboxes in the shadow root: no content here.
  const columns = model.columns.filter((c) => c.kind === 'data');
  render(
    html`${repeat(
      columns,
      (c) => c.id,
      (c) => html`<div slot=${headerSlot(c.colIndex)}>${headerContent(c)}</div>`,
    )}${pinnedContent(model, 'top')}${repeat(
      rows,
      (r) => r.slot,
      (r) =>
        repeat(
          columns,
          (c) => c.id,
          (c) =>
            html`<div slot=${cellSlot(r.slot, c.colIndex)}>${cellContent(model, r.index, c)}</div>`,
        ),
    )}${pinnedContent(model, 'bottom')}`,
    host,
    { host, renderBefore },
  );
}

function headerContent<T>(column: Column<T>): unknown {
  const { header } = column;
  return toChild(typeof header === 'function' ? header() : header);
}

/** Content of the rows pinned to one side, slotted by side, index and column. */
function pinnedContent<T>(model: TableModel<T, CellContent>, side: RowPin) {
  const columns = model.columns.filter((c) => c.kind === 'data');
  const rows = Array.from({ length: model.pinnedCount(side) }, (_, i) => i);
  return rows.map((i) =>
    repeat(
      columns,
      (c) => c.id,
      (c) =>
        html`<div slot=${pinnedSlot(side, i, c.colIndex)}>${pinnedCell(model, side, i, c)}</div>`,
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
    return context ? toChild(column.cell(context.row, context)) : '';
  }
  return column.hasAccessor ? formatValue(model.pinnedValueAt(side, index, column.id)) : '';
}

function cellContent<T>(model: TableModel<T, CellContent>, index: number, column: Column<T>) {
  if (column.cell) {
    const context = model.cellContext(index, column.id);
    return context ? toChild(column.cell(context.row, context)) : '';
  }
  return column.hasAccessor ? formatValue(model.valueAt(index, column.id)) : '';
}
