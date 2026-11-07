import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { ColumnView, RowState } from '@argus-table/core';
import type { WindowRow } from '../controllers/virtual-controller.js';
import type { CellContent } from '../types.js';
import { cellParts, cellSlot, pinStyle } from './content.js';

type Columns<T> = readonly ColumnView<T, CellContent>[];

/** The cell holding the grid's tab stop: a row index and a column id. */
export interface ActiveCell {
  index: number;
  col: string;
}

/** Row loading state for `dataSource` tables. */
export interface Loading {
  /** Whether a row's data is loaded, still loading, or its page failed. */
  stateAt(index: number): RowState;
  /** Rows that show a Retry button (one per failed page in view), with its accessible label. */
  retry: ReadonlyMap<number, string>;
  /** Click handler of the Retry buttons; the button carries the row index in `data-row`. */
  onRetry: (event: Event) => void;
}

/**
 * The virtualized body. Rows are keyed by pool slot, so a row entering the window
 * reuses the DOM of one that left (ADR 0001), and they stay in pool order: screen
 * readers get the position from `aria-rowindex` (the header row is 1).
 */
export function renderBody<T>(
  rows: readonly WindowRow[],
  columns: Columns<T>,
  totalSize: number,
  active: ActiveCell | undefined,
  loading?: Loading,
) {
  return html`<div
    part="body"
    role="rowgroup"
    style=${styleMap({ blockSize: `${String(totalSize)}px` })}
  >
    ${repeat(
      rows,
      (r) => r.slot,
      (r) => renderRow(r, columns, r.index === active?.index ? active.col : undefined, loading),
    )}
  </div>`;
}

/**
 * One body row. Every cell is focusable (`tabindex=-1`) so clicks focus it; the
 * active one is the grid's single tab stop (roving tabindex). A row whose data
 * isn't loaded shows skeleton bars, and a Retry button if its page failed.
 */
function renderRow<T>(
  row: WindowRow,
  columns: Columns<T>,
  activeCol: string | undefined,
  loading: Loading | undefined,
) {
  const state = loading?.stateAt(row.index) ?? 'loaded';
  let parts = row.index % 2 === 0 ? 'row row-even' : 'row row-odd';
  if (state !== 'loaded') parts += ' row-loading';
  const retry = state === 'error' ? loading?.retry.get(row.index) : undefined;
  return html`<div
    part=${parts}
    class="row"
    role="row"
    aria-rowindex=${row.index + 2}
    aria-busy=${state === 'loading' ? 'true' : nothing}
    style=${styleMap({ transform: `translateY(${String(row.start)}px)` })}
  >
    ${repeat(
      columns,
      (c) => c.id,
      (c) =>
        html`<div
          part=${cellParts(c)}
          role="gridcell"
          aria-colindex=${c.colIndex}
          tabindex=${c.id === activeCol ? 0 : -1}
          data-col=${c.id}
          data-align=${c.align}
          data-pin=${c.pin ?? nothing}
          style=${pinStyle(c) ?? nothing}
        >
          ${placeholder(state, c.colIndex === 1 ? retry : undefined, row.index, loading)}
          <slot name=${cellSlot(row.slot, c.colIndex)}></slot>
        </div>`,
    )}
  </div>`;
}

/** What an unloaded cell shows: a skeleton bar, or the Retry button in a failed page's first cell. */
function placeholder(
  state: RowState,
  retryLabel: string | undefined,
  index: number,
  loading: Loading | undefined,
) {
  if (state === 'loaded') return nothing;
  if (retryLabel !== undefined && loading) {
    return html`<button
      part="retry"
      type="button"
      tabindex="-1"
      data-row=${index}
      aria-label=${retryLabel}
      @click=${loading.onRetry}
    >
      Retry
    </button>`;
  }
  return html`<div
    part=${state === 'error' ? 'skeleton skeleton-error' : 'skeleton'}
    aria-hidden="true"
  ></div>`;
}
