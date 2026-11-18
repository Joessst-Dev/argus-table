import { html, nothing, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import {
  groupKey,
  RowLayout,
  type ColumnView,
  type GridRow,
  type HeaderGroupCell,
  type OrderUnit,
  type TableModel,
} from '@argus-table/core';
import { INTERACTIVE } from './interactive.js';
import { columnKey } from './render/header.js';
import type { CellContent } from './types.js';

// Pure helpers of `<argus-table>`: where rows and cells are in the grid, and
// small pieces of its render. Nothing here keeps state.

/**
 * The sortable column a header click came from, if any. Works for slotted content
 * too. Clicks on a resize handle never sort, so a click that ends a drag doesn't,
 * and neither do clicks on interactive content in the header (a button, an input).
 */
export function sortColumnOf(event: Event): string | undefined {
  for (const target of event.composedPath()) {
    if (!(target instanceof HTMLElement)) continue;
    if (target.dataset.resizeCol !== undefined) return undefined;
    if (target.matches(INTERACTIVE)) return undefined;
    if (target.dataset.sortCol !== undefined) return target.dataset.sortCol;
    if (target.getAttribute('role') === 'row') return undefined;
  }
  return undefined;
}

/**
 * The cell holding the grid's single tab stop: a row (its section, and its index
 * there: in the row model for the body, in its list for a pinned row) and a
 * column. `rowId` keeps it on the same body row when the order changes.
 */
export interface Active extends GridRow {
  rowId: string | undefined;
  col: string;
}

/**
 * Where the rows sit in the grid: header rows, pinned top, body, pinned bottom.
 * The body counts displayed positions: data rows and their detail panels
 * (`model.display`); a body `GridRow`'s index is a position.
 */
export function layoutOf<T>(model: TableModel<T, CellContent>): RowLayout {
  return new RowLayout(
    model.pinnedCount('top'),
    model.display.count,
    model.pinnedCount('bottom'),
    model.headerRows,
  );
}

/** The data index at a body position, or `undefined` for a detail panel or a position outside the body. */
export function dataIndexOf<T>(
  model: TableModel<T, CellContent>,
  position: number,
): number | undefined {
  const shown = model.display.at(position);
  return shown?.kind === 'data' ? shown.index : undefined;
}

/** The body position of a data index. */
export function positionOfIndex<T>(model: TableModel<T, CellContent>, index: number): number {
  return model.display.positionOf(index);
}

/** The id of a row's detail panel row, from the row's id: never a row id `getRowId` makes in practice. */
export const panelRowId = (rowId: string) => `\u0001detail:${rowId}`;

/** The row id of a detail panel row's id, or `undefined` for a data row's id. */
export function rowIdOfPanel(id: string): string | undefined {
  return id.startsWith('\u0001detail:') ? id.slice('\u0001detail:'.length) : undefined;
}

/** The drop slot and applied-move key of a column or group (`HeaderDrag.key`). */
export function unitKey(unit: OrderUnit): string {
  return unit.kind === 'column' ? columnKey(unit.id) : groupKey(unit.id, unit.pin);
}

/**
 * The grid cell or column header an element is, if any. With `root`, only one in
 * that shadow root: a table nested in a cell or a panel has cells of its own.
 */
export function gridCell(target: EventTarget, root?: Node): HTMLElement | undefined {
  if (!(target instanceof HTMLElement) || target.dataset.col === undefined) return undefined;
  if (root && target.getRootNode() !== root) return undefined;
  const role = target.getAttribute('role');
  return role === 'gridcell' || role === 'columnheader' ? target : undefined;
}

/** The column group header an element is, if any (with `root`, only one in that shadow root). */
export function groupCell(target: EventTarget, root?: Node): HTMLElement | undefined {
  return target instanceof HTMLElement &&
    target.dataset.groupKey !== undefined &&
    (!root || target.getRootNode() === root)
    ? target
    : undefined;
}

/** The grid row a rendered row element is, from its `aria-rowindex`. */
export function gridRowOf(row: Element | null, layout: RowLayout): GridRow | undefined {
  const index = row?.getAttribute('aria-rowindex');
  return index ? layout.fromAriaRowIndex(Number(index)) : undefined;
}

/** The grid row a cell or column header is in. */
export function gridRowOfCell(cell: HTMLElement, layout: RowLayout): GridRow | undefined {
  return gridRowOf(cell.parentElement, layout);
}

/**
 * The pinned edge's shadow, drawn once per side over the scroller rather than
 * per row: a shadow on every pinned cell repaints on every scroll frame. It
 * covers the pinned columns and casts `--argus-pinned-shadow` onto the rest;
 * PinScrollController sizes it to the visible area.
 */
export function pinShadow(
  side: 'start' | 'end',
  width: number,
  contentPx: number,
): TemplateResult | typeof nothing {
  if (width === 0) return nothing;
  return html`<div
    class="pin-shadow"
    data-side=${side}
    aria-hidden="true"
    style=${styleMap({
      inlineSize: `${String(width)}px`,
      '--_content-h': `${String(contentPx)}px`,
    })}
  ></div>`;
}

/** CSS grid track for a column: fixed px, or a flex share with the min width as floor. */
export function track<T>(column: ColumnView<T, CellContent>): string {
  return column.flex === undefined
    ? `${String(column.width)}px`
    : `minmax(${String(column.minWidth)}px, ${String(column.flex)}fr)`;
}

/** Total width of the columns pinned to one side. */
export function pinnedWidth<T>(
  columns: readonly ColumnView<T, CellContent>[],
  side: 'start' | 'end',
): number {
  return columns.reduce((sum, c) => (c.pin === side ? sum + c.width : sum), 0);
}

/** `1` for left-to-right, `-1` for right-to-left: logical arrow keys and offsets. */
export function directionOf(element: Element): 1 | -1 {
  return getComputedStyle(element).direction === 'rtl' ? -1 : 1;
}

/** The group header cell with a key (`data-group-key`), from the model. */
export function groupCellOf<T>(
  model: TableModel<T, CellContent>,
  key: string | undefined,
): HeaderGroupCell<CellContent> | undefined {
  if (key === undefined) return undefined;
  return model.headerGroups.flat().find((c) => c.key === key);
}
