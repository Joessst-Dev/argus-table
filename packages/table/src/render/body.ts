import { html, nothing } from 'lit';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { RowState } from '@argus-table/core';
import type { RenderedColumn } from '../controllers/column-window.js';
import type { WindowRow } from '../controllers/virtual-controller.js';
import { cellParts, cellSlot, cellStyle, detailSlot, type CheckboxHandlers } from './content.js';

type Columns<T> = readonly RenderedColumn<T>[];

/** The rows' checkboxes in the selection column: their handlers and accessible name. */
export type RowCheckboxes = CheckboxHandlers & { label: string };

/** The chevrons of the toggle column (`rowDetail`): which rows have one, which are open, and their names. */
export interface RowToggles {
  /** Whether the row at an index can open a panel (loaded, allowed by `rowExpandable`). */
  expandable: (index: number) => boolean;
  /** Whether the row at an index has its panel open. */
  open: (index: number) => boolean;
  expandLabel: string;
  collapseLabel: string;
  /** Click handler of the chevrons; the button carries the row index in `data-row`. */
  onClick: (event: Event) => void;
  /** The id of the row's rendered panel row, for `aria-controls`; `undefined` while it isn't rendered. */
  controls: (index: number) => string | undefined;
}

/** The detail panels' rows (`rowDetail`): from their own pool, each a cell spanning every column. */
export interface DetailRows {
  rows: readonly WindowRow[];
  /** The number of shown columns, for `aria-colspan`. */
  colspan: number;
}

/** The `id` of the panel row in a slot of the panel pool, unique in the shadow root. */
export const detailRowId = (slot: number) => `argus-detail-${String(slot)}`;

/** The `data-col` of a panel's cell: the active cell's column while it is on a panel. */
export const PANEL_COLUMN = '--argus-detail';

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
  /** The Retry button's text. */
  retryText: string;
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
 * `inset`: rows of different heights (`rowHeight: 'auto'`) are placed with
 * `inset-block-start` and render at least their measured `size`, which is on
 * the controller's px grid, so they stay flush however far down they are.
 */
export function renderBody<T>(
  rows: readonly WindowRow[],
  columns: Columns<T>,
  totalSize: number,
  active: ActiveCell | undefined,
  firstRowIndex: number,
  loading?: Loading,
  selectedAt?: SelectedAt,
  checkboxes?: RowCheckboxes,
  inset = false,
  toggles?: RowToggles,
  details?: DetailRows,
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
          !r.idle && r.index === active?.index ? active.col : undefined,
          firstRowIndex,
          loading,
          r.idle ? undefined : selectedAt?.(r.row),
          checkboxes,
          inset,
          toggles,
        ),
    )}${
      details
        ? repeat(
            details.rows,
            (r) => r.slot,
            (r) =>
              renderDetailRow(
                r,
                details.colspan,
                !r.idle && r.index === active?.index,
                firstRowIndex,
                inset,
              ),
          )
        : nothing
    }
  </div>`;
}

/**
 * A detail panel's row: one cell over every column, holding the panel's content
 * (slotted by pool slot). It renders at least its measured height (`size`); its
 * cell is focusable and holds the tab stop while the active cell is on it.
 */
function renderDetailRow(
  row: WindowRow,
  colspan: number,
  tabStop: boolean,
  firstRowIndex: number,
  inset: boolean,
) {
  // One template whether the slot is in use or idle: Lit keeps the DOM, so the
  // slot element (and what is assigned to it) stays while scrolling.
  const idle = row.idle === true;
  return html`<div
    part=${idle ? nothing : 'row-detail'}
    class="row detail-row"
    role="row"
    ?hidden=${idle}
    id=${idle ? nothing : detailRowId(row.slot)}
    aria-rowindex=${idle ? nothing : row.index + firstRowIndex}
    style=${styleMap({
      ...(inset
        ? { insetBlockStart: `${String(row.start)}px` }
        : { transform: `translateY(${String(row.start)}px)` }),
      minBlockSize: row.size === undefined ? undefined : `${String(row.size)}px`,
    })}
  >
    <div
      part=${idle ? nothing : 'detail'}
      role="gridcell"
      aria-colspan=${colspan}
      tabindex=${tabStop ? 0 : -1}
      data-col=${PANEL_COLUMN}
    >
      <slot name=${detailSlot(row.slot)}></slot>
    </div>
  </div>`;
}

/**
 * One body row. Every cell is focusable (`tabindex=-1`) so clicks focus it; the
 * active one is the grid's single tab stop (roving tabindex). A row whose data
 * isn't loaded shows skeleton bars, and a Retry button if its page failed.
 * `selected` is `undefined` for a row that can't be selected: it then has no
 * `aria-selected`, and no checkbox in the selection column.
 */
function renderRow<T>(
  row: WindowRow,
  columns: Columns<T>,
  activeCol: string | undefined,
  firstRowIndex: number,
  loading: Loading | undefined,
  selected: boolean | undefined,
  checkboxes: RowCheckboxes | undefined,
  inset: boolean,
  toggles: RowToggles | undefined,
) {
  // Positions place the row in the grid; its data index reads its state. An idle
  // pool slot renders the same template, hidden: Lit keeps its DOM, so its cells'
  // slots (and what is assigned to them) stay while scrolling.
  const idle = row.idle === true;
  const index = row.row;
  const state = idle ? 'loaded' : (loading?.stateAt(index) ?? 'loaded');
  const open = !idle && (toggles?.open(index) ?? false);
  let parts = index % 2 === 0 ? 'row row-even' : 'row row-odd';
  if (state !== 'loaded') parts += state === 'error' ? ' row-loading row-error' : ' row-loading';
  if (selected) parts += ' row-selected';
  if (open) parts += ' row-expanded';
  const retry = state === 'error' ? loading?.retry.get(index) : undefined;
  // The Retry button goes in the first data column, after a selection column.
  const retryCol = retry === undefined ? undefined : firstDataColumn(columns);
  return html`<div
    part=${idle ? nothing : parts}
    class="row"
    role="row"
    ?hidden=${idle}
    aria-rowindex=${idle ? nothing : row.index + firstRowIndex}
    aria-busy=${state === 'loading' ? 'true' : nothing}
    aria-selected=${selected === undefined ? nothing : String(selected)}
    style=${styleMap(
      inset
        ? {
            insetBlockStart: `${String(row.start)}px`,
            minBlockSize: row.size === undefined ? undefined : `${String(row.size)}px`,
          }
        : { transform: `translateY(${String(row.start)}px)` },
    )}
  >
    ${repeat(
      columns,
      (c) => c.key,
      (c) =>
        renderCell(
          c,
          c.id === activeCol,
          cellSlot(row.slot, c.slot),
          false,
          c.kind === 'selection'
            ? rowCheckbox(index, selected, checkboxes)
            : c.kind === 'expand'
              ? rowToggle(index, open, state === 'loaded' ? toggles : undefined)
              : placeholder(state, c.id === retryCol ? retry : undefined, index, loading),
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
  c: RenderedColumn<T>,
  tabStop: boolean,
  slot: string,
  pinnedRow: boolean,
  before: unknown = nothing,
) {
  return html`<div
    part=${cellParts(c, pinnedRow)}
    role="gridcell"
    aria-colindex=${c.colIndex}
    aria-readonly=${c.readonly ? 'true' : nothing}
    tabindex=${tabStop ? 0 : -1}
    data-col=${c.id}
    data-align=${c.align}
    data-wrap=${c.wrap ? '' : nothing}
    data-pin=${c.pin ?? nothing}
    style=${cellStyle(c) ?? nothing}
  >
    ${before}<slot name=${slot}></slot>
  </div>`;
}

/**
 * The id of the leftmost rendered data column (in reading order). Rendered
 * columns are in pool order with `virtualizeColumns`.
 */
function firstDataColumn<T>(columns: Columns<T>): string | undefined {
  let first: RenderedColumn<T> | undefined;
  for (const c of columns) {
    if (c.kind === 'data' && (!first || c.colIndex < first.colIndex)) first = c;
  }
  return first?.id;
}

/**
 * A row's checkbox in the selection column, for a row that can be selected.
 * It isn't focusable: the cell holds focus. `live()` keeps it showing the
 * selection when a controlled host turns a change down.
 */
function rowCheckbox(
  index: number,
  selected: boolean | undefined,
  checkboxes: RowCheckboxes | undefined,
) {
  if (selected === undefined || !checkboxes) return nothing;
  return html`<input
    type="checkbox"
    part="selection-checkbox"
    tabindex="-1"
    aria-label=${checkboxes.label}
    data-row=${index}
    .checked=${live(selected)}
    @click=${checkboxes.row}
    @mousedown=${checkboxes.press}
  />`;
}

/**
 * A row's chevron in the toggle column, for a row that can open a panel. It
 * isn't focusable: the cell holds focus, and Enter or Space there toggles it.
 */
function rowToggle(index: number, open: boolean, toggles: RowToggles | undefined) {
  if (!toggles?.expandable(index)) return nothing;
  return html`<button
    type="button"
    part="expand-toggle"
    tabindex="-1"
    aria-expanded=${String(open)}
    aria-controls=${(open ? toggles.controls(index) : undefined) ?? nothing}
    aria-label=${open ? toggles.collapseLabel : toggles.expandLabel}
    data-row=${index}
    @click=${toggles.onClick}
  ></button>`;
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
      ${loading.retryText}
    </button>`;
  }
  return html`<div
    part=${state === 'error' ? 'skeleton skeleton-error' : 'skeleton'}
    aria-hidden="true"
  ></div>`;
}
