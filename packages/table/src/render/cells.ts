import { html, render } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { ColumnView, TableModel } from '@argus-table/core';
import type { WindowRow } from '../controllers/virtual-controller.js';
import type { CellContent } from '../types.js';
import { cellSlot, formatValue, headerSlot, toChild } from './content.js';

type Column<T> = ColumnView<T, CellContent>;

/**
 * Renders header and cell content into the host's light DOM, as direct children
 * (a slot only takes the host's own children). Keyed and ordered by pool slot,
 * so recycled content updates in place instead of moving (ADR 0001).
 */
export function renderLightDom<T>(
  host: HTMLElement,
  model: TableModel<T, CellContent>,
  rows: readonly WindowRow[],
): void {
  const columns = model.columns;
  render(
    html`${repeat(
      columns,
      (c) => c.id,
      (c) => html`<div slot=${headerSlot(c.colIndex)}>${headerContent(c)}</div>`,
    )}${repeat(
      rows,
      (r) => r.slot,
      (r) =>
        repeat(
          columns,
          (c) => c.id,
          (c) =>
            html`<div slot=${cellSlot(r.slot, c.colIndex)}>${cellContent(model, r.index, c)}</div>`,
        ),
    )}`,
    host,
    { host },
  );
}

function headerContent<T>(column: Column<T>): unknown {
  const { header } = column;
  return toChild(typeof header === 'function' ? header() : header);
}

function cellContent<T>(model: TableModel<T, CellContent>, index: number, column: Column<T>) {
  if (column.cell) {
    const context = model.cellContext(index, column.id);
    return context ? toChild(column.cell(context.row, context)) : '';
  }
  return column.hasAccessor ? formatValue(model.valueAt(index, column.id)) : '';
}
