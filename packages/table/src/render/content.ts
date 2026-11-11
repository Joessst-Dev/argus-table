import { nothing } from 'lit';
import type { CellContent } from '../types.js';

/** Turns header or cell content into a Lit child. */
export function toChild(content: CellContent | null | undefined): unknown {
  if (content === null || content === undefined) return nothing;
  return typeof content === 'number' ? String(content) : content;
}

/** Default cell text for an accessor value. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleString();
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- objects are handled above
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/**
 * Private slot names (ADR 0001): cells by row pool slot and column slot,
 * headers by column slot, group headers by group and pin side, pinned rows by side,
 * index and column slot. A
 * column's slot is its `colIndex`, or its pool slot with `virtualizeColumns`.
 */
export const cellSlot = (slot: number, colSlot: number) => `c-${String(slot)}-${String(colSlot)}`;
export const headerSlot = (colSlot: number) => `h-${String(colSlot)}`;
/** A column group's header, by the group's slot number (`HeaderGroupCell.slot`). */
export const groupSlot = (slot: number) => `g-${String(slot)}`;
export const pinnedSlot = (side: 'top' | 'bottom', index: number, colSlot: number) =>
  `${side === 'top' ? 't' : 'b'}-${String(index)}-${String(colSlot)}`;

interface Pinnable {
  pin: 'start' | 'end' | undefined;
  pinEdge: boolean;
}

/**
 * Part list of a body or pinned-row cell: state is in the part name (`::part()`
 * can't take attribute selectors).
 */
export function cellParts(
  column: Pinnable & { sorted: 'asc' | 'desc' | false; kind: 'data' | 'selection' },
  pinnedRow = false,
): string {
  let parts = pinnedRow ? 'cell cell-pinned-row' : 'cell';
  if (column.kind === 'selection') parts += ' cell-selection';
  if (column.pin) parts += column.pinEdge ? ' cell-pinned cell-pinned-edge' : ' cell-pinned';
  if (column.sorted) parts += ' cell-sorted';
  return parts;
}

/** Handlers of the selection checkboxes (`selectionCheckboxes`). */
export interface CheckboxHandlers {
  /** A row's checkbox; it carries the row index in `data-row`. */
  row: (event: MouseEvent) => void;
  /** The header's select-all checkbox. */
  all: (event: MouseEvent) => void;
  /** A press on any of them: keeps focus on its cell, not the checkbox. */
  press: (event: MouseEvent) => void;
}

/** `aria-sort` for a header: only the sorted column carries it (WAI-ARIA APG). */
export function ariaSort(sorted: 'asc' | 'desc' | false): 'ascending' | 'descending' | undefined {
  if (!sorted) return undefined;
  return sorted === 'asc' ? 'ascending' : 'descending';
}

/**
 * Inline style of a cell or header: a pinned one's sticky inset, from the
 * start or the end edge, and with `virtualizeColumns` the grid cell it is
 * placed in. Cells are in pool order there, not in column order, so the row is
 * explicit too: auto-placement would wrap a cell that comes after one of a
 * later column into a new grid row.
 */
export function cellStyle(
  column: Pinnable & { offset: number; place: number | undefined },
): string | undefined {
  const pin = column.pin ? `--_pin-offset: ${String(column.offset)}px` : undefined;
  if (column.place === undefined) return pin;
  const place = `grid-area: 1 / ${String(column.place)}`;
  return pin ? `${pin}; ${place}` : place;
}

/**
 * Inline style of a group header row's cell: the columns it spans, placed
 * explicitly (the rows are grids on every column's track), and a pinned one's
 * sticky inset.
 */
export function groupStyle(
  cell: Pinnable & { offset: number; colIndex: number; span: number },
): string {
  const place = `grid-column: ${String(cell.colIndex)} / span ${String(cell.span)}`;
  return cell.pin ? `--_pin-offset: ${String(cell.offset)}px; ${place}` : place;
}
