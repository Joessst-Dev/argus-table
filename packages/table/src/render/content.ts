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

/** Private slot names (ADR 0001): cells by pool slot and column, headers by column. */
export const cellSlot = (slot: number, colIndex: number) => `c-${String(slot)}-${String(colIndex)}`;
export const headerSlot = (colIndex: number) => `h-${String(colIndex)}`;

interface Pinnable {
  pin: 'start' | 'end' | undefined;
  pinEdge: boolean;
}

/** Part list of a body cell: state is in the part name (`::part()` can't take attribute selectors). */
export function cellParts(column: Pinnable & { sorted: 'asc' | 'desc' | false }): string {
  let parts = 'cell';
  if (column.pin) parts += column.pinEdge ? ' cell-pinned cell-pinned-edge' : ' cell-pinned';
  if (column.sorted) parts += ' cell-sorted';
  return parts;
}

/** `aria-sort` for a header: only the sorted column carries it (WAI-ARIA APG). */
export function ariaSort(sorted: 'asc' | 'desc' | false): 'ascending' | 'descending' | undefined {
  if (!sorted) return undefined;
  return sorted === 'asc' ? 'ascending' : 'descending';
}

/** Inline style of a pinned cell: its sticky inset, from the start or the end edge. */
export function pinStyle(column: Pinnable & { offset: number }): string | undefined {
  return column.pin ? `--_pin-offset: ${String(column.offset)}px` : undefined;
}
