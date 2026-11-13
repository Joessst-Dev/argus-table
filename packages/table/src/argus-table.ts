import {
  LitElement,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type RootPart,
  type TemplateResult,
} from 'lit';
import type { ComplexAttributeConverter } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  alignOffset,
  clickSelection,
  controllable,
  groupKey,
  RowLayout,
  sameUnit,
  spreadWidth,
  sameSelection,
  selectAll,
  selectRange,
  SELECTION_COLUMN_ID,
  toggleRow,
  type ColumnFiltersChangeDetail,
  type ColumnVisibilityChangeDetail,
  type ColumnPinningChangeDetail,
  type ColumnOrderChangeDetail,
  type ColumnSizingChangeDetail,
  type ColumnView,
  type Controllable,
  type GridRow,
  type OrderUnit,
  type SelectionStep,
  type SelectionTarget,
  type TableModel,
} from '@argus-table/core';
import { announce } from './announce.js';
import { AutoWidths, measureColumns } from './controllers/auto-width.js';
import { ColumnChildrenController } from './controllers/column-children.js';
import { ColumnWindowController, type RenderedColumn } from './controllers/column-window.js';
import { DataController } from './controllers/data-controller.js';
import { PinScrollController } from './controllers/pin-scroll-controller.js';
import { PluginController, sameItems } from './controllers/plugins.js';
import { RowMeasure } from './controllers/row-measure.js';
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
  COLUMN_FILTERS_CHANGE,
  COLUMN_ORDER_CHANGE,
  COLUMN_PINNING_CHANGE,
  COLUMN_SIZING_CHANGE,
  COLUMN_VISIBILITY_CHANGE,
  fire,
  LOAD_ERROR,
  RANGE_CHANGE,
  ROW_CLICK,
  SELECTION_CHANGE,
  SORTING_CHANGE,
} from './events.js';
import { fromInteractive, INTERACTIVE } from './interactive.js';
import { resolveLabels, type TableLabels } from './labels.js';
import { bodyCap, watchMaxElementHeight } from './max-height.js';
import { renderBody, type ActiveCell, type Loading, type SelectedAt } from './render/body.js';
import { renderLightDom } from './render/cells.js';
import { content, flushContent, type ContentRenderer } from './render/content-directive.js';
import { columnKey, renderHeader, type CheckAll, type HeaderDrag } from './render/header.js';
import type { CheckboxHandlers } from './render/content.js';
import { renderPinnedRows } from './render/pinned-rows.js';
import type { ArgusPlugin, CellTarget, ColumnInfo, PluginHost } from './plugins.js';
import { baseStyles } from './styles/base.js';
import { switchConverter } from './attributes.js';
import type {
  CellContent,
  ColumnDef,
  ColumnFilter,
  ColumnGroup,
  ColumnFilterState,
  ColumnOrderState,
  ColumnPin,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
  DataSource,
  Density,
  PinnedRows,
  RowTarget,
  ScrollAlign,
  ScrollToColumnOptions,
  ScrollToRowOptions,
  SelectionMode,
  SelectionState,
  SortDirection,
  SortState,
  TableState,
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
 * too. Clicks on a resize handle never sort, so a click that ends a drag doesn't,
 * and neither do clicks on interactive content in the header (a button, an input).
 */
function sortColumnOf(event: Event): string | undefined {
  for (const target of event.composedPath()) {
    if (!(target instanceof HTMLElement)) continue;
    if (target.dataset.resizeCol !== undefined) return undefined;
    if (target.matches(INTERACTIVE)) return undefined;
    if (target.dataset.sortCol !== undefined) return target.dataset.sortCol;
    if (target.getAttribute('role') === 'row') return undefined;
  }
  return undefined;
}

const RESIZE_STEP = 10;

/** `row-height`: px (`48` or `48px`) or `auto`; anything else is unset. */
const rowHeightConverter: ComplexAttributeConverter<number | 'auto' | undefined> = {
  fromAttribute(value) {
    if (value === null) return undefined;
    const text = value.trim().toLowerCase();
    if (text === 'auto') return 'auto';
    const px = Number(text.replace(/px$/, ''));
    return text !== '' && px > 0 ? px : undefined;
  },
};

/**
 * The cell holding the grid's single tab stop: a row (its section, and its index
 * there: in the row model for the body, in its list for a pinned row) and a
 * column. `rowId` keeps it on the same body row when the order changes.
 */
interface Active extends GridRow {
  rowId: string | undefined;
  col: string;
}

/** Where the rows sit in the grid: header rows, pinned top, body, pinned bottom. */
function layoutOf<T>(model: TableModel<T, CellContent>): RowLayout {
  return new RowLayout(
    model.pinnedCount('top'),
    model.rowCount,
    model.pinnedCount('bottom'),
    model.headerRows,
  );
}

/** The drop slot and applied-move key of a column or group (`HeaderDrag.key`). */
function unitKey(unit: OrderUnit): string {
  return unit.kind === 'column' ? columnKey(unit.id) : groupKey(unit.id, unit.pin);
}

/** The grid cell or column header an element is, if any. */
function gridCell(target: EventTarget): HTMLElement | undefined {
  if (!(target instanceof HTMLElement) || target.dataset.col === undefined) return undefined;
  const role = target.getAttribute('role');
  return role === 'gridcell' || role === 'columnheader' ? target : undefined;
}

/** The column group header an element is, if any. */
function groupCell(target: EventTarget): HTMLElement | undefined {
  return target instanceof HTMLElement && target.dataset.groupKey !== undefined
    ? target
    : undefined;
}

/** The grid row a rendered row element is, from its `aria-rowindex`. */
function gridRowOf(row: Element | null, layout: RowLayout): GridRow | undefined {
  const index = row?.getAttribute('aria-rowindex');
  return index ? layout.fromAriaRowIndex(Number(index)) : undefined;
}

/** The grid row a cell or column header is in. */
function gridRowOfCell(cell: HTMLElement, layout: RowLayout): GridRow | undefined {
  return gridRowOf(cell.parentElement, layout);
}

/**
 * The pinned edge's shadow, drawn once per side over the scroller rather than
 * per row: a shadow on every pinned cell repaints on every scroll frame. It
 * covers the pinned columns and casts `--argus-pinned-shadow` onto the rest;
 * PinScrollController sizes it to the visible area.
 */
function pinShadow(side: 'start' | 'end', width: number, contentPx: number) {
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
function track<T>(column: ColumnView<T, CellContent>): string {
  return column.flex === undefined
    ? `${String(column.width)}px`
    : `minmax(${String(column.minWidth)}px, ${String(column.flex)}fr)`;
}

/** Total width of the columns pinned to one side. */
function pinnedWidth<T>(
  columns: readonly ColumnView<T, CellContent>[],
  side: 'start' | 'end',
): number {
  return columns.reduce((sum, c) => (c.pin === side ? sum + c.width : sum), 0);
}

/**
 * A virtualized data table.
 *
 * Set `columns`, and `data` or `dataSource`, as properties. Columns can also be
 * written as `<argus-column>` children; a non-empty `columns` wins over them.
 * `columnGroups` (or `<argus-column-group>` children) adds headers over several
 * columns, a header row per level of nesting.
 * Header and cell content is rendered into the element's light DOM and slotted
 * into the cells, so page CSS and the page's own components work inside cells.
 *
 * Any number of rows scrolls to the end. Browsers limit an element's height
 * (about 800k rows of 40 px in Chromium and Safari, 400k in Firefox), so a taller
 * body renders shorter and its scroll position is scaled onto the rows: the
 * scrollbar still spans every row, and a wheel step covers a few more of them.
 * Use `scrollToRow()` and `scrollToColumn()` rather than setting the scroll
 * container's `scrollTop` or `scrollLeft`.
 *
 * @summary Data table with pinned rows and columns and infinite loading.
 *
 * @fires {CustomEvent<SortingChangeDetail>} argus-sorting-change - `sorting` changed: a sortable header was clicked, or activated with Enter or Space. `detail: { sorting }`. The new value fires after the update that applied it; when the property is controlled, the proposed value fires right away and nothing changes until the host sets it.
 * @fires {CustomEvent<ColumnSizingChangeDetail>} argus-column-sizing-change - `columnSizing` changed: a column was resized by dragging its handle, with Alt+Arrow on its header, by a double-click on its handle (fit to content) or by `autosizeColumns()`. `detail: { columnSizing, columnId, width }`. Fires on every frame of a drag, and once per column that changes (a group resize, `autosizeColumns()`). The new value fires after the update that applied it; when the property is controlled, the proposed value fires right away and nothing changes until the host sets it.
 * @fires {CustomEvent<ColumnOrderChangeDetail>} argus-column-order-change - `columnOrder` changed: a column or column group was moved by dragging its header, or with Alt+Shift+Arrow on its focused header. Columns move within their pin side (start-pinned, scrolling, end-pinned) and their column group; groups move as a whole. `detail: { columnOrder, columnId, groupId? }`: `groupId` is set when a group moved, and `columnId` is then its first column. Fires once per move, on drop. The new value fires after the update that applied it; when the property is controlled, the proposed value fires right away and nothing changes until the host sets it.
 * @fires {CustomEvent<ColumnPinningChangeDetail>} argus-column-pinning-change - `columnPinning` changed: a column was pinned to a side or unpinned, through a plugin such as the column menu. `detail: { columnPinning, columnId, pin }`: `pin` is `'start'`, `'end'` or `false`. The new value fires after the update that applied it; when the property is controlled, the proposed value fires right away and nothing changes until the host sets it.
 * @fires {CustomEvent<ColumnVisibilityChangeDetail>} argus-column-visibility-change - `columnVisibility` changed: a column was hidden or shown, through a plugin such as the column menu. `detail: { columnVisibility, columnId, visible }`: `visible` is `false` when it was hidden. The new value fires after the update that applied it; when the property is controlled, the proposed value fires right away and nothing changes until the host sets it.
 * @fires {CustomEvent<ColumnFiltersChangeDetail>} argus-column-filters-change - `columnFilters` changed: a column's filter was set, changed or cleared, through a plugin such as the column menu. `detail: { columnFilters, columnId, columnFilter }`: `columnFilter` is the column's new filter, or `undefined` when it was cleared. The new value fires after the update that applied it; when the property is controlled, the proposed value fires right away and nothing changes until the host sets it.
 * @fires {CustomEvent<SelectionChangeDetail>} argus-selection-change - `selection` changed: by a click on a row (Ctrl/Cmd toggles, Shift selects a range), with Space, Shift+Arrow or Shift+PageUp/PageDown on a body cell, or with Ctrl/Cmd+A. Only with a `selectionMode`. `detail: { selection }`. The new value fires after the update that applied it; when the property is controlled, the proposed value fires right away and nothing changes until the host sets it.
 * @fires {CustomEvent<CellClickDetail<T>>} argus-cell-click - A body or pinned-row cell was clicked, or Enter was pressed on it. `detail: { row, rowId, index, columnId, value, pinned? }`; `pinned` is `'top'` or `'bottom'` for a pinned row, and `index` is then its index in its list. Fires before `argus-row-click`.
 * @fires {CustomEvent<RowClickDetail<T>>} argus-row-click - A body or pinned row was clicked, or Enter was pressed on one of its cells. `detail: { row, rowId, index, pinned? }`; for a pinned row, `index` is its index in its list.
 * @fires {CustomEvent<RangeChangeDetail>} argus-range-change - The rows in view changed (rows rendered ahead of the scroll position not counted). `detail: { first, last }` (row indices in the current order, both inclusive).
 * @fires {CustomEvent<LoadErrorDetail>} argus-load-error - A `dataSource` page failed to load: `getRows()` rejected or threw. `detail: { error, start, end }` (`end` exclusive). The rows show a Retry button.
 *
 * @slot empty - Shown instead of the body when there are no rows. Default: `labels.noRows` ("No rows").
 *
 * @csspart table - The scroll container that holds header and body.
 * @csspart header - The sticky header row group.
 * @csspart header-row - The row of column headers: the last header row when there are column groups.
 * @csspart header-group-row - A row of column group headers (`columnGroups`), one per level of nesting, above `header-row`.
 * @csspart header-group-cell - A column group's header, spanning its columns.
 * @csspart header-group-cell-dragging - Added to `header-group-cell` on the group being dragged to a new position.
 * @csspart header-group-filler - The empty cell of a group row over columns without a group at that level.
 * @csspart header-cell - Every column header.
 * @csspart header-cell-sorted - Added to `header-cell` on the headers of sorted columns. The direction is also in `aria-sort`.
 * @csspart header-cell-sorted-asc - Added to `header-cell` on the headers of columns sorted ascending, next to `header-cell-sorted`.
 * @csspart header-cell-sorted-desc - Added to `header-cell` on the headers of columns sorted descending, next to `header-cell-sorted`.
 * @csspart header-cell-pinned - Added to `header-cell` on the headers of pinned columns, on either side.
 * @csspart header-cell-pinned-edge - Added to `header-cell-pinned` on the pinned header next to the scrolling columns (one per pinned side).
 * @csspart sort-indicator - The chevron in a sortable column's header, shown while it is sorted and pointing the way it sorts. It is drawn with borders in `currentColor`.
 * @csspart header-cell-filtered - Added to `header-cell` on the headers of filtered columns.
 * @csspart filter-indicator - The mark in the header of a filtered column, after the sort indicator.
 * @csspart header-cell-dragging - Added to `header-cell` on the header being dragged to a new position, and on the headers of a dragged group's columns.
 * @csspart drop-indicator - The line on the edge of the header where a dragged column or group would land.
 * @csspart resize-handle - The drag handle on the inline-end edge of a resizable column's header, and of a column group's header with resizable columns. A double-click fits the column (or the group's columns) to its content.
 * @csspart body - The row group holding the rendered body rows.
 * @csspart row - Every body row.
 * @csspart row-even - Body rows with an even index (0-based).
 * @csspart row-odd - Body rows with an odd index.
 * @csspart row-loading - Body rows whose `dataSource` page hasn't loaded yet, or failed.
 * @csspart row-error - Added to `row-loading` on body rows whose `dataSource` page failed to load.
 * @csspart row-selected - Body rows whose id is in `selection`.
 * @csspart cell-selection - Added to `cell` in the checkbox column (`selectionCheckboxes`), pinned rows included.
 * @csspart header-cell-selection - Added to `header-cell` on the checkbox column's header.
 * @csspart selection-checkbox - The checkboxes of the checkbox column: one per selectable row, and the select-all one in the header (`multi` mode).
 * @csspart row-pinned - Every row from `pinnedRows`, on either side. Also has `row`, but no `row-even`/`row-odd`.
 * @csspart row-pinned-top - The rows pinned below the header.
 * @csspart row-pinned-bottom - The rows pinned to the bottom.
 * @csspart cell-in-pinned-row - Every cell of a pinned row (next to `cell`).
 * @csspart cell - Every body cell.
 * @csspart cell-sorted - Body and pinned-row cells in the sorted column.
 * @csspart cell-pinned - Body and pinned-row cells in a pinned column, on either side.
 * @csspart cell-pinned-edge - The pinned cell next to the scrolling columns (one per pinned side), in body and pinned rows.
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
 * @cssprop [--argus-border=none] - Border around the whole table, as a `border` shorthand (`1px solid …`). Inside the element's size. The lines between rows are `--argus-border-width` and `--argus-border-color`.
 * @cssprop [--argus-border-radius=0] - Corner radius of the table. Header, rows and pinned columns are clipped to it.
 * @cssprop [--argus-row-height] - Height of a row, and of each header row. Default per density: 32px, 40px, 52px. With `rowHeight: 'auto'`: the height of each header row and the least a body or pinned row is.
 * @cssprop [--argus-cell-padding-inline] - Inline padding of cells. Default per density: 8px, 12px, 16px.
 * @cssprop [--argus-cell-padding-block] - Block padding of body and pinned-row cells with `rowHeight: 'auto'`, where content sits at the top of the cell. Default: what centres one line of text in `--argus-row-height`.
 * @cssprop [--argus-row-odd-bg] - Background of odd rows. Default: no stripes.
 * @cssprop [--argus-pinned-shadow] - Shadow on the pinned edge, as a `box-shadow` falling toward the end side (`4px 0 6px -4px …`). Mirrored for the end edge and in RTL; `none` removes it.
 * @cssprop [--argus-resize-handle-color] - Colour of the resize handle's line, shown on hover, focus and drag.
 * @cssprop [--argus-focus-ring=2px solid Highlight] - Outline of the focused header or cell.
 * @cssprop [--argus-filter-indicator-color=currentColor] - Colour of the mark in the header of a filtered column.
 * @cssprop [--argus-drop-indicator-color=Highlight] - Colour of the line that marks where a dragged column would land.
 * @cssprop [--argus-row-hover-bg] - Background of the hovered row. Default: no change.
 * @cssprop [--argus-row-pinned-bg=var(--argus-bg)] - Background of the pinned rows, pinned columns included.
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
   * Headers over several columns: `{ id, header, columns }`, where `columns` lists
   * column ids and nested groups. Each level of nesting adds a header row. A group's
   * columns stay next to each other: they move within the group, and the group
   * moves as a whole (drag its header, or Alt+Shift+Arrow). A group whose columns
   * are pinned to different sides shows on each side. Property only. While empty
   * and `columns` is too, the table reads its `<argus-column-group>` children.
   * `null` or `undefined` means `[]`.
   */
  @property({ attribute: false })
  get columnGroups(): readonly ColumnGroup[] {
    return this.#columnGroupsProp;
  }
  set columnGroups(value: readonly ColumnGroup[] | null | undefined) {
    this.#columnGroupsProp = value ?? [];
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
   * `{ getRows({ start, end, sorting, filters, quickFilter, signal }), pageSize? }`,
   * where `end` is exclusive and `getRows` resolves to `{ rows, total? }`. Without a
   * `total`, the table grows as pages arrive and a short page marks the end. Sorting
   * and filtering happen on the server: a new order or filter reloads from the top.
   * While set, it wins over `data`. Replace the object to change `getRows` or
   * `pageSize`.
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

  /**
   * Row height in px, or `'auto'` to fit each row to its content (`row-height="auto"`).
   * Unset: the density (or the `--argus-row-height` token) decides. With
   * `'auto'`, that height is the header's and the least a body or pinned row is;
   * rows grow to fit wrapped text (`wrap` columns) and taller content, and cell
   * content sits at the top. Rows are measured as they render: a row's height
   * counts the columns rendered (see `virtualizeColumns`), and rows not seen yet
   * count as one line. Give images a size, so rows don't move when they load.
   */
  @property({ attribute: 'row-height', converter: rowHeightConverter })
  rowHeight?: number | 'auto';

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
   * Renders only the scrolling columns in view (plus two on each side), for
   * wide tables: a few dozen columns and more. Pinned columns, the checkbox
   * column and the focused cell's column always render. Off by default: then
   * every column renders, as before. Cells are placed in their grid column
   * explicitly, so page CSS that relies on their order in the DOM (`:nth-child`
   * on cells) doesn't apply. `autosizeColumns()` and `width: 'auto'` columns
   * still measure columns out of view: they render for the measurement.
   * As an attribute, `virtualize-columns="false"` is off, like no attribute.
   */
  @property({ attribute: 'virtualize-columns', converter: switchConverter })
  virtualizeColumns = false;

  /**
   * The sort order, e.g. `[{ id: 'total', desc: true }]`; `[]` when unsorted. Unset,
   * the table keeps it itself and header clicks change it. Once set, it is
   * controlled: a click only fires `argus-sorting-change` with the proposed order,
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
   * fires `argus-column-sizing-change` with the proposed widths. `undefined` hands it back.
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
   * until set, like `sorting`: once set, a move only fires `argus-column-order-change`
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
   * Pins by column id, over the columns' own `pin`: `'start'` or `'end'` pins a
   * column, `false` unpins one whose definition pins it, e.g.
   * `{ total: 'end', id: false }`. Columns it doesn't list keep their `pin`. A pinned
   * column joins the edge of its group nearest its place in `columnOrder`, and stops
   * flexing. Uncontrolled until set, like `sorting`: once set, pinning from a plugin
   * only fires `argus-column-pinning-change` with the proposed pins. `undefined` hands it back.
   */
  @property({ attribute: false })
  get columnPinning(): ColumnPinningState {
    return this.#pinning.value;
  }
  set columnPinning(value: ColumnPinningState | undefined) {
    this.#pinning.set(value);
  }

  /**
   * Visibility by column id, over the columns' own `hidden`: `false` hides a column,
   * `true` shows one defined as `hidden`, e.g. `{ email: false }`. Columns it
   * doesn't list keep their `hidden`. A hidden column isn't rendered, but sorting by
   * it still works and it keeps its place in `columnOrder`. Uncontrolled until set,
   * like `sorting`: once set, hiding or showing from a plugin only fires
   * `argus-column-visibility-change` with the proposed visibility. `undefined` hands it back.
   */
  @property({ attribute: false })
  get columnVisibility(): ColumnVisibilityState {
    return this.#visibility.value;
  }
  set columnVisibility(value: ColumnVisibilityState | undefined) {
    this.#visibility.set(value);
  }

  /**
   * Filters by column id, e.g. `{ city: { kind: 'set', values: ['Berlin'] } }` or
   * `{ total: { kind: 'number', op: 'gt', value: 100 } }`. A row shows when it passes
   * every filter and `quickFilter`. Filters on hidden columns still apply; unknown ids
   * are ignored. A column's `filterFn` replaces the built-in matching. With a
   * `dataSource`, the filters go to `getRows()` and the server filters. Users set
   * filters through plugins (the column menu) on columns with a `filter` kind.
   * Uncontrolled until set, like `sorting`: once set, a change from a plugin only
   * fires `argus-column-filters-change` with the proposed filters. `undefined` hands it back.
   */
  @property({ attribute: false })
  get columnFilters(): ColumnFilterState {
    return this.#filters.value;
  }
  set columnFilters(value: ColumnFilterState | undefined) {
    this.#filters.set(value);
  }

  /**
   * Shows only rows that contain each word of this text in one of their shown
   * columns, ignoring case, e.g. from a search box. Values are matched as text
   * (dates as `2026-11-10`); objects aren't searched. With a `dataSource`, it goes
   * to `getRows()` and the server filters. `''` (the default) shows every row.
   */
  @property({ attribute: 'quick-filter' })
  get quickFilter(): string {
    return this.#quickFilter;
  }
  set quickFilter(value: string | null | undefined) {
    this.#quickFilter = value ?? '';
  }

  /**
   * How rows can be selected: `none` (the default), `single` or `multi`. A click
   * on a body row selects it; in `multi` mode Ctrl/Cmd+click toggles a row,
   * Shift+click selects the range from the last clicked row, and Ctrl/Cmd+A
   * selects every row. Space toggles the focused row. Clicks on buttons, links
   * and inputs inside cells don't select. Pinned rows, and `dataSource` rows not
   * loaded yet, can't be selected. Reflected to the `selection-mode` attribute,
   * so page CSS and themes can match it, e.g. `argus-table[selection-mode='multi']`.
   */
  @property({ attribute: 'selection-mode', reflect: true })
  selectionMode: SelectionMode = 'none';

  /**
   * Adds a checkbox column, pinned first at the start, while `selectionMode` is
   * `single` or `multi`. A row's checkbox toggles it (Shift+click adds the range
   * from the last row clicked); in `multi` mode the header's checkbox selects
   * every row, or clears the selection when all are selected. Space on a
   * focused checkbox cell does the same. The column isn't part of `columns`,
   * `columnOrder` or `columnSizing`, and it fires no `argus-cell-click`.
   * As an attribute, `selection-checkboxes="false"` is off, like no attribute.
   */
  @property({ attribute: 'selection-checkboxes', converter: switchConverter })
  selectionCheckboxes = false;

  /**
   * The selected rows, as row ids (from `getRowId`, or the row's index as a
   * string), e.g. `['p4', 'p7']`. Uncontrolled until set, like `sorting`: once
   * set, a click only fires `argus-selection-change` with the proposed ids.
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

  /**
   * Renders header and cell content the table can't render itself, such as React
   * elements, Vue VNodes or Angular templates: `{ render(target, content),
   * release(target), flush?() }`. A `header` or `cell` that returns anything other
   * than a string, a number, a DOM node or a Lit template hands it to the renderer,
   * with a target element the table keeps while the cell is reused for other rows.
   * The framework wrappers set it; set it yourself only for another framework.
   */
  @property({ attribute: false })
  contentRenderer?: ContentRenderer;

  /**
   * Add-ons, such as `headerMenu()` from `@argus-table/header-menu`. Each one can
   * change the column definitions, handle keys on a focused header or cell, and
   * use the table through a small API. They run in array order. Replace the
   * array to change them; an array with the same plugins in the same order
   * changes nothing. `null` or `undefined` means `[]`.
   */
  @property({ attribute: false })
  get plugins(): readonly ArgusPlugin<T>[] {
    return this.#pluginsProp;
  }
  set plugins(value: readonly ArgusPlugin<T>[] | null | undefined) {
    const next = value ?? [];
    // The same plugins in a new array (a framework re-render) keep their connection.
    if (!sameItems(next, this.#pluginsProp)) this.#pluginsProp = next;
  }

  /**
   * The table's built-in text, for another language: labels screen readers read
   * (`selectRow`, `resizeColumn`, …), the Retry button, the empty state
   * (`noRows`) and announcements (`rowCount`, `columnMoved`, …). Text with values
   * in it is a function: `rowCount: ({ count }) => …`. Keys left out stay English.
   * Property only. Plugins such as `headerMenu()` take their own `labels` option.
   * `null` or `undefined` means `{}`.
   */
  @property({ attribute: false })
  get labels(): Partial<TableLabels> {
    return this.#labelsProp;
  }
  set labels(value: Partial<TableLabels> | null | undefined) {
    this.#labelsProp = value ?? {};
  }

  #labelsProp: Partial<TableLabels> = {};
  /** `labels` over the defaults, rebuilt when `labels` changes. */
  #resolvedLabels: { of: Partial<TableLabels>; labels: TableLabels } | undefined;

  /** The built-in text in effect: `labels` over the English defaults. */
  get #labels(): TableLabels {
    if (this.#resolvedLabels?.of !== this.#labelsProp) {
      this.#resolvedLabels = { of: this.#labelsProp, labels: resolveLabels(this.#labelsProp) };
    }
    return this.#resolvedLabels.labels;
  }
  #columnsProp: readonly ColumnDef<T>[] = [];
  #columnGroupsProp: readonly ColumnGroup[] = [];
  /** The groups last passed to the model: `columnGroups`, or the `<argus-column-group>` children. */
  #groups: readonly ColumnGroup[] = [];
  #groupsChanged = false;
  #pluginsProp: readonly ArgusPlugin<T>[] = [];
  #dataProp: readonly T[] = [];
  #overscan = 6;
  readonly #sorting = controllable<SortState>([]);
  readonly #sizing = controllable<ColumnSizingState>({});
  readonly #order = controllable<ColumnOrderState>([]);
  readonly #pinning = controllable<ColumnPinningState>({});
  readonly #visibility = controllable<ColumnVisibilityState>({});
  readonly #filters = controllable<ColumnFilterState>({});
  #quickFilter = '';
  /** Filters the table applied itself, by column; their events fire once the update is done. */
  readonly #appliedFilters = new Map<string, ColumnFiltersChangeDetail>();
  /** Announce the row count after the update: the filters changed. */
  #announceRows = false;
  /** Pins the table applied itself, by column; their events fire once the update is done. */
  readonly #appliedPins = new Map<string, ColumnPinningChangeDetail>();
  /** Hidden or shown columns the table applied itself; their events fire once the update is done. */
  readonly #appliedHides = new Map<string, ColumnVisibilityChangeDetail>();
  readonly #selection = controllable<SelectionState>([]);
  /** `selection` as a set, for the rows rendered; rebuilt when `selection` changes. */
  #selectedIds: { of: SelectionState; ids: ReadonlySet<string> } | undefined;
  /** The row a Shift range starts from: the last row clicked or toggled without Shift. */
  #anchor: string | undefined;
  /** A selection the table applied itself; its event fires once the update is done. */
  #appliedSelection: SelectionState | undefined;
  /** Whether the checkbox column was last shown; a change re-measures the pinned columns. */
  #selectionColumn = false;
  #selectionColumnChanged = false;
  /** The select-all checkbox's state, kept until the selection or the shown rows change. */
  #checkAll: { key: readonly unknown[]; state: CheckAll['state'] } | undefined;
  /** Moves the table applied itself, by column or group; their events fire once the update is done. */
  readonly #appliedReorders = new Map<string, ColumnOrderChangeDetail>();
  /** The header being dragged to a new position, if any. */
  #drag: HeaderDrag | undefined;
  /** A move from the keyboard, announced once it has rendered: what moved and its old position. */
  #announceMove: { unit: OrderUnit; from: number } | undefined;
  /** Resizes the table applied itself, by column; their events fire once the update is done. */
  readonly #appliedResizes = new Map<string, ColumnSizingChangeDetail>();
  /** Columns `autosizeColumns()` renders out of view for its measurement. */
  #measureKeep: readonly string[] = [];
  /** The column `scrollToColumn()` renders out of view to measure where it is. */
  #scrollKeep: string | undefined;
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
  /** What plugins get: closures over the table's private state. */
  readonly #pluginHost: PluginHost<T> = {
    element: this,
    column: (id) => this.#columnInfo(id),
    columns: () =>
      this.#table.model.allColumns.flatMap((c) => {
        const info = this.#columnInfo(c.id);
        return info ? [info] : [];
      }),
    setPin: (columnId, pin) => {
      this.#requestPin(columnId, pin);
    },
    setHidden: (columnId, hidden) => {
      this.#requestHide(columnId, hidden);
    },
    setFilter: (columnId, filter) => {
      this.#requestFilter(columnId, filter);
    },
    filterValues: (columnId, limit) => this.#table.model.filterValues(columnId, limit),
    filteredIndexes: (except) => this.#table.model.indexesPassing(except),
    cellOf: (event) => this.#cellTarget(event),
    setSort: (columnId, direction) => {
      this.#setSort(columnId, direction);
    },
    focusHeader: (columnId) => {
      const model = this.#table.model;
      this.#moveTo(layoutOf(model).leafHeader, columnId, model);
    },
    announce: (message) => {
      announce(this.ownerDocument, message);
    },
    invalidateColumns: () => {
      this.#plugins.invalidate();
      this.requestUpdate();
    },
    requestUpdate: () => {
      this.requestUpdate();
    },
    row: (index) => this.#table.model.rowAt(index)?.original,
    content: (value) => content(value),
    header: (def) => {
      const { header } = def;
      const own = typeof header === 'function' ? (header as () => unknown)() : header;
      // A group without a header shows its id; a column shows nothing.
      return content(own ?? ('columns' in def ? def.id : undefined));
    },
  };
  readonly #plugins = new PluginController<T>(this, this.#pluginHost);
  #columnsById:
    | {
        of: readonly ColumnView<T, CellContent>[];
        byId: ReadonlyMap<string, ColumnView<T, CellContent>>;
      }
    | undefined;
  /** The columns last passed to the model: `columns`, or the `<argus-column>` children. */
  #columns: readonly ColumnDef<T>[] = [];
  #columnsChanged = false;
  #warnedColumns = false;
  /** The header row of column headers at the last reconcile (`#reconcileActive`). */
  #leafLevel = 0;
  /** End of the light-DOM part holding cell content, so later children stay outside it. */
  #contentEnd: Comment | undefined;
  /** The light-DOM part: disconnected with the table, so foreign content is released. */
  #lightPart: RootPart | undefined;
  #lightConnected = true;
  readonly #data = new DataController<T>(this);
  /** Scroll back to the top after the update (a new sort order for a data source). */
  #scrollToTop = false;
  // Looked up lazily: the virtualizer's hostUpdated runs before firstUpdated.
  readonly #virtual = new VirtualController(this, () => this.#scroller());
  readonly #pinScroll = new PinScrollController(this, () => this.#scroller());
  readonly #columnWindow = new ColumnWindowController<T>(this, () => this.#scroller());
  /** The columns the last render rendered (all of them, unless `virtualizeColumns`). */
  #rendered: RenderedColumn<T>[] = [];
  #rowPx = 40;
  #probeObserver?: ResizeObserver;
  /** The column template and row height the rows were last read for. */
  #rowsKey = '';
  /** Rows of different heights: reads the rendered rows (`rowHeight: 'auto'` only). */
  readonly #rowMeasure = new RowMeasure(this, {
    bodyIndex: (row) => {
      const at = gridRowOf(row, layoutOf(this.#table.model));
      return at?.section === 'body' && this.#data.stateAt(at.index) === 'loaded'
        ? at.index
        : undefined;
    },
    sizeOf: (index) => this.#virtual.sizeOf(index),
    minimum: () => this.#rowPx,
  });
  #window: VirtualWindow = { rows: [], totalSize: 0, range: null };
  #active: Active | undefined;
  /** Move focus to the active cell after the next update (keyboard navigation). */
  #focusPending = false;
  #lastRange = '';
  #unwatchMaxHeight: (() => void) | undefined;

  /**
   * The row `setState()` or `scrollToRow()` still has to scroll to: a data
   * source's rows that far aren't counted yet. Scrolled to again whenever the
   * row count changes.
   */
  #scrollTarget: { row: number; count: number; align: ScrollAlign } | undefined;

  /** The scroll container (`part="table"`); `null` before the first render. */
  #scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('[part~="table"]');
  }

  constructor() {
    super();
    // The user's own scrolling (or a click, or a key) wins over a restored position.
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const) {
      this.addEventListener(type, this.#dropScrollTarget, { passive: true });
    }
  }

  readonly #dropScrollTarget = () => {
    this.#scrollTarget = undefined;
    // And the virtualizer's own command: it would otherwise finish the scroll to
    // a restored row (or `scrollToRow()`'s) when the next page is counted (#110).
    this.#virtual.cancelScroll();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'grid');
    if (this.hasUpdated) this.#observeProbe();
    this.#setLightConnected(true);
    // A zoom change changes the tallest body the engine renders.
    this.#unwatchMaxHeight = watchMaxElementHeight(() => {
      this.requestUpdate();
    });
  }

  /** Connects or disconnects the cell content (framework content mounts and unmounts with it). */
  #setLightConnected(connected: boolean): void {
    if (!this.#lightPart || this.#lightConnected === connected) return;
    this.#lightConnected = connected;
    this.#lightPart.setConnected(connected);
    flushContent(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#probeObserver?.disconnect();
    this.#rowMeasure.stop();
    // Framework content in the cells is unmounted until the table comes back.
    this.#setLightConnected(false);
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
   * `columnGroups` when it has any or `columns` is set (which turns off all
   * children), otherwise the `<argus-column-group>` children.
   */
  #effectiveGroups(): readonly ColumnGroup[] {
    if (this.columnGroups.length > 0 || this.columns.length > 0) return this.columnGroups;
    return this.#children.groups;
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
   * would, so `argus-column-sizing-change` fires for each column that changes, and with a
   * controlled `columnSizing` nothing changes until you set it. Without `ids`, fits
   * every resizable column; columns with `resizable: false` keep their width.
   * With `virtualizeColumns`, columns out of view render for the measurement.
   * Resolves once the table has re-rendered.
   */
  async autosizeColumns(ids?: readonly string[]): Promise<void> {
    await this.updateComplete;
    const targets = this.#table.model.columns
      .filter((c) => c.resizable && (ids === undefined || ids.includes(c.id)))
      .map((c) => c.id);
    if (this.virtualizeColumns) {
      this.#measureKeep = targets;
      this.requestUpdate();
      await this.updateComplete;
    }
    const widths = measureColumns(this.renderRoot, targets);
    if (this.#measureKeep.length > 0) {
      this.#measureKeep = [];
      this.requestUpdate();
    }
    this.#requestResizes(widths);
    await this.updateComplete;
  }

  /**
   * Scrolls to a row: `index` in the current row order (after sorting and
   * filtering), or `{ id }` (`getRowId`'s). `align` puts it at the top of the
   * view (`'start'`, the default, just below the header and pinned rows), at
   * the bottom (`'end'`), in the middle (`'center'`), or scrolls only as far as
   * needed to show it (`'nearest'`). Resolves once the table has re-rendered
   * there: `true` when the row is there, `false` for an id that isn't in the
   * rows (unknown, filtered out, a pinned row, a data source row not loaded) or
   * an index past the last row (it scrolls to the end). With a `dataSource`
   * whose total isn't known yet, an index past the rows counted so far resolves
   * `false` and the table scrolls on toward the row as pages arrive, until the
   * user scrolls, clicks or presses a key.
   */
  async scrollToRow(target: RowTarget, options: ScrollToRowOptions = {}): Promise<boolean> {
    await this.updateComplete;
    const model = this.#table.model;
    const index = typeof target === 'number' ? target : model.indexOf(target.id);
    if (index === undefined || !Number.isInteger(index) || index < 0) return false;
    const align = options.align ?? 'start';
    const count = model.rowCount;
    this.#scrollTarget =
      this.#data.rows?.totalKnown === false && index >= count
        ? { row: index, count, align }
        : undefined;
    this.#scrollRowTo(index, align);
    // The scroll event comes before the next frame, and the rows move with its
    // update. Rows measured on the way (`rowHeight: 'auto'`) move a row that
    // isn't at the top: align it again until they're done.
    for (let i = 0; i < 5; i++) {
      await new Promise(requestAnimationFrame);
      await this.#settled();
      if (align === 'start' || this.rowHeight !== 'auto' || !this.#scrollRowTo(index, align)) break;
    }
    return index < this.#table.model.rowCount;
  }

  /** Scrolls row `index` to `align` in the body. Returns whether it moved. */
  #scrollRowTo(index: number, align: ScrollAlign): boolean {
    const { before, after } = this.#bodyInsets(layoutOf(this.#table.model));
    return this.#virtual.scrollToIndex(index, align, before, after);
  }

  /** The rows in the scroller above the body (header, top pinned rows) and below it, in px. */
  #bodyInsets(layout: RowLayout): { before: number; after: number } {
    return {
      before: layout.header * this.#rowPx + this.#pinnedPx('top', layout),
      after: this.#pinnedPx('bottom', layout),
    };
  }

  /**
   * Scrolls sideways to a column, by id. `align` puts it in the scrolling area
   * between the pinned columns: by default only as far as needed to show it in
   * full (`'nearest'`), or at the start, the end or the middle (`'start'`,
   * `'end'`, `'center'`). With `virtualizeColumns` the column renders first.
   * Resolves once the table has re-rendered there: `true` when the column is in
   * view (a pinned column always is, and doesn't scroll), `false` for an id of
   * no column or of a hidden one.
   */
  async scrollToColumn(id: string, options: ScrollToColumnOptions = {}): Promise<boolean> {
    await this.updateComplete;
    const column = this.#table.model.columns.find((c) => c.id === id && c.kind === 'data');
    if (!column) return false;
    if (column.pin !== undefined) return true;
    if (this.virtualizeColumns) {
      this.#scrollKeep = id;
      this.requestUpdate();
      await this.updateComplete;
    }
    this.#scrollColumnTo(id, options.align ?? 'nearest');
    if (this.#scrollKeep !== undefined) {
      this.#scrollKeep = undefined;
      this.requestUpdate();
    }
    // The column window moves with the scroll event, before the next frame.
    await new Promise(requestAnimationFrame);
    await this.updateComplete;
    return true;
  }

  /**
   * Scrolls the column's header cell to `align` in the scrolling area. Measured,
   * not computed from widths: a flex column is as wide as its grid track.
   */
  #scrollColumnTo(id: string, align: ScrollAlign): void {
    const scroller = this.#scroller();
    const model = this.#table.model;
    const layout = layoutOf(model);
    const header = `[role='row'][aria-rowindex="${String(layout.header)}"]`;
    const cell = this.renderRoot.querySelector(`${header} > [data-col="${CSS.escape(id)}"]`);
    if (!scroller || !cell) return;
    const direction = this.#direction();
    const ltr = direction === 1;
    const box = scroller.getBoundingClientRect();
    const rect = cell.getBoundingClientRect();
    // The inner start edge: past the border, and past a scrollbar on that side.
    const edge = box.left + scroller.clientLeft + (ltr ? 0 : scroller.clientWidth);
    const pinStart = pinnedWidth(model.columns, 'start');
    const view = scroller.clientWidth - pinStart - pinnedWidth(model.columns, 'end');
    // Negative in RTL.
    const offset = Math.abs(scroller.scrollLeft);
    const start = offset + (ltr ? rect.left - edge : edge - rect.right) - pinStart;
    const target = alignOffset(start, rect.width, offset, view, align);
    const inline = Math.min(Math.round(target), scroller.scrollWidth - scroller.clientWidth);
    if (inline !== offset) scroller.scrollLeft = inline * direction;
  }

  /**
   * Waits for the update, and with `rowHeight: 'auto'` for the ones measured
   * rows request (a few at most: heights don't depend on positions).
   */
  async #settled(): Promise<void> {
    let done = await this.updateComplete;
    for (let i = 0; i < 8 && !done && this.rowHeight === 'auto'; i++) {
      done = await this.updateComplete;
    }
  }

  /**
   * The state users change, as one object of plain JSON for saving a user's
   * layout: `sorting`, `columnSizing`, `columnOrder`, `columnPinning`,
   * `columnVisibility`, `columnFilters`, `selection`, `quickFilter`, and `scroll`
   * (the row at the top and the inline offset), with `version: 1`. Controlled properties are
   * included with the values you set. The object is a copy: changing it changes
   * nothing in the table.
   */
  getState(): Required<TableState> {
    const scroller = this.#scroller();
    return structuredClone({
      version: 1 as const,
      sorting: this.#sorting.value,
      columnSizing: this.#sizing.value,
      columnOrder: this.#order.value,
      columnPinning: this.#pinning.value,
      columnVisibility: this.#visibility.value,
      columnFilters: this.#filters.value,
      selection: this.#selection.value,
      quickFilter: this.#quickFilter,
      // Negative in RTL.
      scroll: { row: this.#virtual.topRow, inline: Math.abs(scroller?.scrollLeft ?? 0) },
    });
  }

  /**
   * Restores state from `getState()`, for example a layout saved in
   * `localStorage`. Only the keys given change; ids of columns that no longer
   * exist are ignored. State of another `version` is ignored as a whole. Properties you control are left alone (set them
   * yourself), and the others stay uncontrolled. No change events fire.
   * `quickFilter` is set like the property: a search box of yours shows it only
   * if you read it back. `scroll` is applied after the rest, so with a
   * `dataSource` the restored rows load where it points. Resolves once the table
   * has re-rendered there.
   */
  async setState(state: TableState): Promise<void> {
    // Another format (a later version's): nothing it holds can be trusted to mean the same.
    if (((state.version as number | undefined) ?? 1) !== 1) return;
    this.#restore('sorting', this.#sorting, state.sorting);
    this.#restore('columnSizing', this.#sizing, state.columnSizing);
    this.#restore('columnOrder', this.#order, state.columnOrder);
    this.#restore('columnPinning', this.#pinning, state.columnPinning);
    this.#restore('columnVisibility', this.#visibility, state.columnVisibility);
    this.#restore('columnFilters', this.#filters, state.columnFilters);
    // A Shift range starts over from the restored selection.
    if (this.#restore('selection', this.#selection, state.selection)) this.#anchor = undefined;
    if (state.quickFilter !== undefined) this.quickFilter = state.quickFilter;
    this.#scrollTarget = undefined;
    await this.updateComplete;
    const { scroll } = state;
    if (!scroll) return;
    this.#virtual.scrollToIndex(scroll.row);
    // A data source counts one page past its loaded rows until it knows the
    // total: scroll on as the count grows.
    const count = this.#table.model.rowCount;
    if (this.#data.rows?.totalKnown === false && scroll.row >= count) {
      this.#scrollTarget = { row: scroll.row, count, align: 'start' };
    }
    const scroller = this.#scroller();
    if (scroller && scroll.inline >= 0) {
      scroller.scrollLeft = scroll.inline * this.#direction();
    }
    // The scroll event comes before the next frame, and the rows move with its update.
    await new Promise(requestAnimationFrame);
    await this.#settled();
  }

  /**
   * Scrolls on toward the row `setState()` restored, or `scrollToRow()` asked
   * for, once more rows are counted.
   */
  #chaseScrollTarget(count: number): void {
    const target = this.#scrollTarget;
    if (!target || target.count === count) return;
    target.count = count;
    this.#scrollRowTo(target.row, target.align);
    if (target.row < count || this.#data.rows?.totalKnown !== false) this.#scrollTarget = undefined;
  }

  /**
   * Applies a restored value to uncontrolled state without an event, as a user
   * change would without the event. Returns whether it changed.
   */
  #restore<V>(name: keyof TableState, state: Controllable<V>, value: V | undefined): boolean {
    if (value === undefined || state.controlled) return false;
    // The same value restored again doesn't reload a data source.
    if (JSON.stringify(value) === JSON.stringify(state.value)) return false;
    const old = state.value;
    state.request(structuredClone(value));
    this.requestUpdate(name, old);
    return true;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('plugins')) this.#plugins.set(this.plugins);
    // Property names: the keys are strings.
    this.#plugins.willUpdate(new Set(changed.keys()) as ReadonlySet<string>);
    const columns = this.#plugins.transform(this.#effectiveColumns());
    this.#columnsChanged = columns !== this.#columns;
    this.#columns = columns;
    const groups = this.#plugins.transformGroups(this.#effectiveGroups());
    this.#groupsChanged = groups !== this.#groups;
    this.#groups = groups;
    const filtersChanged = changed.has('columnFilters') || changed.has('quickFilter');
    if (
      changed.has('dataSource') ||
      changed.has('sorting') ||
      changed.has('getRowId') ||
      filtersChanged
    ) {
      this.#data.configure({
        source: this.dataSource,
        sorting: this.#sorting.value,
        filters: this.#filters.value,
        quickFilter: this.#quickFilter,
        getRowId: this.getRowId,
      });
      // A new order or filter starts over from the first row, so show it.
      if (this.dataSource && this.hasUpdated && (changed.has('sorting') || filtersChanged)) {
        this.#scrollToTop = !changed.has('dataSource');
      }
      // Other rows: a position restored for the old ones no longer applies.
      this.#scrollTarget = undefined;
    }
    if (filtersChanged && this.hasUpdated) this.#announceRows = true;
    if (
      this.#columnsChanged ||
      this.#groupsChanged ||
      changed.has('data') ||
      changed.has('getRowId') ||
      changed.has('sorting') ||
      changed.has('columnSizing') ||
      changed.has('columnOrder') ||
      changed.has('columnPinning') ||
      changed.has('columnVisibility') ||
      changed.has('columnFilters') ||
      changed.has('quickFilter') ||
      changed.has('pinnedRows')
    ) {
      if (this.#columnsChanged) {
        this.#autoWidths.sync(columns.filter((c) => c.width === 'auto').map((c) => c.id));
      }
      this.#table.update({
        columns,
        columnGroups: groups,
        data: this.data,
        getRowId: this.getRowId,
        sorting: this.#sorting.value,
        columnSizing: this.#sizing.value,
        columnOrder: this.#order.value,
        columnPinning: this.#pinning.value,
        columnVisibility: this.#visibility.value,
        columnFilters: this.#filters.value,
        quickFilter: this.#quickFilter,
        pinnedRows: this.pinnedRows,
      });
    }
    // A new page cache (new source, sort order or refresh) or none, new measured
    // widths, and whether the checkbox column shows.
    const autoWidths = this.#autoWidths.widths;
    this.#autoWidthsChanged = autoWidths !== this.#pushedAutoWidths;
    this.#pushedAutoWidths = autoWidths;
    const selectionColumn = this.selectionCheckboxes && this.#mode() !== 'none';
    this.#selectionColumnChanged = selectionColumn !== this.#selectionColumn;
    this.#selectionColumn = selectionColumn;
    this.#table.update({ remote: this.#data.rows, autoWidths, selectionColumn });
    const model = this.#table.model;
    this.#reconcileActive(model);
    const active = this.#active;
    // -1 tells assistive tech the total is unknown (a data source still growing).
    const unknownTotal = this.#data.rows?.totalKnown === false;
    const layout = layoutOf(model);
    this.#internals.ariaRowCount = unknownTotal ? '-1' : String(layout.total);
    this.#internals.ariaColCount = String(model.columns.length);
    this.#internals.ariaMultiSelectable = this.#mode() === 'multi' ? 'true' : null;
    // The header and pinned rows scroll with the body.
    const extra = this.#headerAndPinnedPx(layout);
    const auto = this.rowHeight === 'auto';
    if (!auto) this.#rowMeasure.stop();
    // Anything but a scroll may change what rows hold (data, columns, widths).
    else if (changed.size > 0 || this.#columnsChanged) this.#rowMeasure.invalidate();
    this.#virtual.configure({
      count: model.rowCount,
      rowHeight: this.#rowPx,
      cap: (logical) => bodyCap(logical, extra),
      auto: auto ? { order: model.rowOrder, indexOf: (id) => model.indexOf(id) } : undefined,
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
    const labels = this.#labels;
    this.#window = this.#virtual.computeWindow();
    const rendered = this.#columnWindow.compute(
      columns,
      this.virtualizeColumns,
      this.virtualizeColumns ? this.#keptColumns(model) : [],
    );
    this.#rendered = rendered;
    const pinStart = pinnedWidth(columns, 'start');
    const pinEnd = pinnedWidth(columns, 'end');
    const cols = columns.map(track).join(' ');
    const layout = layoutOf(model);
    const style: Record<string, string> = {
      '--_cols': cols,
      '--_width': `${String(model.totalWidth)}px`,
      '--_pin-start': `${String(pinStart)}px`,
      '--_pin-end': `${String(pinEnd)}px`,
      '--_header-rows': String(layout.header),
      '--_pin-top-rows': String(layout.top),
      '--_pin-bottom-rows': String(layout.bottom),
    };
    const auto = this.rowHeight === 'auto';
    if (auto) {
      // New column widths or a new row height rewrap rows: read them all again.
      const key = `${cols}|${String(this.#rowPx)}`;
      if (key !== this.#rowsKey) {
        this.#rowsKey = key;
        this.#rowMeasure.invalidate();
      }
      style['--_pin-top-h'] = `${String(this.#pinnedPx('top', layout))}px`;
      style['--_pin-bottom-h'] = `${String(this.#pinnedPx('bottom', layout))}px`;
    }
    const active = this.#active;
    const activeIn = (section: GridRow['section']): ActiveCell | undefined =>
      active?.section === section ? { index: active.index, col: active.col } : undefined;
    const firstIndex = (section: GridRow['section']) => layout.ariaRowIndex({ section, index: 0 });
    if (typeof this.rowHeight === 'number' && this.rowHeight > 0) {
      style['--_row-height'] = `${String(this.rowHeight)}px`;
    }
    // The header, the pinned rows and the body: what the pinned-column shadows cover.
    const contentPx =
      this.#headerAndPinnedPx(layout) + (model.rowCount === 0 ? 0 : this.#window.totalSize);
    return html`<div
        part="table"
        role="presentation"
        style=${styleMap(style)}
        ?data-dragging=${this.#drag !== undefined}
        ?data-auto-rows=${auto}
        @keydown=${this.#onKeydown}
        @focusin=${this.#onFocusin}
        @mousedown=${this.#onMousedown}
        @click=${this.#onClick}
      >
        ${renderHeader({
          columns: rendered,
          groups: model.headerGroups,
          handlers: this.#headerHandlers,
          active: activeIn('header'),
          drag: this.#drag,
          checkAll: this.#checkAllOf(model),
          labels,
        })}
        ${renderPinnedRows('top', layout.top, rendered, firstIndex('top'), activeIn('top'))}
        ${
          model.rowCount === 0
            ? html`<div part="empty"><slot name="empty">${labels.noRows}</slot></div>`
            : renderBody(
                this.#window.rows,
                rendered,
                this.#window.totalSize,
                activeIn('body'),
                firstIndex('body'),
                this.#loading(),
                this.#selectedAt(model),
                this.#selectionColumn
                  ? { ...this.#checkboxHandlers, label: labels.selectRow }
                  : undefined,
                auto,
              )
        }
        ${renderPinnedRows('bottom', layout.bottom, rendered, firstIndex('bottom'), activeIn('bottom'))}
        <div class="probe" aria-hidden="true"></div>
      </div>
      ${pinShadow('start', pinStart, contentPx)} ${pinShadow('end', pinEnd, contentPx)}`;
  }

  protected override firstUpdated(): void {
    this.#observeProbe();
    this.#measureRowHeight();
  }

  protected override updated(changed: PropertyValues<this>): void {
    const model = this.#table.model;
    const part = renderLightDom(
      this,
      model,
      this.#window.rows,
      this.#rendered,
      model.headerGroups,
      this.#lightDomEnd(),
    );
    // A new marker starts a new part (the old one was removed): its content is gone.
    if (this.#lightPart && this.#lightPart !== part) this.#lightPart.setConnected(false);
    this.#lightPart = part;
    // Foreign content is committed before anything measures it.
    flushContent(this);
    this.#measureAutoWidths(model);
    // Rows of different heights: placed by the update this requests.
    const resized = this.rowHeight === 'auto' && this.#measureRows();
    if (this.#scrollToTop) {
      this.#scrollToTop = false;
      const scroller = this.#scroller();
      if (scroller) scroller.scrollTop = 0;
    }
    this.#chaseScrollTarget(model.rowCount);
    if (
      this.#columnsChanged ||
      this.#groupsChanged ||
      changed.has('columnSizing') ||
      changed.has('columnOrder') ||
      changed.has('columnPinning') ||
      changed.has('columnVisibility') ||
      this.#autoWidthsChanged ||
      this.#selectionColumnChanged
    ) {
      this.#pinScroll.measure();
    }
    // Rows that just changed height move with the next update: focus them there.
    if (this.#focusPending && !resized) {
      this.#focusPending = false;
      this.#focusActive();
    }
    if (changed.has('density') || changed.has('rowHeight')) this.#measureRowHeight();
    this.#fireApplied(this.#appliedResizes, COLUMN_SIZING_CHANGE);
    if (this.#announceMove) {
      this.#announceMoved(model, this.#announceMove);
      this.#announceMove = undefined;
    }
    this.#fireApplied(this.#appliedReorders, COLUMN_ORDER_CHANGE);
    this.#fireApplied(this.#appliedPins, COLUMN_PINNING_CHANGE);
    this.#fireApplied(this.#appliedHides, COLUMN_VISIBILITY_CHANGE);
    this.#fireApplied(this.#appliedFilters, COLUMN_FILTERS_CHANGE);
    if (this.#announceRows) {
      this.#announceRows = false;
      this.#announceRowCount(model);
    }
    if (this.#appliedSort) {
      const sorting = this.#appliedSort;
      this.#appliedSort = undefined;
      fire(this, SORTING_CHANGE, { sorting });
    }
    if (this.#appliedSelection) {
      const selection = this.#appliedSelection;
      this.#appliedSelection = undefined;
      fire(this, SELECTION_CHANGE, { selection });
    }
    const { range } = this.#window;
    const key = range ? `${String(range.start)}:${String(range.end)}` : '';
    if (range && key !== this.#lastRange) {
      this.#lastRange = key;
      fire(this, RANGE_CHANGE, { first: range.start, last: range.end });
    }
    if (range) {
      // The rendered rows: visible plus overscan, end exclusive.
      const over = Math.max(0, this.overscan);
      this.#data.request(Math.max(0, range.start - over), range.end + 1 + over);
    }
    for (const detail of this.#data.takeErrors()) fire(this, LOAD_ERROR, detail);
  }

  /**
   * Columns to render wherever they are, with `virtualizeColumns`: the active
   * cell's (its tab stop and focus survive scrolling sideways, and keyboard
   * moves land on a rendered cell), one being dragged, auto widths still to
   * measure, the targets of `autosizeColumns()`, and with a `dataSource` the
   * first data column, which holds the Retry buttons.
   */
  #keptColumns(model: TableModel<T, CellContent>): (string | undefined)[] {
    return [
      this.#active?.col,
      // A dragged column, not a group's: their headers needn't render out of view.
      ...(this.#drag?.key.startsWith('c:') ? this.#drag.columns : []),
      this.dataSource ? model.columns.find((c) => c.kind === 'data')?.id : undefined,
      ...this.#autoWidths.pending(model.columns),
      ...this.#measureKeep,
      this.#scrollKeep,
    ];
  }

  /** Fires the events of changes the table applied itself, once the update is done. */
  #fireApplied(applied: Map<string, unknown>, name: string): void {
    if (applied.size === 0) return;
    const details = [...applied.values()];
    applied.clear();
    for (const detail of details) fire(this, name, detail);
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
    const labels = this.#labels;
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
      retry.set(index, labels.retryRows({ first: start + 1, last: end }));
    }
    return {
      stateAt: (index) => cache.stateAt(index),
      retry,
      retryText: labels.retry,
      onRetry: this.#onRetry,
    };
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
      const group = this.#groupCellOf(handle.dataset.resizeGroup);
      if (group) {
        const starts = this.#groupWidths(group.columns);
        const total = [...starts.values()].reduce((sum, w) => sum + w, 0);
        startResizeDrag(handle, event, total, this.#direction(), (w) => {
          this.#requestGroupResize(group.columns, starts, w);
        });
        return;
      }
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
      if (!(handle instanceof HTMLElement)) return;
      // A group's handle fits each of its columns (`autosizeColumns()` for them).
      const group = this.#groupCellOf(handle.dataset.resizeGroup);
      if (group) {
        void this.autosizeColumns([...group.columns]);
        return;
      }
      const id = handle.dataset.resizeCol;
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
    const origin = event.composedPath()[0] ?? event.target ?? this;
    const group = groupCell(origin);
    const cell = gridCell(origin) ?? group;
    const id = cell?.dataset.col;
    if (!cell || (id === undefined && !group)) return;
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
    if (group || id === undefined) {
      this.#groupKey(event, cell, scroller);
      return;
    }
    const pluginTarget = id === SELECTION_COLUMN_ID ? undefined : this.#cellTarget(event);
    if (pluginTarget && this.#plugins.keydown(event, pluginTarget)) return;
    const inHeader = cell.getAttribute('role') === 'columnheader';
    const { key } = event;
    const arrow = key === 'ArrowLeft' || key === 'ArrowRight';
    if (inHeader && arrow && event.altKey) {
      event.preventDefault();
      // Logical: the arrow pointing toward the inline end grows the column, or
      // moves it that way with Shift.
      const towardEnd = (key === 'ArrowRight') === (this.#direction() === 1);
      if (event.shiftKey) {
        this.#moveByKey({ kind: 'column', id }, towardEnd ? 1 : -1);
      } else {
        this.#requestResize(
          id,
          this.#currentWidth(id, cell) + (towardEnd ? RESIZE_STEP : -RESIZE_STEP),
        );
      }
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
    const from = gridRowOfCell(cell, layout);
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
          // The top header of the first column: its outermost group, else its header.
          pos = this.#headerLevelDown(model, 0, columns[0]?.id ?? id);
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
    let row = layout.at(pos) ?? layout.leafHeader;
    const target = columns[Math.min(Math.max(col, 0), columns.length - 1)];
    if (!target) return;
    if (row.section === 'header' && row.index < layout.header - 1 && key === 'ArrowUp') {
      // Up from a column header: to the nearest group above it, if there is one.
      const level = this.#headerLevelUp(model, row.index, target.id);
      if (level === undefined) return;
      row = { section: 'header', index: level };
    }
    // PageUp/PageDown scroll by as many rows as focus moved, so the focused cell
    // keeps its place on screen. The ends clamp; focusing scrolls the rest of
    // the way. Through the virtualizer: a scaled body's px aren't rows.
    if (key.startsWith('Page') && from.section === 'body' && row.section === 'body') {
      this.#virtual.scrollBy(this.#virtual.startOf(row.index) - this.#virtual.startOf(from.index));
    }
    // Ctrl+End onto a bottom pinned row: show the end of the body too, as
    // Ctrl+Home shows its start.
    if (corner && key === 'End' && row.section === 'bottom') {
      this.#virtual.scrollToEdge('end');
    }
    this.#moveTo(row, target.id, model);
  };

  /**
   * The header row to go to from header row `level` down, over a column: the first
   * group row from `level` with a group over it, else the column headers.
   */
  #headerLevelDown(model: TableModel<T, CellContent>, level: number, columnId: string): number {
    const leaf = model.headerGroups.length;
    for (let l = level; l < leaf; l++) {
      if (model.headerCell(l, columnId)?.kind === 'group') return l;
    }
    return leaf;
  }

  /** The first group row from `level` up with a group over a column, or `undefined`. */
  #headerLevelUp(
    model: TableModel<T, CellContent>,
    level: number,
    columnId: string,
  ): number | undefined {
    for (let l = Math.min(level, model.headerGroups.length - 1); l >= 0; l--) {
      if (model.headerCell(l, columnId)?.kind === 'group') return l;
    }
    return undefined;
  }

  /**
   * Keys on a focused group header. Arrows move between group headers in its row
   * (fillers are skipped) and to the headers above and below it; ArrowDown ends on
   * the column headers. Home and End go to the row's first and last group,
   * PageDown into the body, Ctrl+Home and Ctrl+End to the corners, and
   * Alt+Shift+Arrow moves the group. Groups don't sort or resize.
   */
  #groupKey(event: KeyboardEvent, cell: HTMLElement, scroller: HTMLElement): void {
    const model = this.#table.model;
    const layout = layoutOf(model);
    const at = gridRowOf(cell.parentElement, layout);
    const row = at?.section === 'header' ? model.headerGroups[at.index] : undefined;
    const here = row?.find((c) => c.key === cell.dataset.groupKey);
    if (!at || !row || here?.groupId === undefined) return;
    const level = at.index;
    const active = this.#active;
    const anchor =
      active?.section === 'header' && active.index === level && here.columns.includes(active.col)
        ? active.col
        : here.columns[0];
    if (anchor === undefined) return;
    const { key } = event;
    const arrow = key === 'ArrowLeft' || key === 'ArrowRight';
    const towardEnd = (key === 'ArrowRight') === (this.#direction() === 1);
    if (arrow && event.altKey) {
      event.preventDefault();
      if (event.shiftKey) {
        this.#moveByKey({ kind: 'group', id: here.groupId, pin: here.pin }, towardEnd ? 1 : -1);
      } else if (here.resizable) {
        const starts = this.#groupWidths(here.columns);
        const total = [...starts.values()].reduce((sum, w) => sum + w, 0);
        this.#requestGroupResize(
          here.columns,
          starts,
          total + (towardEnd ? RESIZE_STEP : -RESIZE_STEP),
        );
      }
      return;
    }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      return;
    }
    if (this.#selectionKey(event, cell, anchor, true, scroller)) return;
    const corner = event.ctrlKey || event.metaKey;
    if (event.altKey || event.shiftKey || (corner && key !== 'Home' && key !== 'End')) return;
    const groups = row.filter((c) => c.kind === 'group');
    const columns = model.columns;
    let to: { row: GridRow; col: string } | undefined;
    switch (key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const col = groups[groups.indexOf(here) + (towardEnd ? 1 : -1)]?.columns[0];
        if (col !== undefined) to = { row: at, col };
        break;
      }
      case 'Home':
      case 'End':
        if (corner) {
          const first = key === 'Home';
          const col = (first ? columns[0] : columns.at(-1))?.id;
          if (col === undefined) break;
          if (first) this.#virtual.scrollToEdge('start');
          else if (layout.bottom > 0) this.#virtual.scrollToEdge('end');
          const pos = first ? this.#headerLevelDown(model, 0, col) : layout.total - 1;
          to = { row: layout.at(pos) ?? layout.leafHeader, col };
        } else {
          const col = (key === 'Home' ? groups[0] : groups.at(-1))?.columns[0];
          if (col !== undefined) to = { row: at, col };
        }
        break;
      case 'ArrowDown':
        to = {
          row: { section: 'header', index: this.#headerLevelDown(model, level + 1, anchor) },
          col: anchor,
        };
        break;
      case 'ArrowUp': {
        const up = this.#headerLevelUp(model, level - 1, anchor);
        if (up !== undefined) to = { row: { section: 'header', index: up }, col: anchor };
        break;
      }
      case 'PageDown': {
        const pos = this.#verticalStep(key, layout.position(at), layout, scroller);
        to = { row: layout.at(pos) ?? at, col: anchor };
        break;
      }
      case 'PageUp':
        break;
      default:
        return;
    }
    event.preventDefault();
    if (to) this.#moveTo(to.row, to.col, model);
  }

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
    const page = this.#pageRows(key, pos, layout, scroller);
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

  /** How many rows PageUp/PageDown move from grid position `pos`. */
  #pageRows(key: string, pos: number, layout: RowLayout, scroller: HTMLElement): number {
    if (this.rowHeight !== 'auto') {
      // Whole rows between the sticky header rows and pinned rows (each one row tall).
      const fit = Math.floor(scroller.clientHeight / this.#rowPx + 0.01);
      return Math.max(1, fit - layout.header - layout.top - layout.bottom);
    }
    // The body rows that fit between the header and the pinned rows, from the
    // focused body row (or the body's first or last row).
    const view = scroller.clientHeight - this.#headerAndPinnedPx(layout);
    const bodyFirst = layout.position({ section: 'body', index: 0 });
    const from = Math.min(Math.max(pos - bodyFirst, 0), Math.max(layout.body - 1, 0));
    return this.#virtual.pageRows(from, key === 'PageDown', view);
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
      this.#selectAll();
      return true;
    }
    if (command) return false;
    if (inHeader) {
      // Space on the select-all header does what its checkbox does.
      if (key !== ' ' || col !== SELECTION_COLUMN_ID || mode !== 'multi') return false;
      event.preventDefault();
      this.#toggleAll();
      return true;
    }
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
    if (key.startsWith('Page')) {
      this.#virtual.scrollBy(this.#virtual.startOf(to.index) - this.#virtual.startOf(from.index));
    }
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
      const group = groupCell(target);
      if (group) {
        this.#focusGroup(group);
        return;
      }
      const cell = gridCell(target);
      if (cell?.dataset.col !== undefined) {
        const model = this.#table.model;
        const row = gridRowOfCell(cell, layoutOf(model));
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

  /** Focus on a group header makes it active, on the column it was active on, else its first. */
  #focusGroup(cell: HTMLElement): void {
    const model = this.#table.model;
    const row = gridRowOf(cell.parentElement, layoutOf(model));
    const group =
      row && model.headerGroups[row.index]?.find((c) => c.key === cell.dataset.groupKey);
    const first = group?.columns[0];
    if (!row || !group || first === undefined) return;
    const prev = this.#active;
    if (
      prev?.section === 'header' &&
      prev.index === row.index &&
      group.columns.includes(prev.col)
    ) {
      return;
    }
    this.#active = { ...row, rowId: undefined, col: first };
    this.requestUpdate();
  }

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
    // A click in the checkbox column, beside the checkbox, toggles like it.
    const inSelectionCell = path.some(
      (t) => t instanceof HTMLElement && t.dataset.col === SELECTION_COLUMN_ID,
    );
    this.#clickRow(target, event, inSelectionCell || event.ctrlKey || event.metaKey);
  };

  /** Selects for a click on a row, through `clickSelection`. */
  #clickRow(target: SelectionTarget, event: MouseEvent, toggle: boolean): void {
    const model = this.#table.model;
    this.#requestSelection(
      clickSelection(
        this.#selection.value,
        this.#mode(),
        target,
        this.#anchorAt(model),
        { toggle, range: event.shiftKey },
        (index) => model.rowAt(index)?.id,
      ),
    );
  }

  /**
   * The checkboxes' handlers. The table owns their state: a click asks for a new
   * selection, and the render that always follows sets every box back to the
   * selection (`live()`), so a change a controlled host turns down unticks it
   * again. Not `preventDefault()`: for a real click the browser runs that render
   * inside the dispatch, then undoes the toggle after it, over the render. A
   * press leaves focus on the cell, so the grid's keys keep working.
   */
  readonly #checkboxHandlers: CheckboxHandlers = {
    row: (event) => {
      const index = Number((event.currentTarget as HTMLElement).dataset.row);
      const id = this.#table.model.rowAt(index)?.id;
      if (id !== undefined) this.#clickRow({ id, index }, event, true);
      this.requestUpdate();
    },
    all: () => {
      this.#toggleAll();
      this.requestUpdate();
    },
    press: (event) => {
      event.preventDefault();
      (event.currentTarget as HTMLElement).parentElement?.focus({ preventScroll: true });
    },
  };

  /** Selects every selectable row, keeping the others (with a `dataSource`: the loaded ones). */
  #selectAll(): void {
    const ids = this.#table.model.selectableIds();
    this.#requestSelection({
      selection: selectAll(this.#selection.value, ids),
      anchor: this.#anchor,
    });
  }

  /** The select-all checkbox: clears the selection when every row is selected, else selects all. */
  #toggleAll(): void {
    if (this.#checkAllState(this.#table.model) === 'all') {
      this.#requestSelection({ selection: [], anchor: this.#anchor });
    } else {
      this.#selectAll();
    }
  }

  /** The select-all checkbox, in the checkbox column of a `multi` table. */
  #checkAllOf(model: TableModel<T, CellContent>): CheckAll | undefined {
    if (!this.#selectionColumn || this.#mode() !== 'multi') return undefined;
    return { state: this.#checkAllState(model), handlers: this.#checkboxHandlers };
  }

  /**
   * Whether all, some or none of the selectable rows are selected. With `data`
   * it's worked out once per selection and rows shown, not on scroll;
   * with a `dataSource` every time, over the loaded rows, which eviction keeps few.
   */
  #checkAllState(model: TableModel<T, CellContent>): CheckAll['state'] {
    const count = (): CheckAll['state'] => {
      const ids = model.selectableIds();
      const selected = this.#selectedSet();
      const n = ids.reduce((sum, id) => (selected.has(id) ? sum + 1 : sum), 0);
      if (n === 0) return 'none';
      return n === ids.length ? 'all' : 'some';
    };
    if (this.#data.rows) return count();
    // Everything the rows of the model depend on: the data and what filters it.
    const key = [
      this.#selection.value,
      this.data,
      this.getRowId,
      this.#columns,
      this.#filters.value,
      this.#quickFilter,
      this.#visibility.value,
    ];
    const cached = this.#checkAll;
    if (cached?.key.length === key.length && key.every((k, i) => k === cached.key[i])) {
      return cached.state;
    }
    const state = count();
    this.#checkAll = { key, state };
    return state;
  }

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
    const ids = this.#selectedSet();
    return (index) => {
      const id = model.rowAt(index)?.id;
      return id === undefined ? undefined : ids.has(id);
    };
  }

  /** `selection` as a set, rebuilt only when `selection` changes. */
  #selectedSet(): ReadonlySet<string> {
    const selection = this.#selection.value;
    if (this.#selectedIds?.of !== selection) {
      this.#selectedIds = { of: selection, ids: new Set(selection) };
    }
    return this.#selectedIds.ids;
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
    if (id === undefined) return undefined;
    const index = model.indexOf(id);
    return index === undefined ? undefined : { id, index };
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
      fire(this, SELECTION_CHANGE, { selection: value });
    }
  }

  /**
   * Fires `argus-cell-click` (when a cell is on the path), then `argus-row-click`,
   * for the body or pinned row on an event path. Clicks and Enter on a cell use
   * it. Rows that haven't loaded, the header and the checkbox column fire nothing.
   */
  #activate(path: EventTarget[]): void {
    let columnId: string | undefined;
    for (const target of path) {
      if (!(target instanceof HTMLElement)) continue;
      const role = target.getAttribute('role');
      if (role === 'gridcell') columnId = target.dataset.col;
      if (columnId === SELECTION_COLUMN_ID) return;
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
            rowId: row.id,
            index,
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
          rowId: row.id,
          index,
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
    const model = this.#table.model;
    const layout = layoutOf(model);
    // aria-rowindex is unique across the grid: header, pinned and body rows.
    const index = layout.ariaRowIndex(active);
    const row = `[role='row'][aria-rowindex="${String(index)}"]`;
    if (active.section === 'header' && active.index < layout.header - 1) {
      // A group header: focus it, and show the column it is active on.
      const key = model.headerCell(active.index, active.col)?.key ?? '';
      const group = this.renderRoot.querySelector<HTMLElement>(
        `${row} > [data-group-key="${CSS.escape(key)}"]`,
      );
      if (!group) return;
      group.focus({ preventScroll: true });
      const leaf = `[role='row'][aria-rowindex="${String(layout.header)}"] > [data-col="${col}"]`;
      this.renderRoot.querySelector(leaf)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }
    const cell = this.renderRoot.querySelector<HTMLElement>(`${row} > [data-col="${col}"]`);
    if (!cell) return;
    cell.focus({ preventScroll: true });
    // A scaled body moves `ratio` px of rows per px scrolled, so the browser can't
    // scroll a body row into view: the virtualizer does, and the next update
    // (from its scroll) shows the row and scrolls sideways. Rows of different
    // heights too: rows measured on the way can move the row again, so it
    // scrolls until they're done.
    if (active.section === 'body' && (this.#virtual.scaled || this.rowHeight === 'auto')) {
      const { before, after } = this.#bodyInsets(layout);
      if (this.#virtual.reveal(active.index, before, after)) {
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
    const layout = layoutOf(model);
    const leaf = layout.header - 1;
    const prev = this.#active ?? { ...layout.leafHeader, rowId: undefined, col: first.id };
    const col = columns.some((c) => c.id === prev.col)
      ? prev.col
      : this.#columnInPlaceOf(model, prev.col, first.id);
    let { section, index, rowId } = prev;
    // The cell went away with its column while focused: focus its replacement.
    let moved = col !== prev.col && this.#active !== undefined;
    if (section === 'header') {
      if (!this.#active || index === this.#leafLevel) {
        // On the column headers: still there, though group rows came or went above.
        index = leaf;
      } else if (index >= leaf || model.headerCell(index, col)?.kind !== 'group') {
        // Its group went away: to the column's header.
        index = leaf;
        moved = true;
      }
    }
    this.#leafLevel = leaf;
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
      ({ section, index } = layout.leafHeader);
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
   * The shown column that takes a hidden column's place: the next one in the
   * column order, else the one before it. `fallback` for a column that is gone
   * altogether.
   */
  #columnInPlaceOf(model: TableModel<T, CellContent>, id: string, fallback: string): string {
    const all = model.allColumns;
    const at = all.findIndex((c) => c.id === id);
    if (at < 0) return fallback;
    const shown = (c: ColumnView<T, CellContent>) => !c.hidden;
    return (all.slice(at + 1).find(shown) ?? all.slice(0, at).findLast(shown))?.id ?? fallback;
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

  /** The group header cell with a key, from the model. */
  #groupCellOf(key: string | undefined) {
    if (key === undefined) return undefined;
    return this.#table.model.headerGroups.flat().find((c) => c.key === key);
  }

  /**
   * The widths a group resize starts from, by column: the latest requested ones
   * (key presses can come faster than renders), else the model's, else the
   * rendered width of a flex column.
   */
  #groupWidths(columnIds: readonly string[]): Map<string, number> {
    const widths = new Map<string, number>();
    for (const id of columnIds) {
      const header = this.renderRoot.querySelector<HTMLElement>(
        `[part~='header-cell'][data-col="${CSS.escape(id)}"]`,
      );
      const view = this.#table.model.columns.find((c) => c.id === id);
      const sized = this.#sizing.value[id];
      widths.set(id, sized ?? (header ? this.#currentWidth(id, header) : (view?.width ?? 0)));
    }
    return widths;
  }

  /**
   * Resizes a group to `total` px: the change is spread over its resizable columns
   * in proportion to their widths, within their bounds (one `argus-column-sizing-change`
   * per column that changes). The other columns keep their width.
   */
  #requestGroupResize(
    columnIds: readonly string[],
    starts: ReadonlyMap<string, number>,
    total: number,
  ): void {
    const views = new Map(this.#table.model.columns.map((c) => [c.id, c]));
    let fixed = 0;
    const spread = [];
    for (const id of columnIds) {
      const view = views.get(id);
      const width = starts.get(id) ?? view?.width ?? 0;
      if (view?.resizable) {
        spread.push({ id, width, minWidth: view.minWidth, maxWidth: view.maxWidth });
      } else {
        fixed += width;
      }
    }
    if (spread.length === 0) return;
    this.#requestResizes(spreadWidth(spread, total - fixed));
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
   * controlled/uncontrolled rules. One `argus-column-sizing-change` per column
   * that changes, each with the whole new sizing.
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
    const details = targets.map(([columnId, width]) => ({ columnSizing: value, columnId, width }));
    if (applied) {
      // Only the latest width per column fires, all with the latest sizing.
      for (const detail of this.#appliedResizes.values()) detail.columnSizing = value;
      for (const detail of details) this.#appliedResizes.set(detail.columnId, detail);
      this.requestUpdate('columnSizing', old);
    } else {
      for (const detail of details) fire(this, COLUMN_SIZING_CHANGE, detail);
    }
  }

  /**
   * Pins or unpins a column through the controlled/uncontrolled rules. Starts
   * from the latest requested pins, so requests can come faster than renders.
   */
  #requestPin(columnId: string, pin: ColumnPin | false): void {
    const old = this.#pinning.value;
    const next = this.#table.model.nextPinning(columnId, pin, old);
    if (!next) return;
    const { value, applied } = this.#pinning.request(next);
    if (applied) {
      for (const detail of this.#appliedPins.values()) detail.columnPinning = value;
      this.#appliedPins.set(columnId, { columnPinning: value, columnId, pin });
      this.requestUpdate('columnPinning', old);
    } else {
      fire(this, COLUMN_PINNING_CHANGE, { columnPinning: value, columnId, pin });
    }
  }

  /** Hides or shows a column through the controlled/uncontrolled rules. */
  #requestHide(columnId: string, hidden: boolean): void {
    const old = this.#visibility.value;
    const next = this.#table.model.nextVisibility(columnId, hidden, old);
    if (!next) return;
    const { value, applied } = this.#visibility.request(next);
    if (applied) {
      for (const detail of this.#appliedHides.values()) detail.columnVisibility = value;
      this.#appliedHides.set(columnId, { columnVisibility: value, columnId, visible: !hidden });
      this.requestUpdate('columnVisibility', old);
    } else {
      fire(this, COLUMN_VISIBILITY_CHANGE, { columnVisibility: value, columnId, visible: !hidden });
    }
  }

  /** Sets or clears a column's filter through the controlled/uncontrolled rules. */
  #requestFilter(columnId: string, filter: ColumnFilter | undefined): void {
    const old = this.#filters.value;
    const next = this.#table.model.nextFilters(columnId, filter, old);
    if (!next) return;
    const { value, applied } = this.#filters.request(next);
    if (applied) {
      for (const detail of this.#appliedFilters.values()) detail.columnFilters = value;
      this.#appliedFilters.set(columnId, { columnFilters: value, columnId, columnFilter: filter });
      this.requestUpdate('columnFilters', old);
    } else {
      fire(this, COLUMN_FILTERS_CHANGE, {
        columnFilters: value,
        columnId,
        columnFilter: filter,
      });
    }
  }

  /**
   * Says how many rows the filters leave ("42 rows"). With a `dataSource` the count
   * isn't known until the first page answers, so nothing is said.
   */
  #announceRowCount(model: TableModel<T, CellContent>): void {
    if (this.#data.rows) return;
    announce(this.ownerDocument, this.#labels.rowCount({ count: model.rowCount }));
  }

  /**
   * Moves a column or group to position `to` among its siblings (the columns and
   * groups of its parent group on its pin side), through the controlled/uncontrolled
   * rules. Starts from the latest requested order, so moves can come faster than
   * renders. `false` if it can't move there.
   */
  #requestReorder(unit: OrderUnit, to: number): boolean {
    const old = this.#order.value;
    const model = this.#table.model;
    const moving = model.siblingUnits(unit, old).find((s) => sameUnit(s.unit, unit));
    const next = model.nextMove(unit, to, old);
    const columnId = moving?.columns[0];
    if (!next || columnId === undefined) return false;
    const detail = (columnOrder: ColumnOrderState): ColumnOrderChangeDetail =>
      unit.kind === 'group'
        ? { columnOrder, columnId, groupId: unit.id }
        : { columnOrder, columnId };
    const { value, applied } = this.#order.request(next);
    if (applied) {
      for (const pending of this.#appliedReorders.values()) pending.columnOrder = value;
      this.#appliedReorders.set(unitKey(unit), detail(value));
      this.requestUpdate('columnOrder', old);
    } else {
      fire(this, COLUMN_ORDER_CHANGE, detail(value));
    }
    return true;
  }

  /** Alt+Shift+Arrow on a column or group header: one step toward the start (-1) or the end (1). */
  #moveByKey(unit: OrderUnit, step: 1 | -1): void {
    const model = this.#table.model;
    // From the latest requested order, so presses can come faster than renders.
    // Positions count the shown columns and groups: hidden columns keep their place.
    const from = model
      .siblingUnits(unit, this.#order.value)
      .findIndex((s) => sameUnit(s.unit, unit));
    const at = this.#colIndexOf(model, unit);
    if (from < 0 || at === undefined) return;
    if (!this.#requestReorder(unit, from + step)) return;
    // The header node moves, which drops its focus: focus it again once rendered.
    this.#focusPending = true;
    this.#announceMove ??= { unit, from: at };
    this.requestUpdate();
  }

  /** `aria-colindex` of a column's header, or of a group's first column on its side. */
  #colIndexOf(model: TableModel<T, CellContent>, unit: OrderUnit): number | undefined {
    if (unit.kind === 'column') return model.columns.find((c) => c.id === unit.id)?.colIndex;
    const key = unitKey(unit);
    return model.headerGroups.flat().find((c) => c.key === key)?.colIndex;
  }

  /** Tells screen readers where a column or group moved from the keyboard went. */
  #announceMoved(model: TableModel<T, CellContent>, move: { unit: OrderUnit; from: number }): void {
    const { unit } = move;
    const total = model.columns.length;
    const labels = this.#labels;
    if (unit.kind === 'column') {
      const view = model.columns.find((c) => c.id === unit.id);
      if (!view || view.colIndex === move.from) return;
      const name = this.#slotText(
        `[role='columnheader'][data-col="${CSS.escape(unit.id)}"] > slot`,
      );
      announce(
        this.ownerDocument,
        labels.columnMoved({ column: name || unit.id, position: view.colIndex, total }),
      );
      return;
    }
    const key = unitKey(unit);
    const cell = model.headerGroups.flat().find((c) => c.key === key);
    if (!cell || cell.colIndex === move.from) return;
    const name = this.#slotText(`[data-group-key="${CSS.escape(key)}"] slot`);
    announce(
      this.ownerDocument,
      labels.groupMoved({
        group: name || unit.id,
        first: cell.colIndex,
        last: cell.colIndex + cell.span - 1,
        total,
      }),
    );
  }

  /** The text slotted into a header, read through the slot's assigned nodes. */
  #slotText(selector: string): string {
    const slot = this.renderRoot.querySelector(selector);
    return slot instanceof HTMLSlotElement
      ? slot
          .assignedNodes({ flatten: true })
          .map((n) => n.textContent)
          .join('')
          .trim()
      : '';
  }

  /** A press on a reorderable column or group header: becomes a drag once the pointer moves. */
  #startReorder(down: PointerEvent): void {
    const cell = down
      .composedPath()
      .find(
        (t): t is HTMLElement =>
          t instanceof HTMLElement && t.getAttribute('role') === 'columnheader',
      );
    if (!cell || !canStartReorder(down, cell)) return;
    const model = this.#table.model;
    let unit: OrderUnit;
    if (cell.dataset.moveCol !== undefined) {
      unit = { kind: 'column', id: cell.dataset.moveCol };
    } else {
      const key = cell.dataset.moveGroup;
      const group = model.headerGroups.flat().find((c) => c.key === key);
      if (group?.groupId === undefined) return;
      unit = { kind: 'group', id: group.groupId, pin: group.pin };
    }
    const scroller = this.#scroller();
    const moving = model.siblingUnits(unit).find((s) => sameUnit(s.unit, unit));
    if (!scroller || !moving) return;
    const key = unitKey(unit);
    const columns = new Set(moving.columns);
    const pin = unit.kind === 'group' ? unit.pin : model.columns.find((c) => c.id === unit.id)?.pin;
    startReorderDrag(cell, down, {
      scroller,
      targetAt: (x) => dropTarget(this.#dropSlots(unit), key, x, this.#direction()),
      scrollArea: () => (pin === undefined ? this.#scrollArea(scroller) : undefined),
      onStart: () => {
        this.#drag = { key, columns, target: undefined };
        this.requestUpdate();
      },
      onTarget: (target) => {
        this.#drag = { key, columns, target };
        this.requestUpdate();
      },
      onDrop: (target) => {
        this.#drag = undefined;
        if (target && this.#requestReorder(unit, target.to)) {
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

  /**
   * The rendered headers of what a column or group moves among (see
   * `siblingUnits`), with their positions there. With `virtualizeColumns`, columns
   * out of view have no header and no slot.
   */
  #dropSlots(unit: OrderUnit): DropSlot[] {
    const slots: DropSlot[] = [];
    this.#table.model.siblingUnits(unit).forEach((sibling, index) => {
      const id = unitKey(sibling.unit);
      const cell = this.renderRoot.querySelector(
        sibling.unit.kind === 'column'
          ? `[role='columnheader'][data-col="${CSS.escape(sibling.unit.id)}"]`
          : `[data-group-key="${CSS.escape(id)}"]`,
      );
      if (cell) slots.push({ id, index, rect: cell.getBoundingClientRect() });
    });
    return slots;
  }

  /** Where the scrolling columns show: the scroller's inside, less the pinned columns. */
  #scrollArea(scroller: HTMLElement): { left: number; right: number } {
    const width = (side: 'start' | 'end') => pinnedWidth(this.#table.model.columns, side);
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
    if (next) this.#applySorting(next);
  }

  /**
   * A plugin's sort: by a column in a direction, or (`null`) cleared if it is by
   * that column. Only sortable columns, and only a change.
   */
  #setSort(columnId: string, direction: SortDirection | undefined): void {
    const view = this.#table.model.columns.find((c) => c.id === columnId);
    if (view?.kind !== 'data' || !view.sortable) return;
    const sorted = view.sorted === false ? undefined : view.sorted;
    if (direction === sorted) return;
    if (direction === undefined) this.#applySorting([]);
    else this.#applySorting([{ id: columnId, desc: direction === 'desc' }]);
  }

  /** A new sort order, through the controlled/uncontrolled rules. */
  #applySorting(next: SortState): void {
    const old = this.#sorting.value;
    const { value, applied } = this.#sorting.request(next);
    if (applied) {
      this.#appliedSort = value;
      this.requestUpdate('sorting', old);
    } else {
      fire(this, SORTING_CHANGE, { sorting: value });
    }
  }

  /**
   * A data column as plugins see it. Header functions call this on every
   * render, so the views are indexed by id once per new column list.
   */
  #columnInfo(id: string): ColumnInfo | undefined {
    const columns = this.#table.model.allColumns;
    if (this.#columnsById?.of !== columns) {
      this.#columnsById = { of: columns, byId: new Map(columns.map((c) => [c.id, c])) };
    }
    const view = this.#columnsById.byId.get(id);
    if (view?.kind !== 'data') return undefined;
    return {
      id,
      sortable: view.sortable,
      resizable: view.resizable,
      pinnable: view.pinnable,
      hideable: view.hideable,
      pin: view.pin,
      hidden: view.hidden,
      width: view.width,
      sorted: view.sorted === false ? undefined : view.sorted,
      filter: view.filter,
      columnFilter: this.#filters.value[id],
    };
  }

  /** The header or cell an event happened in, for plugins. */
  #cellTarget(event: Event): CellTarget | undefined {
    for (const target of event.composedPath()) {
      const cell = gridCell(target);
      const columnId = cell?.dataset.col;
      if (!cell || columnId === undefined) continue;
      const model = this.#table.model;
      const row = gridRowOfCell(cell, layoutOf(model));
      if (!row) return undefined;
      return {
        section: row.section,
        columnId,
        // `0` for the column headers, whatever group rows are above them.
        rowIndex: row.section === 'header' ? 0 : row.index,
        rowId: this.#gridRowId(model, row),
      };
    }
    return undefined;
  }

  #observeProbe(): void {
    const probe = this.renderRoot.querySelector('.probe');
    if (!probe) return;
    this.#probeObserver ??= new ResizeObserver(() => {
      this.#measureRowHeight();
    });
    this.#probeObserver.observe(probe);
  }

  /** The height of the rows pinned to one side: one row each, or measured with `rowHeight: 'auto'`. */
  #pinnedPx(side: 'top' | 'bottom', layout: RowLayout): number {
    const count = side === 'top' ? layout.top : layout.bottom;
    if (this.rowHeight !== 'auto' || count === 0) return count * this.#rowPx;
    return Math.max(this.#rowMeasure.pinned[side], count * this.#rowPx);
  }

  /** The header rows and the pinned rows: the rows in the scroller besides the body. */
  #headerAndPinnedPx(layout: RowLayout): number {
    return (
      layout.header * this.#rowPx + this.#pinnedPx('top', layout) + this.#pinnedPx('bottom', layout)
    );
  }

  /**
   * `rowHeight: 'auto'`: reads the heights of the rendered rows, after their
   * content has rendered. Returns whether any changed (an update is requested).
   */
  #measureRows(): boolean {
    const { rows, pinnedChanged } = this.#rowMeasure.read(this.renderRoot);
    const resized = this.#virtual.measureRows(rows);
    if (pinnedChanged) this.requestUpdate();
    return resized || pinnedChanged;
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
