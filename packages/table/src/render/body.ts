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
 * Whether the row at an index is selected; `undefined` when it can't be
 * selected (selection is off, or the row hasn't loaded).
 */
export type SelectedAt = (index: number) => boolean | undefined;

/**
 * The virtualized body. Rows are keyed by pool slot, so a row entering the window
 * reuses the DOM of one that left (ADR 0001), and they stay in pool order: screen
 * readers get the position from `aria-rowindex`. `firstRowIndex` is the
 * `aria-rowindex` of row 0: after the header and the rows pinned to the top.
 */
export function renderBody<T>(
  rows: readonly WindowRow[],
  columns: Columns<T>,
  totalSize: number,
  active: ActiveCell | undefined,
  firstRowIndex: number,
  loading?: Loading,
  selectedAt?: SelectedAt,
) {
  return html`<div
    part="body"
    role="rowgroup"
    style=${styleMap({ blockSize: `${String(totalSize)}px` })}
  >
    ${repeat(
      rows,
      (r) => r.slot,
      (r) =>
        renderRow(
          r,
          columns,
          r.index === active?.index ? active.col : undefined,
          firstRowIndex,
          loading,
          selectedAt?.(r.index),
        ),
    )}
  </div>`;
}

/**
 * One body row. Every cell is focusable (`tabindex=-1`) so clicks focus it; the
 * active one is the grid's single tab stop (roving tabindex). A row whose data
 * isn't loaded shows skeleton bars, and a Retry button if its page failed.
 * `selected` is `undefined` for a row that can't be selected: it then has no
 * `aria-selected`.
 */
function renderRow<T>(
  row: WindowRow,
  columns: Columns<T>,
  activeCol: string | undefined,
  firstRowIndex: number,
  loading: Loading | undefined,
  selected: boolean | undefined,
) {
  const state = loading?.stateAt(row.index) ?? 'loaded';
  let parts = row.index % 2 === 0 ? 'row row-even' : 'row row-odd';
  if (state !== 'loaded') parts += ' row-loading';
  if (selected) parts += ' row-selected';
  const retry = state === 'error' ? loading?.retry.get(row.index) : undefined;
  return html`<div
    part=${parts}
    class="row"
    role="row"
    aria-rowindex=${row.index + firstRowIndex}
    aria-busy=${state === 'loading' ? 'true' : nothing}
    aria-selected=${selected === undefined ? nothing : String(selected)}
    style=${styleMap({ transform: `translateY(${String(row.start)}px)` })}
  >
    ${repeat(
      columns,
      (c) => c.id,
      (c) =>
        renderCell(
          c,
          c.id === activeCol,
          cellSlot(row.slot, c.colIndex),
          false,
          placeholder(state, c.colIndex === 1 ? retry : undefined, row.index, loading),
        ),
    )}
  </div>`;
}

/**
 * A body or pinned-row cell. Every cell is focusable (`tabindex=-1`) so clicks
 * focus it; `tabStop` marks the grid's single tab stop. `before` goes ahead of
 * the slot (a loading row's skeleton bar or Retry button).
 */
export function renderCell<T>(
  c: ColumnView<T, CellContent>,
  tabStop: boolean,
  slot: string,
  pinnedRow: boolean,
  before: unknown = nothing,
) {
  return html`<div
    part=${cellParts(c, pinnedRow)}
    role="gridcell"
    aria-colindex=${c.colIndex}
    tabindex=${tabStop ? 0 : -1}
    data-col=${c.id}
    data-align=${c.align}
    data-pin=${c.pin ?? nothing}
    style=${pinStyle(c) ?? nothing}
  >
    ${before}<slot name=${slot}></slot>
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
