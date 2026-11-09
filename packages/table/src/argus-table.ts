import {
  LitElement,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  clickSelection,
  controllable,
  RowLayout,
  sameSelection,
  selectRange,
  toggleRow,
  type ColumnReorderDetail,
  type ColumnResizeDetail,
  type ColumnView,
  type GridRow,
  type SelectionStep,
  type SelectionTarget,
  type TableModel,
} from '@argus-table/core';
import { announce } from './announce.js';
import { AutoWidths, measureColumns } from './controllers/auto-width.js';
import { ColumnChildrenController } from './controllers/column-children.js';
import { DataController } from './controllers/data-controller.js';
import { PinScrollController } from './controllers/pin-scroll-controller.js';
import {
  canStartReorder,
  dropTarget,
  startReorderDrag,
  type DropSlot,
} from './controllers/reorder-drag.js';
import { startResizeDrag } from './controllers/resize-drag.js';
import { TableController } from './controllers/table-controller.js';
import { VirtualController, type VirtualWindow } from './controllers/virtual-controller.js';
import {
  CELL_CLICK,
  COLUMN_REORDER,
  COLUMN_RESIZE,
  fire,
  LOAD_ERROR,
  RANGE_CHANGE,
  ROW_CLICK,
  ROW_SELECT,
  SORT_CHANGE,
} from './events.js';
import { fromInteractive } from './interactive.js';
import { bodyCap, watchMaxElementHeight } from './max-height.js';
import { renderBody, type ActiveCell, type Loading, type SelectedAt } from './render/body.js';
import { renderLightDom } from './render/cells.js';
import { renderHeader, type HeaderDrag } from './render/header.js';
import { renderPinnedRows } from './render/pinned-rows.js';
import { baseStyles } from './styles/base.js';
import type {
  CellContent,
  ColumnDef,
  ColumnOrderState,
  ColumnSizingState,
  DataSource,
  Density,
  PinnedRows,
  SelectionMode,
  SelectionState,
  SortState,
} from './types.js';

/**
 * The host carries the grid role, so rows rendered in the shadow root become
 * its children in the accessibility tree. ElementInternals sets the default;
 * `connectedCallback` also adds a `role` attribute, because tools such as
 * axe-core can't see the ElementInternals role. A `role` the page sets wins.
 */
function attachGridInternals(host: HTMLElement): ElementInternals {
  const internals = host.attachInternals();
  internals.role = 'grid';
  return internals;
}

/**
 * The sortable column a header click came from, if any. Works for slotted content
 * too. Clicks on a resize handle never sort, so a click that ends a drag doesn't.
 */
function sortColumnOf(event: Event): string | undefined {
  for (const target of event.composedPath()) {
    if (!(target instanceof HTMLElement)) continue;
    if (target.dataset.resizeCol !== undefined) return undefined;
    if (target.dataset.sortCol !== undefined) return target.dataset.sortCol;
    if (target.getAttribute('part') === 'header-row') return undefined;
  }
  return undefined;
}

const RESIZE_STEP = 10;

/**
 * The cell holding the grid's single tab stop: a row (its section, and its index
 * there: in the row model for the body, in its list for a pinned row) and a
 * column. `rowId` keeps it on the same body row when the order changes.
 */
interface Active extends GridRow {
  rowId: string | undefined;
  col: string;
}

const HEADER: GridRow = { section: 'header', index: 0 };

/** Where the rows sit in the grid: header, pinned top, body, pinned bottom. */
function layoutOf<T>(model: TableModel<T, CellContent>): RowLayout {
  return new RowLayout(model.pinnedCount('top'), model.rowCount, model.pinnedCount('bottom'));
}

/** The grid cell or column header an element is, if any. */
function gridCell(target: EventTarget): HTMLElement | undefined {
  if (!(target instanceof HTMLElement) || target.dataset.col === undefined) return undefined;
  const role = target.getAttribute('role');
  return role === 'gridcell' || role === 'columnheader' ? target : undefined;
}

/** The grid row a rendered row element is, from its `aria-rowindex`. */
function gridRowOf(row: Element | null, layout: RowLayout): GridRow | undefined {
  const index = row?.getAttribute('aria-rowindex');
  return index ? layout.fromAriaRowIndex(Number(index)) : undefined;
}

/**
 * The pinned edge's shadow, drawn once per side over the scroller rather than
 * per row: a shadow on every pinned cell repaints on every scroll frame. It
 * covers the pinned columns and casts `--argus-pinned-shadow` onto the rest;
 * PinScrollController sizes it to the visible area.
 */
function pinShadow(side: 'start' | 'end', width: number, rows: number, rowPx: number) {
  if (width === 0) return nothing;
  return html`<div
    class="pin-shadow"
    data-side=${side}
    aria-hidden="true"
    style=${styleMap({
      inlineSize: `${String(width)}px`,
      '--_content-h': `${String((rows + 1) * rowPx)}px`,
    })}
  ></div>`;
}

/** CSS grid track for a column: fixed px, or a flex share with the min width as floor. */
function track<T>(column: ColumnView<T, CellContent>): string {
  return column.flex === undefined
    ? `${String(column.width)}px`
    : `minmax(${String(column.minWidth)}px, ${String(column.flex)}fr)`;
}

/**
 * A virtualized data table.
 *
 * Set `columns`, and `data` or `dataSource`, as properties. Columns can also be
 * written as `<argus-column>` children; a non-empty `columns` wins over them.
 * Header and cell content is rendered into the element's light DOM and slotted
 * into the cells, so page CSS and the page's own components work inside cells.
 *
 * Any number of rows scrolls to the end. Browsers limit an element's height
 * (about 800k rows of 40 px in Chromium and Safari, 400k in Firefox), so a taller
 * body renders shorter and its scroll position is scaled onto the rows: the
 * scrollbar still spans every row, and a wheel step covers a few more of them.
 * Use `scrollToRow()` rather than setting the scroll container's `scrollTop`.
 *
 * @summary Data table with pinned rows and columns and infinite loading.
 *
 * @fires {CustomEvent<SortChangeDetail>} argus-sort-change - A sortable header was clicked, or activated with Enter or Space. `detail: { sorting }`: the new order, or the proposed one when `sorting` is controlled.
 * @fires {CustomEvent<ColumnResizeDetail>} argus-column-resize - A column was resized: by dragging its handle, with Alt+Arrow on its header, by a double-click on its handle (fit to content) or by `autosizeColumns()`. `detail: { columnId, width, sizing }`: the new widths, or the proposed ones when `columnSizing` is controlled. Fires on every frame of a drag, and once per column that `autosizeColumns()` changes.
 * @fires {CustomEvent<ColumnReorderDetail>} argus-column-reorder - A column was moved: by dragging its header, or with Alt+Shift+Arrow on its focused header. Columns move within their own group (start-pinned, scrolling, end-pinned). `detail: { columnId, order }`: the new order, or the proposed one when `columnOrder` is controlled. Fires once per move, on drop.
 * @fires {CustomEvent<CellClickDetail<T>>} argus-cell-click - A body or pinned-row cell was clicked, or Enter was pressed on it. `detail: { row, columnId, value, pinned? }`; `pinned` is `'top'` or `'bottom'` for a pinned row. Fires before `argus-row-click`.
 * @fires {CustomEvent<RowClickDetail<T>>} argus-row-click - A body or pinned row was clicked, or Enter was pressed on one of its cells. `detail: { row, rowId, index, pinned? }`; for a pinned row, `index` is its index in its list.
 * @fires {CustomEvent<RangeChangeDetail>} argus-range-change - The visible rows changed. `detail: { start, end }` (row indices, inclusive).
 * @fires {CustomEvent<RowSelectDetail>} argus-row-select - The selected rows changed: by a click on a row (Ctrl/Cmd toggles, Shift selects a range), with Space, Shift+Arrow or Shift+PageUp/PageDown on a body cell, or with Ctrl/Cmd+A. Only with a `selectionMode`. `detail: { selection }`: the new row ids, or the proposed ones when `selection` is controlled.
 * @fires {CustomEvent<LoadErrorDetail>} argus-load-error - A `dataSource` page failed to load: `getRows()` rejected or threw. `detail: { error, start, end }` (`end` exclusive). The rows show a Retry button.
 *
 * @slot empty - Shown instead of the body when there are no rows. Default: "No rows".
 *
 * @csspart table - The scroll container that holds header and body.
 * @csspart header - The sticky header row group.
 * @csspart header-row - The header row.
 * @csspart header-cell - Every header cell.
 * @csspart header-cell-sorted - The header of the sorted column. The direction is in `aria-sort`.
 * @csspart header-cell-dragging - Added to `header-cell` on the header being dragged to a new position.
 * @csspart drop-indicator - The line on the edge of the header where a dragged column would land.
 * @csspart resize-handle - The drag handle on the inline-end edge of a resizable column's header. A double-click fits the column to its content.
 * @csspart body - The row group holding the rendered body rows.
 * @csspart row - Every body row.
 * @csspart row-even - Body rows with an even index (0-based).
 * @csspart row-odd - Body rows with an odd index.
 * @csspart row-loading - Body rows whose `dataSource` page hasn't loaded yet, or failed.
 * @csspart row-selected - Body rows whose id is in `selection`.
 * @csspart row-pinned - Every row from `pinnedRows`, on either side. Also has `row`, but no `row-even`/`row-odd`.
 * @csspart row-pinned-top - The rows pinned below the header.
 * @csspart row-pinned-bottom - The rows pinned to the bottom.
 * @csspart cell-pinned-row - Every cell of a pinned row (next to `cell`).
 * @csspart cell - Every body cell.
 * @csspart cell-sorted - Body cells in the sorted column.
 * @csspart cell-pinned - Body cells in a pinned column, on either side.
 * @csspart cell-pinned-edge - The pinned body cell next to the scrolling columns (one per pinned side).
 * @csspart skeleton - The placeholder bar in each cell of a row that is still loading.
 * @csspart skeleton-error - Added to `skeleton` in a row whose page failed to load.
 * @csspart retry - The Retry button in the first cell of a failed page's first visible row.
 * @csspart empty - The empty-state container.
 *
 * @cssprop [--argus-bg=Canvas] - Background of the table and rows.
 * @cssprop [--argus-fg=CanvasText] - Text colour.
 * @cssprop [--argus-font=inherit] - Font shorthand for the table.
 * @cssprop [--argus-header-bg] - Header background.
 * @cssprop [--argus-header-fg=inherit] - Header text colour.
 * @cssprop [--argus-border-color] - Colour of the row borders.
 * @cssprop [--argus-border-width=1px] - Width of the row borders.
 * @cssprop [--argus-outline=none] - Border around the whole table, as a `border` shorthand (`1px solid …`). Inside the element's size.
 * @cssprop [--argus-radius=0] - Corner radius of the table. Header, rows and pinned columns are clipped to it.
 * @cssprop [--argus-row-height] - Height of a row. Default per density: 32px, 40px, 52px.
 * @cssprop [--argus-cell-padding-inline] - Inline padding of cells. Default per density: 8px, 12px, 16px.
 * @cssprop [--argus-row-stripe-bg] - Background of odd rows. Default: no stripes.
 * @cssprop [--argus-pinned-shadow] - Shadow on the pinned edge, as a `box-shadow` falling toward the end side (`4px 0 6px -4px …`). Mirrored for the end edge and in RTL; `none` removes it.
 * @cssprop [--argus-resize-handle-color] - Colour of the resize handle's line, shown on hover, focus and drag.
 * @cssprop [--argus-focus-ring=2px solid Highlight] - Outline of the focused header or cell.
 * @cssprop [--argus-drop-indicator-color=Highlight] - Colour of the line that marks where a dragged column would land.
 * @cssprop [--argus-row-hover-bg] - Background of the hovered row. Default: no change.
 * @cssprop [--argus-pinned-row-bg=var(--argus-bg)] - Background of the pinned rows, pinned columns included.
 * @cssprop [--argus-skeleton-bg] - Colour of the skeleton bars in rows still loading. Default: the text colour at low opacity.
 * @cssprop [--argus-row-selected-bg] - Background of selected rows, pinned columns included. Default: the system highlight colour, mixed into `--argus-bg`. It wins over `--argus-row-hover-bg`.
 */
@customElement('argus-table')
export class ArgusTable<T = unknown> extends LitElement {
  static override styles: CSSResultGroup = baseStyles;

  /**
   * Column definitions. Property only: functions can't be attributes. While empty,
   * the table reads its `<argus-column>` children instead. `null` or `undefined`
   * means `[]`.
   */
  @property({ attribute: false })
  get columns(): readonly ColumnDef<T>[] {
    return this.#columnsProp;
  }
  set columns(value: readonly ColumnDef<T>[] | null | undefined) {
    // Framework bindings set `undefined` when a prop goes away.
    this.#columnsProp = value ?? [];
  }

  /**
   * The rows to show. Replace the array to update; changes inside it aren't
   * detected. `null` or `undefined` means `[]`.
   */
  @property({ attribute: false })
  get data(): readonly T[] {
    return this.#dataProp;
  }
  set data(value: readonly T[] | null | undefined) {
    this.#dataProp = value ?? [];
  }

  /**
   * Loads rows page by page as they scroll into view, instead of `data`:
   * `{ getRows({ start, end, sorting, signal }), pageSize? }`, where `end` is
   * exclusive and `getRows` resolves to `{ rows, total? }`. Without a `total`,
   * the table grows as pages arrive and a short page marks the end. Sorting
   * happens on the server: a new order reloads from the top. While set, it wins
   * over `data`. Replace the object to change `getRows` or `pageSize`.
   */
  @property({ attribute: false })
  dataSource?: DataSource<T>;

  /**
   * Rows fixed below the header (`top`) and at the bottom of the view (`bottom`),
   * such as a totals row: `{ top?: T[], bottom?: T[] }`. They are separate
   * objects, not rows of `data`: columns read them the same way, but they are
   * never sorted and work the same with a `dataSource`. A `cell` function gets
   * `pinned: 'top' | 'bottom'` in its context. Replace the object to update.
   */
  @property({ attribute: false })
  pinnedRows?: PinnedRows<T>;

  /** Returns a stable id for a row. Default: the row's index (in `data`, or among all `dataSource` rows). */
  @property({ attribute: false })
  getRowId?: (row: T, index: number) => string;

  /** Row height in px. Unset: the density (or the `--argus-row-height` token) decides. */
  @property({ attribute: 'row-height', type: Number })
  rowHeight?: number;

  /** Row density: `compact`, `comfortable` or `spacious`. */
  @property({ reflect: true })
  density: Density = 'comfortable';

  /** Rows rendered above and below the visible ones. `null` or `undefined` means the default, 6. */
  @property({ type: Number })
  get overscan(): number {
    return this.#overscan;
  }
  set overscan(value: number | null | undefined) {
    this.#overscan = value ?? 6;
  }

  /**
   * The sort order, e.g. `[{ id: 'total', desc: true }]`; `[]` when unsorted. Unset,
   * the table keeps it itself and header clicks change it. Once set, it is
   * controlled: a click only fires `argus-sort-change` with the proposed order,
   * and nothing changes until you set the property. Set `undefined` to hand it back.
   */
  @property({ attribute: false })
  get sorting(): SortState {
    return this.#sorting.value;
  }
  set sorting(value: SortState | undefined) {
    // Lit wraps this accessor and requests the update with the old value.
    this.#sorting.set(value);
  }

  /**
   * Resized widths in px by column id, e.g. `{ name: 240 }`. A resized flex column
   * becomes fixed. Uncontrolled until set, like `sorting`: once set, a resize only
   * fires `argus-column-resize` with the proposed widths. `undefined` hands it back.
   */
  @property({ attribute: false })
  get columnSizing(): ColumnSizingState {
    return this.#sizing.value;
  }
  set columnSizing(value: ColumnSizingState | undefined) {
    this.#sizing.set(value);
  }

  /**
   * The column order: column ids as the table shows them, e.g.
   * `['id', 'total', 'customer']`. `[]` (the default) keeps the order of `columns`.
   * Each pin group (start-pinned, scrolling, end-pinned) takes its columns in this
   * order; unknown ids are ignored and columns it doesn't list follow the listed
   * ones of their group. After a move it holds every column id. Uncontrolled
   * until set, like `sorting`: once set, a move only fires `argus-column-reorder`
   * with the proposed order. `undefined` hands it back.
   */
  @property({ attribute: false })
  get columnOrder(): ColumnOrderState {
    return this.#order.value;
  }
  set columnOrder(value: ColumnOrderState | undefined) {
    this.#order.set(value);
  }

  /**
   * How rows can be selected: `none` (the default), `single` or `multi`. A click
   * on a body row selects it; in `multi` mode Ctrl/Cmd+click toggles a row,
   * Shift+click selects the range from the last clicked row, and Ctrl/Cmd+A
   * selects every row. Space toggles the focused row. Clicks on buttons, links
   * and inputs inside cells don't select. Pinned rows, and `dataSource` rows not
   * loaded yet, can't be selected.
   */
  @property({ attribute: 'selection-mode' })
  selectionMode: SelectionMode = 'none';

  /**
   * The selected rows, as row ids (from `getRowId`, or the row's index as a
   * string), e.g. `['p4', 'p7']`. Uncontrolled until set, like `sorting`: once
   * set, a click only fires `argus-row-select` with the proposed ids.
   * `undefined` hands it back. The table never drops ids on its own: they stay
   * through sorting, a new `data` or reloaded pages. With a `dataSource`,
   * Ctrl/Cmd+A selects the loaded rows only.
   */
  @property({ attribute: false })
  get selection(): SelectionState {
    return this.#selection.value;
  }
  set selection(value: SelectionState | undefined) {
    this.#selection.set(value);
  }

  #columnsProp: readonly ColumnDef<T>[] = [];
  #dataProp: readonly T[] = [];
  #overscan = 6;
  readonly #sorting = controllable<SortState>([]);
  readonly #sizing = controllable<ColumnSizingState>({});
  readonly #order = controllable<ColumnOrderState>([]);
  readonly #selection = controllable<SelectionState>([]);
  /** `selection` as a set, for the rows rendered; rebuilt when `selection` changes. */
  #selectedIds: { of: SelectionState; ids: ReadonlySet<string> } | undefined;
  /** The row a Shift range starts from: the last row clicked or toggled without Shift. */
  #anchor: string | undefined;
  /** A selection the table applied itself; its event fires once the update is done. */
  #appliedSelection: SelectionState | undefined;
  /** Moves the table applied itself, by column; their events fire once the update is done. */
  readonly #appliedReorders = new Map<string, ColumnReorderDetail>();
  /** The header being dragged to a new position, if any. */
  #drag: HeaderDrag | undefined;
  /** A move from the keyboard, announced once it has rendered: the column and its old position. */
  #announceMove: { id: string; from: number } | undefined;
  /** Resizes the table applied itself, by column; their events fire once the update is done. */
  readonly #appliedResizes = new Map<string, ColumnResizeDetail>();
  /** Measured widths of `width: 'auto'` columns. */
  readonly #autoWidths = new AutoWidths(() => {
    this.requestUpdate();
  });
  /** The auto widths last passed to the model; a change re-measures the pinned columns' offsets. */
  #pushedAutoWidths: ColumnSizingState | undefined;
  #autoWidthsChanged = false;
  /** A sort the table applied itself; its event fires once the update is done. */
  #appliedSort: SortState | undefined;
  readonly #internals = attachGridInternals(this);
  readonly #table = new TableController<T>();
  readonly #children = new ColumnChildrenController<T>(this);
  /** The columns last passed to the model: `columns`, or the `<argus-column>` children. */
  #columns: readonly ColumnDef<T>[] = [];
  #columnsChanged = false;
  #warnedColumns = false;
  /** End of the light-DOM part holding cell content, so later children stay outside it. */
  #contentEnd: Comment | undefined;
  readonly #data = new DataController<T>(this);
  /** Scroll back to the top after the update (a new sort order for a data source). */
  #scrollToTop = false;
  // Looked up lazily: the virtualizer's hostUpdated runs before firstUpdated.
  readonly #virtual = new VirtualController(this, () =>
    this.renderRoot.querySelector<HTMLElement>('[part~="table"]'),
  );
  readonly #pinScroll = new PinScrollController(this, () =>
    this.renderRoot.querySelector<HTMLElement>('[part~="table"]'),
  );
  #rowPx = 40;
  #probeObserver?: ResizeObserver;
  #window: VirtualWindow = { rows: [], totalSize: 0, range: null };
  #active: Active | undefined;
  /** Move focus to the active cell after the next update (keyboard navigation). */
  #focusPending = false;
  #lastRange = '';
  #unwatchMaxHeight: (() => void) | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'grid');
    if (this.hasUpdated) this.#observeProbe();
    // A zoom change changes the tallest body the engine renders.
    this.#unwatchMaxHeight = watchMaxElementHeight(() => {
      this.requestUpdate();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#probeObserver?.disconnect();
    this.#unwatchMaxHeight?.();
    this.#unwatchMaxHeight = undefined;
  }

  /**
   * `columns` when it has any, otherwise the `<argus-column>` children. Keeps its
   * identity while neither changes, so the model is only rebuilt on a change.
   */
  #effectiveColumns(): readonly ColumnDef<T>[] {
    if (this.columns.length === 0) return this.#children.defs;
    if (!this.#warnedColumns && this.#children.present) {
      this.#warnedColumns = true;
      console.warn(
        'argus-table: the columns property is set, so <argus-column> children are ignored.',
      );
    }
    return this.columns;
  }

  /**
   * The node the light-DOM content is rendered before. Lit's part then ends there,
   * so children appended later (an `<argus-column>`) never land inside it. If the
   * marker was removed (say by `innerHTML`), a new one starts a fresh part.
   */
  #lightDomEnd(): Comment {
    if (this.#contentEnd?.parentNode !== this) {
      this.#contentEnd = document.createComment('');
      this.append(this.#contentEnd);
    }
    return this.#contentEnd;
  }

  /**
   * With a `dataSource`, drops every loaded page and loads the rows in view
   * again, keeping the scroll position. With `data`, re-renders the cells (after
   * changing row objects in place). Resolves once the table has re-rendered;
   * reloaded rows arrive as their pages load.
   */
  async refresh(): Promise<void> {
    this.#data.refresh();
    this.requestUpdate();
    await this.updateComplete;
  }

  /**
   * Fits columns to their content: the header, the pinned rows and the body rows
   * rendered now (rows out of view aren't measured). It resizes them like a drag
   * would, so `argus-column-resize` fires for each column that changes, and with a
   * controlled `columnSizing` nothing changes until you set it. Without `ids`, fits
   * every resizable column; columns with `resizable: false` keep their width.
   * Resolves once the table has re-rendered.
   */
  async autosizeColumns(ids?: readonly string[]): Promise<void> {
    await this.updateComplete;
    const targets = this.#table.model.columns
      .filter((c) => c.resizable && (ids === undefined || ids.includes(c.id)))
      .map((c) => c.id);
    this.#requestResizes(measureColumns(this.renderRoot, targets));
    await this.updateComplete;
  }

  /** Scrolls so that the row at `index` (in the current row order) is at the top. */
  async scrollToRow(index: number): Promise<void> {
    await this.updateComplete;
    this.#virtual.scrollToIndex(index);
    await this.updateComplete;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    const columns = this.#effectiveColumns();
    this.#columnsChanged = columns !== this.#columns;
    this.#columns = columns;
    if (changed.has('dataSource') || changed.has('sorting') || changed.has('getRowId')) {
      this.#data.configure({
        source: this.dataSource,
        sorting: this.#sorting.value,
        getRowId: this.getRowId,
      });
      // A new order starts over from the first row, so show it.
      if (this.dataSource && this.hasUpdated && changed.has('sorting')) {
        this.#scrollToTop = !changed.has('dataSource');
      }
    }
    if (
      this.#columnsChanged ||
      changed.has('data') ||
      changed.has('getRowId') ||
      changed.has('sorting') ||
      changed.has('columnSizing') ||
      changed.has('columnOrder') ||
      changed.has('pinnedRows')
    ) {
      if (this.#columnsChanged) {
        this.#autoWidths.sync(columns.filter((c) => c.width === 'auto').map((c) => c.id));
      }
      this.#table.update({
        columns,
        data: this.data,
        getRowId: this.getRowId,
        sorting: this.#sorting.value,
        columnSizing: this.#sizing.value,
        columnOrder: this.#order.value,
        pinnedRows: this.pinnedRows,
      });
    }
    // A new page cache (new source, sort order or refresh) or none, and new measured widths.
    const autoWidths = this.#autoWidths.widths;
    this.#autoWidthsChanged = autoWidths !== this.#pushedAutoWidths;
    this.#pushedAutoWidths = autoWidths;
    this.#table.update({ remote: this.#data.rows, autoWidths });
    const model = this.#table.model;
    this.#reconcileActive(model);
    const active = this.#active;
    // -1 tells assistive tech the total is unknown (a data source still growing).
    const unknownTotal = this.#data.rows?.totalKnown === false;
    const layout = layoutOf(model);
    this.#internals.ariaRowCount = unknownTotal ? '-1' : String(layout.total);
    this.#internals.ariaColCount = String(model.columns.length);
    this.#internals.ariaMultiSelectable = this.#mode() === 'multi' ? 'true' : null;
    // The header and pinned rows scroll with the body, one row each.
    const extra = (1 + layout.top + layout.bottom) * this.#rowPx;
    this.#virtual.configure({
      count: model.rowCount,
      rowHeight: this.#rowPx,
      cap: bodyCap(model.rowCount * this.#rowPx, extra),
      overscan: Math.max(0, this.overscan),
      rowIdAt: (index) => this.#rowId(model, index),
      // The active body row stays rendered, so the tab stop and focus survive scrolling.
      keep:
        active?.section !== 'body' || active.rowId === undefined
          ? undefined
          : { id: active.rowId, index: active.index },
    });
  }

  protected override render(): TemplateResult {
    const model = this.#table.model;
    const columns = model.columns;
    this.#window = this.#virtual.computeWindow();
    const pinnedWidth = (side: 'start' | 'end') =>
      columns.reduce((sum, c) => (c.pin === side ? sum + c.width : sum), 0);
    const pinned = (side: 'start' | 'end') => `${String(pinnedWidth(side))}px`;
    const layout = layoutOf(model);
    const style: Record<string, string> = {
      '--_cols': columns.map(track).join(' '),
      '--_width': `${String(model.totalWidth)}px`,
      '--_pin-start': pinned('start'),
      '--_pin-end': pinned('end'),
      '--_pin-top-rows': String(layout.top),
      '--_pin-bottom-rows': String(layout.bottom),
    };
    const active = this.#active;
    const activeIn = (section: GridRow['section']): ActiveCell | undefined =>
      active?.section === section ? { index: active.index, col: active.col } : undefined;
    const firstIndex = (section: GridRow['section']) => layout.ariaRowIndex({ section, index: 0 });
    if (this.rowHeight !== undefined && this.rowHeight > 0) {
      style['--_row-height'] = `${String(this.rowHeight)}px`;
    }
    return html`<div
        part="table"
        role="presentation"
        style=${styleMap(style)}
        ?data-dragging=${this.#drag !== undefined}
        @keydown=${this.#onKeydown}
        @focusin=${this.#onFocusin}
        @mousedown=${this.#onMousedown}
        @click=${this.#onClick}
      >
        ${renderHeader(columns, this.#headerHandlers, activeIn('header')?.col, this.#drag)}
        ${renderPinnedRows('top', layout.top, columns, firstIndex('top'), activeIn('top'))}
        ${
          model.rowCount === 0
            ? html`<div part="empty"><slot name="empty">No rows</slot></div>`
            : renderBody(
                this.#window.rows,
                columns,
                this.#window.totalSize,
                activeIn('body'),
                firstIndex('body'),
                this.#loading(),
                this.#selectedAt(model),
              )
        }
        ${renderPinnedRows('bottom', layout.bottom, columns, firstIndex('bottom'), activeIn('bottom'))}
        <div class="probe" aria-hidden="true"></div>
      </div>
      ${pinShadow('start', pinnedWidth('start'), layout.total - 1, this.#rowPx)}
      ${pinShadow('end', pinnedWidth('end'), layout.total - 1, this.#rowPx)}`;
  }

  protected override firstUpdated(): void {
    this.#observeProbe();
    this.#measureRowHeight();
  }

  protected override updated(changed: PropertyValues<this>): void {
    const model = this.#table.model;
    renderLightDom(this, model, this.#window.rows, this.#lightDomEnd());
    this.#measureAutoWidths(model);
    if (this.#scrollToTop) {
      this.#scrollToTop = false;
      const scroller = this.renderRoot.querySelector<HTMLElement>('[part~="table"]');
      if (scroller) scroller.scrollTop = 0;
    }
    if (
      this.#columnsChanged ||
      changed.has('columnSizing') ||
      changed.has('columnOrder') ||
      this.#autoWidthsChanged
    ) {
      this.#pinScroll.measure();
    }
    if (this.#focusPending) {
      this.#focusPending = false;
      this.#focusActive();
    }
    if (changed.has('density') || changed.has('rowHeight')) this.#measureRowHeight();
    if (this.#appliedResizes.size > 0) {
      const details = [...this.#appliedResizes.values()];
      this.#appliedResizes.clear();
      for (const detail of details) fire(this, COLUMN_RESIZE, detail);
    }
    if (this.#announceMove) {
      this.#announceMoved(model, this.#announceMove);
      this.#announceMove = undefined;
    }
    if (this.#appliedReorders.size > 0) {
      const details = [...this.#appliedReorders.values()];
      this.#appliedReorders.clear();
      for (const detail of details) fire(this, COLUMN_REORDER, detail);
    }
    if (this.#appliedSort) {
      const sorting = this.#appliedSort;
      this.#appliedSort = undefined;
      fire(this, SORT_CHANGE, { sorting });
    }
    if (this.#appliedSelection) {
      const selection = this.#appliedSelection;
      this.#appliedSelection = undefined;
      fire(this, ROW_SELECT, { selection });
    }
    const { range } = this.#window;
    const key = range ? `${String(range.start)}:${String(range.end)}` : '';
    if (range && key !== this.#lastRange) {
      this.#lastRange = key;
      fire(this, RANGE_CHANGE, { start: range.start, end: range.end });
    }
    if (range) {
      // The rendered rows: visible plus overscan, end exclusive.
      const over = Math.max(0, this.overscan);
      this.#data.request(Math.max(0, range.start - over), range.end + 1 + over);
    }
    for (const detail of this.#data.takeErrors()) fire(this, LOAD_ERROR, detail);
  }

  /**
   * Measures the `width: 'auto'` columns once loaded body rows render, or right
   * away when there are no rows (the header and pinned rows only). While a data
   * source's first rows load, they keep the default width. A changed width
   * renders once more.
   */
  #measureAutoWidths(model: TableModel<T, CellContent>): void {
    const loaded = this.#window.rows.some((r) => model.rowAt(r.index) !== undefined);
    if (!loaded && model.rowCount > 0) return;
    if (this.#autoWidths.measure(this.renderRoot, model.columns, loaded)) this.requestUpdate();
  }

  /**
   * Loading state for the body while a data source is set: the state of each
   * row, and a Retry button on the first visible row of each failed page.
   */
  #loading(): Loading | undefined {
    const cache = this.#data.rows;
    if (!cache) return undefined;
    const top = this.#window.range?.start ?? 0;
    const firstByPage = new Map<number, number>();
    for (const { index } of this.#window.rows) {
      if (index < top || cache.stateAt(index) !== 'error') continue;
      const page = cache.pageOf(index);
      const first = firstByPage.get(page);
      if (first === undefined || index < first) firstByPage.set(page, index);
    }
    const retry = new Map<number, string>();
    for (const [page, index] of firstByPage) {
      const start = page * cache.pageSize;
      const end = Math.min(start + cache.pageSize, cache.rowCount);
      retry.set(index, `Retry loading rows ${String(start + 1)} to ${String(end)}`);
    }
    return { stateAt: (index) => cache.stateAt(index), retry, onRetry: this.#onRetry };
  }

  readonly #onRetry = (event: Event) => {
    const button = event.currentTarget as HTMLElement;
    // The button goes away with the retry; keep focus in the grid, on its cell.
    if (button.matches(':focus')) button.parentElement?.focus({ preventScroll: true });
    this.#data.retry(Number(button.dataset.row));
  };

  /**
   * A row's id. A data source row that hasn't loaded gets a stand-in: the
   * active cell's row id if it sits there (so its DOM and focus stay put), else
   * the index, which is also its real id when there is no `getRowId`.
   */
  #rowId(model: TableModel<T, CellContent>, index: number): string {
    const id = model.rowAt(index)?.id;
    if (id !== undefined) return id;
    const active = this.#active;
    if (active?.index === index && active.rowId !== undefined) return active.rowId;
    return this.#placeholderId(index);
  }

  /** The id of an unloaded row: its index, or a reserved string if `getRowId` makes the ids. */
  #placeholderId(index: number): string {
    return this.getRowId ? `\u0000${String(index)}` : String(index);
  }

  readonly #headerHandlers = {
    click: (event: MouseEvent) => {
      const id = sortColumnOf(event);
      if (id !== undefined) this.#requestSort(id);
    },
    pointerdown: (event: PointerEvent) => {
      if (event.button !== 0) return;
      const handle = event.composedPath()[0];
      if (!(handle instanceof HTMLElement)) return;
      const id = handle.dataset.resizeCol;
      const cell = handle.parentElement;
      if (id !== undefined && cell) {
        startResizeDrag(
          handle,
          event,
          cell.getBoundingClientRect().width,
          this.#direction(),
          (w) => {
            this.#requestResize(id, w);
          },
        );
        return;
      }
      this.#startReorder(event);
    },
    /** A double-click on a resize handle fits the column to its rendered content. */
    dblclick: (event: MouseEvent) => {
      const handle = event.composedPath()[0];
      const id = handle instanceof HTMLElement ? handle.dataset.resizeCol : undefined;
      if (id === undefined) return;
      this.#requestResizes(measureColumns(this.renderRoot, [id]));
    },
  };

  /**
   * Keys on a focused cell or header: arrows by cell, Home/End along the row,
   * PageUp/PageDown by a page of rows (the view scrolls with it), Ctrl+Home/End
   * (or Cmd) to the first header and the last cell. Keys from content inside a
   * cell (an input, a button) are left to that content.
   */
  readonly #onKeydown = (event: KeyboardEvent) => {
    const cell = gridCell(event.composedPath()[0] ?? event.target ?? this);
    const id = cell?.dataset.col;
    if (!cell || id === undefined) return;
    const scroller = event.currentTarget as HTMLElement;
    if (event.key === 'Tab' && event.shiftKey) {
      // Firefox makes the scroll container a tab stop, so Shift+Tab would stop
      // on it before leaving the grid. Take it out of the tab order for this
      // one move only: a tabindex there for good would expose it as a node of
      // its own between the grid and its rows.
      scroller.tabIndex = -1;
      // Put it back once focus has actually moved (a timer can run first).
      cell.addEventListener(
        'focusout',
        () => {
          scroller.removeAttribute('tabindex');
        },
        { once: true },
      );
      return;
    }
    const inHeader = cell.getAttribute('role') === 'columnheader';
    const { key } = event;
    const arrow = key === 'ArrowLeft' || key === 'ArrowRight';
    if (inHeader && arrow && event.altKey && event.shiftKey) {
      event.preventDefault();
      // Logical: the arrow pointing toward the inline end moves the column that way.
      const towardEnd = (key === 'ArrowRight') === (this.#direction() === 1);
      this.#moveByKey(id, towardEnd ? 1 : -1);
      return;
    }
    if (inHeader && event.altKey && arrow) {
      event.preventDefault();
      // Logical: the arrow pointing toward the inline end grows the column.
      const towardEnd = (key === 'ArrowRight') === (this.#direction() === 1);
      this.#requestResize(
        id,
        this.#currentWidth(id, cell) + (towardEnd ? RESIZE_STEP : -RESIZE_STEP),
      );
      return;
    }
    if (inHeader && (key === 'Enter' || key === ' ') && cell.dataset.sortCol !== undefined) {
      event.preventDefault();
      this.#requestSort(id);
      return;
    }
    if (this.#selectionKey(event, cell, id, inHeader, scroller)) return;
    // Ctrl (Cmd on macOS) only goes with Home and End: to the corners.
    const corner = event.ctrlKey || event.metaKey;
    if (event.altKey || event.shiftKey || (corner && key !== 'Home' && key !== 'End')) return;
    const model = this.#table.model;
    const layout = layoutOf(model);
    const from = inHeader ? HEADER : gridRowOf(cell.parentElement, layout);
    if (!from) return;
    if (!inHeader && key === 'Enter') {
      // Enter on a body cell does what a click does; on a failed row, it retries.
      event.preventDefault();
      if (from.section === 'body' && this.#data.stateAt(from.index) === 'error') {
        this.#data.retry(from.index);
      } else {
        this.#activate(event.composedPath());
      }
      return;
    }
    const columns = model.columns;
    // Rows step by grid position: header, pinned top, body, pinned bottom.
    let pos = layout.position(from);
    const last = layout.total - 1;
    let col = columns.findIndex((c) => c.id === id);
    switch (key) {
      case 'PageDown':
      case 'PageUp':
      case 'ArrowDown':
      case 'ArrowUp':
        pos = this.#verticalStep(key, pos, layout, scroller);
        break;
      case 'ArrowRight':
        col += this.#direction();
        break;
      case 'ArrowLeft':
        col -= this.#direction();
        break;
      case 'Home':
        col = 0;
        if (corner) {
          pos = 0;
          this.#virtual.scrollToEdge('start');
        }
        break;
      case 'End':
        col = columns.length - 1;
        if (corner) pos = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    const row = layout.at(pos) ?? HEADER;
    // PageUp/PageDown scroll by as many rows as focus moved, so the focused cell
    // keeps its place on screen. The ends clamp; focusing scrolls the rest of
    // the way. Through the virtualizer: a scaled body's px aren't rows.
    if (key.startsWith('Page') && from.section === 'body' && row.section === 'body') {
      this.#virtual.scrollBy((row.index - from.index) * this.#rowPx);
    }
    // Ctrl+End onto a bottom pinned row: show the end of the body too, as
    // Ctrl+Home shows its start.
    if (corner && key === 'End' && row.section === 'bottom') {
      this.#virtual.scrollToEdge('end');
    }
    const target = columns[Math.min(Math.max(col, 0), columns.length - 1)];
    if (target) this.#moveTo(row, target.id, model);
  };

  /**
   * The grid position ArrowUp/ArrowDown (one row) or PageUp/PageDown (a page of
   * the body) moves to from `pos`. PageDown from above the body lands a page
   * into it and stops at its last row; PageUp stays in the body.
   */
  #verticalStep(
    key: 'PageDown' | 'PageUp' | 'ArrowDown' | 'ArrowUp',
    pos: number,
    layout: RowLayout,
    scroller: HTMLElement,
  ): number {
    const bodyFirst = layout.position({ section: 'body', index: 0 });
    const bodyLast = bodyFirst + layout.body - 1;
    // Whole rows between the sticky header and pinned rows (each one row tall).
    const fit = Math.floor(scroller.clientHeight / this.#rowPx + 0.01);
    const page = Math.max(1, fit - 1 - layout.top - layout.bottom);
    switch (key) {
      case 'PageDown':
        return layout.body > 0 && pos <= bodyLast
          ? Math.min(Math.max(pos, bodyFirst - 1) + page, bodyLast)
          : pos;
      case 'PageUp':
        return layout.body > 0 && pos > bodyFirst
          ? Math.max(Math.min(pos, bodyLast + 1) - page, bodyFirst)
          : pos;
      case 'ArrowDown':
        return Math.min(pos + 1, layout.total - 1);
      case 'ArrowUp':
        return Math.max(pos - 1, 0);
    }
  }

  /**
   * Selection keys, with a `selectionMode`: Space (or Shift+Space) toggles the
   * focused body row; in `multi` mode, Shift+ArrowUp/ArrowDown and
   * Shift+PageUp/PageDown move focus through the body and select from the
   * anchor to it, and Ctrl/Cmd+A selects every row. `true` if it took the key.
   */
  #selectionKey(
    event: KeyboardEvent,
    cell: HTMLElement,
    col: string,
    inHeader: boolean,
    scroller: HTMLElement,
  ): boolean {
    const mode = this.#mode();
    if (mode === 'none' || event.altKey) return false;
    const { key } = event;
    const command = event.ctrlKey || event.metaKey;
    const model = this.#table.model;
    if (command && !event.shiftKey && key.toLowerCase() === 'a') {
      if (mode !== 'multi') return false;
      // Not the page's text: the rows.
      event.preventDefault();
      this.#requestSelection({ selection: model.selectableIds(), anchor: this.#anchor });
      return true;
    }
    if (inHeader || command) return false;
    const layout = layoutOf(model);
    const from = gridRowOf(cell.parentElement, layout);
    if (from?.section !== 'body') return false;
    if (key === ' ') {
      // Space would scroll the table.
      event.preventDefault();
      const id = model.rowAt(from.index)?.id;
      if (id !== undefined) this.#requestSelection(toggleRow(this.#selection.value, mode, id));
      return true;
    }
    if (
      !event.shiftKey ||
      mode !== 'multi' ||
      (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'PageDown' && key !== 'PageUp')
    ) {
      return false;
    }
    event.preventDefault();
    // A range stays in the body: the header and pinned rows can't be selected.
    const bodyFirst = layout.position({ section: 'body', index: 0 });
    const pos = this.#verticalStep(key, layout.position(from), layout, scroller);
    const to = layout.at(Math.min(Math.max(pos, bodyFirst), bodyFirst + layout.body - 1));
    if (to?.section !== 'body' || to.index === from.index) return true;
    if (key.startsWith('Page')) this.#virtual.scrollBy((to.index - from.index) * this.#rowPx);
    const fromId = model.rowAt(from.index)?.id;
    const anchor =
      this.#anchorAt(model) ??
      (fromId === undefined ? undefined : { id: fromId, index: from.index });
    if (anchor) {
      const idAt = (index: number) => model.rowAt(index)?.id;
      const selection = selectRange([], anchor.index, to.index, idAt, false);
      this.#requestSelection({ selection, anchor: anchor.id });
    }
    this.#moveTo(to, col, model);
    return true;
  }

  /** Focus that lands in a cell (a click, or content inside it) makes that cell active. */
  readonly #onFocusin = (event: FocusEvent) => {
    // Tab into the grid landed on the scroll container (Firefox makes it a tab
    // stop): move on to the grid's one tab stop, the active cell. Only when focus
    // came from outside the grid: coming from inside means the user is leaving,
    // and sending them back would trap the keyboard.
    const scroller = event.currentTarget as HTMLElement;
    if (event.composedPath()[0] === scroller) {
      const from = event.relatedTarget;
      if (!(from instanceof Node && scroller.contains(from))) {
        this.#focusPending = true;
        this.requestUpdate();
      }
      return;
    }
    for (const target of event.composedPath()) {
      const cell = gridCell(target);
      if (cell?.dataset.col !== undefined) {
        const model = this.#table.model;
        const row =
          cell.getAttribute('role') === 'columnheader'
            ? HEADER
            : gridRowOf(cell.parentElement, layoutOf(model));
        const { col } = cell.dataset;
        const prev = this.#active;
        if (
          row &&
          (row.section !== prev?.section || row.index !== prev.index || col !== prev.col)
        ) {
          this.#active = { ...row, rowId: this.#gridRowId(model, row), col };
          this.requestUpdate();
        }
        return;
      }
      if (target === event.currentTarget) return;
    }
  };

  /**
   * `argus-cell-click`, then `argus-row-click`, for clicks in the body; then,
   * with a `selectionMode`, the click selects its row.
   */
  readonly #onClick = (event: MouseEvent) => {
    const path = event.composedPath();
    this.#activate(path);
    const mode = this.#mode();
    const target = mode === 'none' ? undefined : this.#selectableRowOf(path);
    if (!target) return;
    const model = this.#table.model;
    this.#requestSelection(
      clickSelection(
        this.#selection.value,
        mode,
        target,
        this.#anchorAt(model),
        { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey },
        (index) => model.rowAt(index)?.id,
      ),
    );
  };

  /**
   * A Shift+press on a row in `multi` mode selects a range of rows, not the
   * page's text from the last click: no text selection, and the cell still
   * takes focus.
   */
  readonly #onMousedown = (event: MouseEvent) => {
    if (!event.shiftKey || event.button !== 0 || this.#mode() !== 'multi') return;
    const path = event.composedPath();
    if (!this.#selectableRowOf(path)) return;
    event.preventDefault();
    for (const target of path) {
      const cell = gridCell(target);
      if (cell) {
        cell.focus({ preventScroll: true });
        return;
      }
    }
  };

  /** `selectionMode`, with anything unknown read as `none`. */
  #mode(): SelectionMode {
    const mode = this.selectionMode;
    return mode === 'single' || mode === 'multi' ? mode : 'none';
  }

  /** Whether each rendered body row is selected; `undefined` without a `selectionMode`. */
  #selectedAt(model: TableModel<T, CellContent>): SelectedAt | undefined {
    if (this.#mode() === 'none') return undefined;
    const selection = this.#selection.value;
    if (this.#selectedIds?.of !== selection) {
      this.#selectedIds = { of: selection, ids: new Set(selection) };
    }
    const { ids } = this.#selectedIds;
    return (index) => {
      const id = model.rowAt(index)?.id;
      return id === undefined ? undefined : ids.has(id);
    };
  }

  /**
   * The loaded body row a pointer event is on, as a selection target. None for
   * the header, pinned rows, rows still loading, and presses on interactive
   * content in a cell (a button, a link, an input).
   */
  #selectableRowOf(path: readonly EventTarget[]): SelectionTarget | undefined {
    const row = path.find(
      (t): t is HTMLElement => t instanceof HTMLElement && t.getAttribute('role') === 'row',
    );
    if (!row || fromInteractive(path, row)) return undefined;
    const model = this.#table.model;
    const at = gridRowOf(row, layoutOf(model));
    if (at?.section !== 'body') return undefined;
    const id = model.rowAt(at.index)?.id;
    return id === undefined ? undefined : { id, index: at.index };
  }

  /** The anchor row and where it is now; `undefined` if it isn't in the rows (or not loaded). */
  #anchorAt(model: TableModel<T, CellContent>): SelectionTarget | undefined {
    const id = this.#anchor;
    const index = id === undefined ? undefined : model.indexOf(id);
    return id === undefined || index === undefined ? undefined : { id, index };
  }

  /**
   * Changes the selection through the controlled/uncontrolled rules, and moves
   * the anchor. A step that leaves the same rows selected fires nothing.
   */
  #requestSelection(step: SelectionStep | undefined): void {
    if (!step) return;
    this.#anchor = step.anchor;
    const old = this.#selection.value;
    if (sameSelection(step.selection, old)) return;
    const { value, applied } = this.#selection.request(step.selection);
    if (applied) {
      this.#appliedSelection = value;
      this.requestUpdate('selection', old);
    } else {
      fire(this, ROW_SELECT, { selection: value });
    }
  }

  /**
   * Fires `argus-cell-click` (when a cell is on the path), then `argus-row-click`,
   * for the body or pinned row on an event path. Clicks and Enter on a cell use
   * it. Rows that haven't loaded and the header fire nothing.
   */
  #activate(path: EventTarget[]): void {
    let columnId: string | undefined;
    for (const target of path) {
      if (!(target instanceof HTMLElement)) continue;
      const role = target.getAttribute('role');
      if (role === 'gridcell') columnId = target.dataset.col;
      if (role !== 'row') continue;
      const model = this.#table.model;
      const at = gridRowOf(target, layoutOf(model));
      if (!at || at.section === 'header') return;
      const { index } = at;
      if (at.section === 'body') {
        const row = model.rowAt(index);
        if (!row) return;
        if (columnId !== undefined) {
          fire(this, CELL_CLICK, {
            row: row.original,
            columnId,
            value: model.valueAt(index, columnId),
          });
        }
        fire(this, ROW_CLICK, { row: row.original, rowId: row.id, index });
        return;
      }
      const pinned = at.section;
      const row = model.pinnedRowAt(pinned, index);
      if (!row) return;
      if (columnId !== undefined) {
        fire(this, CELL_CLICK, {
          row: row.original,
          columnId,
          value: model.pinnedValueAt(pinned, index, columnId),
          pinned,
        });
      }
      fire(this, ROW_CLICK, { row: row.original, rowId: row.id, index, pinned });
      return;
    }
  }

  /** The id of a grid row: a body or pinned row's id; none for the header. */
  #gridRowId(model: TableModel<T, CellContent>, row: GridRow): string | undefined {
    switch (row.section) {
      case 'header':
        return undefined;
      case 'body':
        return this.#rowId(model, row.index);
      default:
        return model.pinnedRowAt(row.section, row.index)?.id;
    }
  }

  /** Makes a cell active and focuses it after the update. The keep-rendered rule renders its row. */
  #moveTo(row: GridRow, col: string, model: TableModel<T, CellContent>): void {
    this.#active = { ...row, rowId: this.#gridRowId(model, row), col };
    this.#focusPending = true;
    this.requestUpdate();
  }

  #focusActive(): void {
    const active = this.#active;
    if (!active) return;
    const col = CSS.escape(active.col);
    // aria-rowindex is unique across the grid: header, pinned and body rows.
    const index = layoutOf(this.#table.model).ariaRowIndex(active);
    const cell = this.renderRoot.querySelector<HTMLElement>(
      `[role='row'][aria-rowindex="${String(index)}"] > [data-col="${col}"]`,
    );
    if (!cell) return;
    cell.focus({ preventScroll: true });
    // A scaled body moves `ratio` px of rows per px scrolled, so the browser can't
    // scroll a body row into view: the virtualizer does, and the next update
    // (from its scroll) shows the row and scrolls sideways.
    if (active.section === 'body' && this.#virtual.scaled) {
      const layout = layoutOf(this.#table.model);
      const before = (1 + layout.top) * this.#rowPx;
      if (this.#virtual.reveal(active.index, before, layout.bottom * this.#rowPx)) {
        this.#focusPending = true;
        return;
      }
    }
    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /**
   * Keeps the active cell valid after columns or rows change. In the body: on the
   * same row id when it still exists (it may have moved), else at the same
   * index, clamped. A data source row that isn't loaded (yet, or any more) keeps
   * its id. A pinned row stays at its index, clamped to its list. A row whose
   * section has no rows left gives way to the header, the default. If its row
   * went away while the grid had focus, focus follows to the replacement.
   */
  #reconcileActive(model: TableModel<T, CellContent>): void {
    const columns = model.columns;
    const first = columns[0];
    if (!first) {
      this.#active = undefined;
      return;
    }
    const prev = this.#active ?? { ...HEADER, rowId: undefined, col: first.id };
    const col = columns.some((c) => c.id === prev.col) ? prev.col : first.id;
    let { section, index, rowId } = prev;
    let moved = false;
    if (section === 'body' && rowId !== undefined) {
      const found = model.indexOf(rowId);
      const unloaded = index < model.rowCount && model.rowAt(index) === undefined;
      if (found !== undefined) {
        index = found;
      } else if (!unloaded) {
        index = Math.min(index, model.rowCount - 1);
        rowId = index >= 0 ? (model.rowAt(index)?.id ?? this.#placeholderId(index)) : undefined;
        moved = true;
      }
    } else if (section === 'top' || section === 'bottom') {
      const count = model.pinnedCount(section);
      if (index >= count) {
        index = count - 1;
        moved = true;
      }
      rowId = index >= 0 ? model.pinnedRowAt(section, index)?.id : undefined;
    }
    if (index < 0) {
      ({ section, index } = HEADER);
      rowId = undefined;
    }
    if (moved && this.matches(':focus-within')) this.#focusPending = true;
    if (
      section !== prev.section ||
      index !== prev.index ||
      rowId !== prev.rowId ||
      col !== prev.col ||
      !this.#active
    ) {
      this.#active = { section, index, rowId, col };
    }
  }

  /**
   * The width a resize starts from: the latest requested width (key presses can
   * come faster than renders), else the model's fixed width, else the rendered
   * width of a flex column.
   */
  #currentWidth(columnId: string, cell: HTMLElement): number {
    const sized = this.#sizing.value[columnId];
    if (sized !== undefined) return sized;
    const view = this.#table.model.columns.find((c) => c.id === columnId);
    return view && view.flex === undefined ? view.width : cell.getBoundingClientRect().width;
  }

  #direction(): 1 | -1 {
    return getComputedStyle(this).direction === 'rtl' ? -1 : 1;
  }

  /** Sets one column's width (clamped by core), through the controlled/uncontrolled rules. */
  #requestResize(columnId: string, width: number): void {
    this.#requestResizes(new Map([[columnId, width]]));
  }

  /**
   * Sets column widths (clamped by core) in one change, through the
   * controlled/uncontrolled rules. One `argus-column-resize` per column that
   * changes, each with the whole new sizing.
   */
  #requestResizes(widths: ReadonlyMap<string, number>): void {
    const model = this.#table.model;
    const old = this.#sizing.value;
    const targets: [string, number][] = [];
    for (const [columnId, width] of widths) {
      const target = model.nextSizing(columnId, width)?.[columnId];
      if (target !== undefined && target !== old[columnId]) targets.push([columnId, target]);
    }
    if (targets.length === 0) return;
    const { value, applied } = this.#sizing.request({ ...old, ...Object.fromEntries(targets) });
    const details = targets.map(([columnId, width]) => ({ columnId, width, sizing: value }));
    if (applied) {
      // Only the latest width per column fires, all with the latest sizing.
      for (const detail of this.#appliedResizes.values()) detail.sizing = value;
      for (const detail of details) this.#appliedResizes.set(detail.columnId, detail);
      this.requestUpdate('columnSizing', old);
    } else {
      for (const detail of details) fire(this, COLUMN_RESIZE, detail);
    }
  }

  /**
   * Moves a column to position `to` in the whole order (within its pin group),
   * through the controlled/uncontrolled rules. Starts from the latest requested
   * order, so moves can come faster than renders. `false` if it can't move there.
   */
  #requestReorder(columnId: string, to: number): boolean {
    const old = this.#order.value;
    const next = this.#table.model.nextOrder(columnId, to, old);
    if (!next) return false;
    const { value, applied } = this.#order.request(next);
    if (applied) {
      for (const detail of this.#appliedReorders.values()) detail.order = value;
      this.#appliedReorders.set(columnId, { columnId, order: value });
      this.requestUpdate('columnOrder', old);
    } else {
      fire(this, COLUMN_REORDER, { columnId, order: value });
    }
    return true;
  }

  /** Alt+Shift+Arrow on a header: one step toward the start (-1) or the end (1). */
  #moveByKey(columnId: string, step: 1 | -1): void {
    const model = this.#table.model;
    const from = model.orderOf(this.#order.value).indexOf(columnId);
    const view = model.columns.find((c) => c.id === columnId);
    if (from < 0 || !view) return;
    if (!this.#requestReorder(columnId, from + step)) return;
    // The header node moves, which drops its focus: focus it again once rendered.
    this.#focusPending = true;
    this.#announceMove ??= { id: columnId, from: view.colIndex };
    this.requestUpdate();
  }

  /** Tells screen readers where a column moved from the keyboard went. */
  #announceMoved(model: TableModel<T, CellContent>, move: { id: string; from: number }): void {
    const view = model.columns.find((c) => c.id === move.id);
    if (!view || view.colIndex === move.from) return;
    const header = this.renderRoot.querySelector(
      `[role='columnheader'][data-col="${CSS.escape(move.id)}"] > slot`,
    );
    const name =
      header instanceof HTMLSlotElement
        ? header
            .assignedNodes({ flatten: true })
            .map((n) => n.textContent)
            .join('')
            .trim()
        : '';
    announce(
      this.ownerDocument,
      `${name || move.id} moved to column ${String(view.colIndex)} of ${String(model.columns.length)}`,
    );
  }

  /** A press on a reorderable header: becomes a drag once the pointer moves. */
  #startReorder(down: PointerEvent): void {
    const cell = down
      .composedPath()
      .find(
        (t): t is HTMLElement =>
          t instanceof HTMLElement && t.getAttribute('role') === 'columnheader',
      );
    const columnId = cell?.dataset.moveCol;
    if (!cell || columnId === undefined || !canStartReorder(down, cell)) return;
    const scroller = this.renderRoot.querySelector<HTMLElement>('[part~="table"]');
    if (!scroller) return;
    const pin = this.#table.model.columns.find((c) => c.id === columnId)?.pin;
    startReorderDrag(cell, down, {
      scroller,
      targetAt: (x) => dropTarget(this.#dropSlots(pin), columnId, x, this.#direction()),
      scrollArea: () => (pin === undefined ? this.#scrollArea(scroller) : undefined),
      onStart: () => {
        this.#drag = { columnId, target: undefined };
        this.requestUpdate();
      },
      onTarget: (target) => {
        this.#drag = { columnId, target };
        this.requestUpdate();
      },
      onDrop: (target) => {
        this.#drag = undefined;
        if (target && this.#requestReorder(columnId, target.to)) {
          // The header node moves, which drops its focus: focus it again once rendered.
          if (this.matches(':focus-within')) this.#focusPending = true;
        }
        this.requestUpdate();
      },
      onCancel: () => {
        this.#drag = undefined;
        this.requestUpdate();
      },
    });
  }

  /** The rendered headers of one pin group, with their positions in the whole order. */
  #dropSlots(pin: ColumnView<T, CellContent>['pin']): DropSlot[] {
    const slots: DropSlot[] = [];
    this.#table.model.columns.forEach((c, index) => {
      if (c.pin !== pin) return;
      const cell = this.renderRoot.querySelector(
        `[role='columnheader'][data-col="${CSS.escape(c.id)}"]`,
      );
      if (cell) slots.push({ id: c.id, index, rect: cell.getBoundingClientRect() });
    });
    return slots;
  }

  /** Where the scrolling columns show: the scroller's inside, less the pinned columns. */
  #scrollArea(scroller: HTMLElement): { left: number; right: number } {
    const columns = this.#table.model.columns;
    const width = (side: 'start' | 'end') =>
      columns.reduce((sum, c) => (c.pin === side ? sum + c.width : sum), 0);
    const ltr = this.#direction() === 1;
    const left = scroller.getBoundingClientRect().left + scroller.clientLeft;
    return {
      left: left + width(ltr ? 'start' : 'end'),
      right: left + scroller.clientWidth - width(ltr ? 'end' : 'start'),
    };
  }

  /** asc → desc → unsorted, through the controlled/uncontrolled rules. */
  #requestSort(columnId: string): void {
    const next = this.#table.model.nextSorting(columnId);
    if (!next) return;
    const old = this.#sorting.value;
    const { value, applied } = this.#sorting.request(next);
    if (applied) {
      this.#appliedSort = value;
      this.requestUpdate('sorting', old);
    } else {
      fire(this, SORT_CHANGE, { sorting: value });
    }
  }

  #observeProbe(): void {
    const probe = this.renderRoot.querySelector('.probe');
    if (!probe) return;
    this.#probeObserver ??= new ResizeObserver(() => {
      this.#measureRowHeight();
    });
    this.#probeObserver.observe(probe);
  }

  /** Reads the resolved row height, so themes and density change the virtualizer too. */
  #measureRowHeight(): void {
    const probe = this.renderRoot.querySelector('.probe');
    const px = probe?.getBoundingClientRect().height ?? 0;
    if (px > 0 && Math.abs(px - this.#rowPx) > 0.01) {
      this.#rowPx = px;
      this.requestUpdate();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'argus-table': ArgusTable;
  }
}
