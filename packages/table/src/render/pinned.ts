import { html, nothing, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { ColumnView } from '@argus-table/core';
import type { CellContent } from '../types.js';

type Columns<T> = readonly ColumnView<T, CellContent>[];

interface Split<T> {
  start: Columns<T>;
  center: Columns<T>;
  end: Columns<T>;
}

// Columns arrive in visual order (start, center, end) and the array is stable
// between renders that don't change columns, so the split is cached per array.
const splits = new WeakMap<object, Split<unknown>>();

function split<T>(columns: Columns<T>): Split<T> {
  let s = splits.get(columns) as Split<T> | undefined;
  if (!s) {
    s = {
      start: columns.filter((c) => c.pin === 'start'),
      center: columns.filter((c) => !c.pin),
      end: columns.filter((c) => c.pin === 'end'),
    };
    splits.set(columns, s as Split<unknown>);
  }
  return s;
}

/**
 * Renders a row's cells. Pinned cells are wrapped in one sticky group per side
 * (a subgrid over their columns), so a row has at most two sticky boxes instead
 * of one per pinned cell. The groups have no role, so the accessibility tree
 * still sees the cells as direct children of the row.
 *
 * `grouped: false` is the per-cell sticky layout, kept only to compare the two
 * in the benchmark; it goes away once the comparison is done.
 */
export function renderCells<T>(
  columns: Columns<T>,
  cell: (column: ColumnView<T, CellContent>) => TemplateResult,
  grouped: boolean,
) {
  if (!grouped) return repeat(columns, (c) => c.id, cell);
  const { start, center, end } = split(columns);
  return html`${
    start.length
      ? html`<div class="pin-group" data-pin="start" style="grid-column: 1 / span ${start.length}">
          ${repeat(start, (c) => c.id, cell)}
        </div>`
      : nothing
  }${repeat(center, (c) => c.id, cell)}${
    end.length
      ? html`<div class="pin-group" data-pin="end" style="grid-column: span ${end.length} / -1">
          ${repeat(end, (c) => c.id, cell)}
        </div>`
      : nothing
  }`;
}
