import {
  LitElement,
  html,
  type CSSResultGroup,
  type PropertyValues,
  type RootPart,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  controllable,
  RowLayout,
  type ColumnView,
  type Controllable,
  type GridRow,
  type TableModel,
} from '@argus-table/core';
import { announce } from './announce.js';
import { columnInfoOf, pluginHeader, pluginHeaderText } from './plugin-host.js';
import { activate, cellTargetOf } from './cell-events.js';
import { AutoWidths, measureColumns } from './controllers/auto-width.js';
import { ColumnChildrenController } from './controllers/column-children.js';
import { ColumnWindowController, type RenderedColumn } from './controllers/column-window.js';
import { DataController } from './controllers/data-controller.js';
import { KeyboardRouter } from './controllers/keyboard.js';
import { FitHeight } from './controllers/fit-height.js';
import { PinScrollController } from './controllers/pin-scroll-controller.js';
import { PluginController, sameItems } from './controllers/plugins.js';
import { RowMeasure } from './controllers/row-measure.js';
import { TableController } from './controllers/table-controller.js';
import { ColumnReorder } from './controllers/column-reorder.js';
import { ColumnResize } from './controllers/column-resize.js';
import { NavigationController } from './controllers/navigation.js';
import { SelectionController } from './controllers/selection.js';
import { restore, StateEvents } from './controllers/state-events.js';
import { ScrollTarget } from './controllers/scroll-target.js';
import { VirtualController, type VirtualWindow } from './controllers/virtual-controller.js';
import { virtualConfig, type LaidOut } from './controllers/virtual-config.js';
import {
  COLUMN_FILTERS_CHANGE,
  COLUMN_ORDER_CHANGE,
  COLUMN_PINNING_CHANGE,
  COLUMN_RESIZE_END,
  COLUMN_SIZING_CHANGE,
  COLUMN_VISIBILITY_CHANGE,
  EXPANDED_CHANGE,
  fire,
  LOAD_ERROR,
  RANGE_CHANGE,
  SELECTION_CHANGE,
  SORTING_CHANGE,
  TREE_EXPANDED_CHANGE,
} from './events.js';
import { resolveLabels, type TableLabels } from './labels.js';
import { watchMaxElementHeight } from './max-height.js';
import { renderBody, type ActiveCell } from './render/body.js';
import { loadingState, rowToggles, treeRows } from './render/body-state.js';
import { contentFirst, lightCount, renderLightDom } from './render/cells.js';
import { detailSlot } from './render/content.js';
import { DetailContent, type RenderedPanel } from './render/detail-content.js';
import { content, flushContent, type ContentRenderer } from './render/content-directive.js';
import { renderHeader } from './render/header.js';
import { renderPinnedRows } from './render/pinned-rows.js';
import type { ArgusPlugin, ColumnInfo, PluginHost, RowSection } from './plugins.js';
import { baseStyles } from './styles/base.js';
import { rowHeightConverter, switchConverter } from './attributes.js';
import {
  gridCell,
  gridRowOf,
  gridRowOfCell,
  layoutOf,
  pinnedWidth,
  pinShadow,
  positionOfIndex,
  edgeRuns,
  renderEdgeRuns,
  sortColumnOf,
  track,
} from './grid.js';
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
  ExpandedState,
  PinnedRows,
  RowDetailContext,
  RowTarget,
  ScrollToColumnOptions,
  ScrollToRowOptions,
  SelectionMode,
  SelectionState,
  SortDirection,
  SortState,
  TableState,
  TreeExpandedState,
} from './types.js';

/**
 * The host carries the grid role (`treegrid` once the rows form a tree), so rows
 * rendered in the shadow root become its children in the accessibility tree.
 * ElementInternals sets the default;
 * `connectedCallback` also adds a `role` attribute, because tools such as
 * axe-core can't see the ElementInternals role. A `role` the page sets wins.
 */
function attachGridInternals(host: HTMLElement): ElementInternals {
  const internals = host.attachInternals();
  internals.role = 'grid';
  return internals;
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
 * @fires {CustomEvent<ColumnSizingChangeDetail>} argus-column-sizing-change - `columnSizing` changed: a column was resized by dragging its handle, with Alt+Arrow on its header, by a double-click on its handle (fit to content) or by `autosizeColumns()`. `detail: { columnSizing, columnId, width }`. Fires on every frame of a drag, and once per column that changes (a group resize, `autosizeColumns()`); to save widths once a resize is done, listen to `argus-column-resize-end`. The new value fires after the update that applied it; when the property is controlled, the proposed value fires right away and nothing changes until the host sets it.
 * @fires {CustomEvent<ColumnResizeEndDetail>} argus-column-resize-end - A resize is done: a drag on a column's or group's resize handle was released, an Alt+Arrow press resized a column or group, or a double-click on a handle or `autosizeColumns()` fit columns to their content. Fires once, after that resize's `argus-column-sizing-change` events, and only if a width changed. `detail: { columnSizing, columnIds }`: the sizing after the resize (the last proposed one when `columnSizing` is controlled) and the columns it changed. Not fired when `columnSizing` or `setState()` set the widths. Use it to save widths without saving on every frame of a drag.
 * @fires {CustomEvent<ColumnOrderChangeDetail>} argus-column-order-change - `columnOrder` changed: a column or column group was moved by dragging its header, or with Alt+Shift+Arrow on its focused header. Columns move within their pin side (start-pinned, scrolling, end-pinned) and their column group; groups move as a whole. `detail: { columnOrder, columnId, groupId? }`: `groupId` is set when a group moved, and `columnId` is then its first column. Fires once per move, on drop. The new value fires after the update that applied it; when the property is controlled, the proposed value fires right away and nothing changes until the host sets it.
 * @fires {CustomEvent<ColumnPinningChangeDetail>} argus-column-pinning-change - `columnPinning` changed: a column was pinned to a side or unpinned, through a plugin such as the column menu. `detail: { columnPinning, columnId, pin }`: `pin` is `'start'`, `'end'` or `false`. The new value fires after the update that applied it; when the property is controlled, the proposed value fires right away and nothing changes until the host sets it.
 * @fires {CustomEvent<ColumnVisibilityChangeDetail>} argus-column-visibility-change - `columnVisibility` changed: a column was hidden or shown, through a plugin such as the column menu. `detail: { columnVisibility, columnId, visible }`: `visible` is `false` when it was hidden. The new value fires after the update that applied it; when the property is controlled, the proposed value fires right away and nothing changes until the host sets it.
 * @fires {CustomEvent<ColumnFiltersChangeDetail>} argus-column-filters-change - `columnFilters` changed: a column's filter was set, changed or cleared, through a plugin such as the column menu. `detail: { columnFilters, columnId, columnFilter }`: `columnFilter` is the column's new filter, or `undefined` when it was cleared. The new value fires after the update that applied it; when the property is controlled, the proposed value fires right away and nothing changes until the host sets it.
 * @fires {CustomEvent<SelectionChangeDetail>} argus-selection-change - `selection` changed: by a click on a row (Ctrl/Cmd toggles, Shift selects a range), with Space, Shift+Arrow or Shift+PageUp/PageDown on a body cell, or with Ctrl/Cmd+A. Only with a `selectionMode`. `detail: { selection }`. The new value fires after the update that applied it; when the property is controlled, the proposed value fires right away and nothing changes until the host sets it.
 * @fires {CustomEvent<ExpandedChangeDetail>} argus-expanded-change - `expanded` changed: a row's detail panel was opened or closed with its chevron (a click, or Enter or Space on the chevron cell). Only with `rowDetail`. `detail: { expanded, rowId, open }`: `open` is `true` when it was opened. The new value fires after the update that applied it; when the property is controlled, the proposed value fires right away and nothing changes until the host sets it.
 * @fires {CustomEvent<TreeExpandedChangeDetail>} argus-tree-expanded-change - `treeExpanded` changed: a row of a tree was expanded or collapsed with its toggle (a click) or with Right or Left on its cell in the tree column; not for a row a filter keeps expanded. Only with `getSubRows`, `getParentId`, or a `dataSource` with `hasChildren` and `getChildren`. `detail: { treeExpanded, rowId, open }`: `open` is `true` when it was expanded. The new value fires after the update that applied it; when the property is controlled, the proposed value fires right away and nothing changes until the host sets it.
 * @fires {CustomEvent<CellClickDetail<T>>} argus-cell-click - A body or pinned-row cell was clicked, or Enter was pressed on it. `detail: { row, rowId, index, columnId, value, pinned?, depth? }`; `pinned` is `'top'` or `'bottom'` for a pinned row, and `index` is then its index in its list. `depth` is a body row's level in a tree (`0` for a top-level row), set only when the rows form one. Fires before `argus-row-click`.
 * @fires {CustomEvent<RowClickDetail<T>>} argus-row-click - A body or pinned row was clicked, or Enter was pressed on one of its cells. `detail: { row, rowId, index, pinned?, depth? }`; for a pinned row, `index` is its index in its list. `depth` is a body row's level in a tree (`0` for a top-level row), set only when the rows form one.
 * @fires {CustomEvent<RangeChangeDetail>} argus-range-change - The rows in view changed (rows rendered ahead of the scroll position not counted). `detail: { first, last }` (row indices in the current order, both inclusive).
 * @fires {CustomEvent<LoadErrorDetail>} argus-load-error - A `dataSource` page failed to load: `getRows()` rejected or threw. `detail: { error, start, end }` (`end` exclusive; with tree rows, indexes of the rows shown, so children of open rows above count). The rows show a Retry button. When a row's children failed (`getChildren()` rejected or threw), `detail: { error, start, end, parentId }`: `start` is the row's index (`-1` when it isn't shown: an ancestor collapsed) and `end` that plus one, and a row with a Retry button shows under it. Not for a row collapsed before its children failed: its next expand loads them again.
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
 * @csspart row-loading - Body rows whose `dataSource` page hasn't loaded yet, or failed; in a tree, the row under a row whose children are loading or failed.
 * @csspart row-error - Added to `row-loading` on body rows whose `dataSource` page (or a tree row's children) failed to load.
 * @csspart row-selected - Body rows whose id is in `selection`.
 * @csspart cell-selection - Added to `cell` in the checkbox column (`selectionCheckboxes`), pinned rows included.
 * @csspart header-cell-selection - Added to `header-cell` on the checkbox column's header.
 * @csspart selection-checkbox - The checkboxes of the checkbox column: one per selectable row, and the select-all one in the header (`multi` mode). With `selectBranches`, a row's is `disabled` while ticking it could select nothing (`::part(selection-checkbox):disabled`).
 * @csspart row-detail - The row of a detail panel (`rowDetail`), under the row it belongs to. Also has no `row` part.
 * @csspart detail - A detail panel's one cell: it spans the visible width (it stays in place when the table scrolls sideways), is as tall as its content up to `--argus-detail-max-height`, and scrolls past that.
 * @csspart row-expanded - Added to `row` on a body row whose detail panel is open (`rowDetail`).
 * @csspart cell-expand - Added to `cell` in the toggle column of detail panels (`rowDetail`), pinned rows included.
 * @csspart header-cell-expand - Added to `header-cell` on the toggle column's header: an empty cell (`role="gridcell"`, as an empty column header has no name to read).
 * @csspart expand-toggle - The chevron button that opens and closes a row's detail panel. It is drawn with borders in `currentColor` (`::before`) and has `aria-expanded`.
 * @csspart tree-toggle - The button that expands and collapses a tree row (`getSubRows`, `getParentId`, or a `dataSource` with `hasChildren` and `getChildren`), in the first data column after the row's indent; only rows with children have one. It is drawn with borders in `currentColor` (`::before`) and has `aria-expanded`. While a filter keeps its row expanded (the row holds a match), it has `aria-disabled="true"` and `tree-toggle-disabled`, is dimmed, and does nothing.
 * @csspart tree-toggle-disabled - Added to `tree-toggle` while a filter keeps the row open for its matches; the toggle does nothing until the filter clears.
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
 * @cssprop [--argus-tree-indent=1.25rem] - The indent per level of a tree row (`getSubRows`, `getParentId`, or a `dataSource` with `hasChildren` and `getChildren`), before the toggle in the first data column.
 * @cssprop [--argus-detail-max-height=400px] - The tallest a detail panel (`rowDetail`) is; its content scrolls past it. Style the panel itself (background, padding) through the `detail` part.
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
   *
   * With `hasChildren(row)` and `getChildren({ parent, parentId, sorting, filters,
   * quickFilter, signal })` (resolving to `{ rows }`) the rows form a tree:
   * `getRows` returns the top-level rows (its `start` and `end` count those), and
   * expanding a row (`treeExpanded`) loads all of its children with one
   * `getChildren` call, at every level. A loading row shows under it until the
   * answer, and a row with a Retry button if it fails. Children stay loaded when
   * the row collapses, until the source, the sort, the filters, `getRowId` or
   * `refresh()` change them: then expanded rows load theirs again. Row indexes
   * (events, `scrollToRow`) count the rows shown: top-level rows and the
   * children of expanded ones.
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

  /**
   * Returns a stable id for a row, given the row and its index: in `data`, among
   * all `dataSource` rows (a child from `getChildren`: among its siblings), or
   * for a nested child of a tree (`getSubRows`) its index from `data.length` on,
   * in depth-first order. Default: the index as a string; a nested child's, or a
   * `dataSource` child's, is its parent's id, a dot and its index among its
   * siblings (`'3.0'`, `'3.0.2'`).
   */
  @property({ attribute: false })
  getRowId?: (row: T, index: number) => string;

  /**
   * Nested data: a row's child rows, or `undefined` (or `[]`) for a row without
   * any. `data` then holds the top-level rows, and the rows form a tree: a row's
   * children show under it, indented in the first data column, while it is
   * expanded (`treeExpanded`). In that column, the arrow toward the row's end
   * (Right; Left in a right-to-left table) expands a collapsed row; the other
   * arrow collapses an expanded one, else moves to the parent row. A row a
   * filter keeps open for its matches doesn't collapse. Children are sorted
   * among their siblings, and a filter keeps the rows that match with their
   * ancestors, shown expanded with their toggles disabled until the filter
   * clears. A child's default id is its parent's id, a dot and its index among
   * its siblings (`'3.0'`,
   * `'3.0.2'`); top-level rows keep their index in `data`. Functions given a
   * row's index (`getRowId`, a column's `accessor`) get a child's index from
   * `data.length` on, in depth-first order. Wins over `getParentId` (with a
   * console warning). Ignored with a `dataSource`: use its `hasChildren` and
   * `getChildren`. Property only. Keep the function stable: a new function on
   * every render builds and sorts the tree again, as a new `getRowId` reads
   * every id again.
   */
  @property({ attribute: false })
  getSubRows?: (row: T) => readonly T[] | undefined;

  /**
   * Flat data: the id of a row's parent (an id `getRowId` gives), or `null` or
   * `undefined` for a top-level row. `data` holds every row, and the rows form a
   * tree: a row's children show under it, indented in the first data column,
   * while it is expanded (`treeExpanded`). The keys, and a filter keeping the
   * rows that match with their ancestors, work as with `getSubRows`. Rows keep
   * their index in `data`. A row whose parent isn't found, or that is part of a
   * cycle, shows as a top-level row (with a console warning). `getSubRows` wins
   * when both are set. Ignored with a `dataSource`: use its `hasChildren` and
   * `getChildren`. Property only. Keep the function stable: a new function on
   * every render builds and sorts the tree again.
   */
  @property({ attribute: false })
  getParentId?: (row: T) => string | null | undefined;

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
   * Makes the columns fill the table's width: when the scrolling columns are
   * narrower than the table, they stretch, in proportion to their widths and up
   * to their `maxWidth`. When they're wider, the table scrolls sideways as usual,
   * and columns never get narrower than their own width. A column you resize
   * keeps the width you give it, and the others take the free space; when every
   * column has been resized, the last one does. Pinned columns and the checkbox
   * and chevron columns keep their width, and nothing stretches while a
   * `{ flex }` column takes the space. `columnSizing`, `getState()` and the
   * resize events carry each column's own width, never a stretched one, so a
   * saved layout fits any width. Off by default. As an attribute,
   * `stretch-columns="false"` is off, like no attribute.
   */
  @property({ attribute: 'stretch-columns', converter: switchConverter })
  stretchColumns = false;

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
    return this.#resize.state.value;
  }
  set columnSizing(value: ColumnSizingState | undefined) {
    this.#resize.state.set(value);
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
    return this.#reorder.state.value;
  }
  set columnOrder(value: ColumnOrderState | undefined) {
    this.#reorder.state.set(value);
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
   * The selected rows, as row ids (from `getRowId`, or the default ids: see
   * `getRowId`), e.g. `['p4', 'p7']`. Uncontrolled until set, like `sorting`: once
   * set, a click only fires `argus-selection-change` with the proposed ids.
   * `undefined` hands it back. The table never drops ids on its own: they stay
   * through sorting, a new `data` or reloaded pages. With a `dataSource`,
   * Ctrl/Cmd+A selects the loaded rows only. With `selectBranches` a parent row's
   * id is in it only while its whole branch is selected (see `selectBranches`).
   */
  @property({ attribute: false })
  get selection(): SelectionState {
    return this.#select.state.value;
  }
  set selection(value: SelectionState | undefined) {
    this.#select.state.set(value);
  }

  /**
   * Selects whole branches of a tree (`getSubRows`, `getParentId`, or a
   * `dataSource` with `hasChildren` and `getChildren`), in `multi`
   * `selectionMode` only (ignored in `single` mode and without a tree).
   * Selecting a row, by its checkbox, a click or Space, selects it and its
   * descendants the filters keep, rows under collapsed rows included; rows a
   * filter hides are never selected. A row's id is in `selection` only while its
   * whole branch is selected, rows a filter hides included: selecting the last of
   * a row's children adds the row, deselecting any child removes its ancestors,
   * and under a filter a row whose hidden descendants aren't all selected gets
   * its shown descendants selected, not its own id (so an app acting on
   * `selection` never reaches rows nobody selected). A checkbox is ticked when
   * its row's id and every descendant the filters keep are selected, and
   * part-ticked when some of them are. Selecting a row again when it counts as
   * checked deselects it, its shown descendants and its ancestors (rows a filter
   * hides stay as they are): it counts as checked when it's ticked, or when
   * everything that can be selected under it is, at any depth, while hidden
   * rows keep its id out. Ctrl/Cmd and Shift clicks and Shift+Arrow count each
   * row as its branch, and Ctrl/Cmd+A or the header checkbox selects every row
   * the filters keep, collapsed ones included, by the same rules; the header
   * checkbox is ticked when every one of those counts as checked. A row the
   * filters keep while hiding all its children (it matches, they don't), or
   * with only such rows under it, can't be selected while its id needs them:
   * its checkbox is `disabled`, clicks and Space on it select nothing (a Shift
   * click elsewhere in its row still selects a range), and select-all and the
   * header checkbox leave it out; with only such rows, the header checkbox is
   * disabled too. A controlled `selection` that breaks these rules shows as it
   * is until the user changes it. With a `dataSource` the rules apply to the
   * loaded rows (a row whose children aren't loaded counts as having none),
   * and children that arrive under a selected row join the selection, with
   * the change event. While a filter or quick filter is on, the server may not
   * have sent every child, so a row with children never has its id selected
   * then: selecting it selects the loaded rows under it, and one without
   * loaded children can't be selected until they load.
   */
  @property({ type: Boolean, attribute: 'select-branches' })
  selectBranches = false;

  /**
   * A detail panel for body rows, under the row: a function that gets
   * `{ row, rowId, index, depth? }` (`depth` is the row's level, set only when
   * the rows form a tree) and returns its content, like a column's `cell`
   * (a Lit template, a DOM node, text; React, Vue or Angular content through
   * the wrappers). Setting it adds a column of chevrons that open and close the
   * panels (`expanded`). A panel spans the visible width, is as tall as its
   * content up to `--argus-detail-max-height` (past that it scrolls), and works
   * with the keyboard: Down arrow onto it, Enter or F2 into its content, Escape
   * back out. It runs on every update of a panel in view, so return a template
   * or framework content rather than a new DOM node each time. Property only.
   * Panels aren't available on `pinnedRows`.
   */
  @property({ attribute: false })
  rowDetail?: (context: RowDetailContext<T>) => CellContent;

  /**
   * Which rows can open a detail panel (`rowDetail`): those it returns `true`
   * for. Others get no chevron. Default: every row. Property only.
   */
  @property({ attribute: false })
  rowExpandable?: (row: T) => boolean;

  /**
   * The rows whose detail panel is open, as row ids (`getRowId`'s, or the
   * default ids: see `getRowId`), e.g. `['o1041']`. Several can be open. Uncontrolled
   * until set, like `sorting`: once set, a chevron only fires
   * `argus-expanded-change` with the proposed ids. `undefined` hands it back.
   * Ids stay through sorting, filtering and a new `data`; a row that's filtered
   * out, not loaded yet or not expandable shows no panel until it can.
   */
  @property({ attribute: false })
  get expanded(): ExpandedState {
    return this.#expanded.value;
  }
  set expanded(value: ExpandedState | undefined) {
    this.#expanded.set(value);
  }

  /**
   * The expanded rows of a tree (`getSubRows`, `getParentId`, or a `dataSource`
   * with `hasChildren` and `getChildren`), as row ids
   * (`getRowId`'s, or the default ids such as `'3'` and `'3.0'`), e.g.
   * `['3', '3.0']`. A row's children show while it and its ancestors are
   * expanded. While a filter or the quick filter is on, rows holding a match
   * show expanded whatever it says, without changing it, and their toggles are
   * disabled (`aria-disabled`) until the filter clears, so a match is never
   * hidden and nothing changes out of sight; not with a `dataSource`, whose
   * server filters (only this opens rows there). Default: none.
   * With a `dataSource`, an expanded row loads its children (`getChildren`)
   * once its own row has loaded, showing a loading row under it meanwhile; ids
   * of rows not loaded yet open when they load, so a restored value
   * (`setState()`) works as pages arrive. A row whose children come back empty
   * keeps its id here but shows no toggle and nothing under it.
   * Uncontrolled until set, like `expanded`: once set, a toggle only fires
   * `argus-tree-expanded-change` with the proposed ids. `undefined` hands it
   * back. Ids stay through sorting, filtering and a new `data`.
   */
  @property({ attribute: false })
  get treeExpanded(): TreeExpandedState {
    return this.#treeExpanded.value;
  }
  set treeExpanded(value: TreeExpandedState | undefined) {
    this.#treeExpanded.set(value);
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
  readonly #pinning = controllable<ColumnPinningState>({});
  readonly #visibility = controllable<ColumnVisibilityState>({});
  readonly #filters = controllable<ColumnFilterState>({});
  readonly #expanded = controllable<ExpandedState>([]);
  readonly #treeExpanded = controllable<TreeExpandedState>([]);
  /** The `role` attribute the table set itself (`grid` or `treegrid`); a page's own role wins. */
  #roleAttribute: string | undefined;
  #quickFilter = '';
  /** Announce the row count after the update: the filters changed. */
  #announceRows = false;
  /** Whether the checkbox column was last shown; a change re-measures the pinned columns. */
  #selectionColumn = false;
  #selectionColumnChanged = false;
  /** Columns `autosizeColumns()` renders out of view for its measurement. */
  #measureKeep: readonly string[] = [];
  /** Measured widths of `width: 'auto'` columns. */
  readonly #autoWidths = new AutoWidths(() => {
    this.requestUpdate();
  });
  /** The auto widths last passed to the model; a change re-measures the pinned columns' offsets. */
  #pushedAutoWidths: ColumnSizingState | undefined;
  #autoWidthsChanged = false;
  /** Change events of the state above; those the table applied fire once the update is done. */
  readonly #events = new StateEvents(this, [
    COLUMN_SIZING_CHANGE,
    COLUMN_RESIZE_END,
    COLUMN_ORDER_CHANGE,
    COLUMN_PINNING_CHANGE,
    COLUMN_VISIBILITY_CHANGE,
    COLUMN_FILTERS_CHANGE,
    SORTING_CHANGE,
    SELECTION_CHANGE,
    EXPANDED_CHANGE,
    TREE_EXPANDED_CHANGE,
  ]);
  readonly #select = new SelectionController<T>(
    this,
    () => this.#table.model,
    () => this.#data.rows !== undefined,
    this.#events,
  );
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
    cellOf: (event) => cellTargetOf(event, this.renderRoot, this.#table.model, this.#nav),
    setSort: (columnId, direction) => {
      this.#setSort(columnId, direction);
    },
    focusHeader: (columnId) => {
      const model = this.#table.model;
      this.#nav.moveTo(layoutOf(model).leafHeader, columnId);
    },
    focusCell: (index, columnId, section = 'body') => {
      const model = this.#table.model;
      const at = section === 'body' ? positionOfIndex(model, index) : index;
      this.#nav.moveTo({ section, index: at }, columnId);
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
    row: (index, section) => this.#rowView(index, section)?.original,
    rowCount: (section = 'body') => {
      const model = this.#table.model;
      return section === 'body' ? model.rowCount : model.pinnedCount(section);
    },
    rowId: (index, section) => this.#rowView(index, section)?.id,
    value: (index, columnId, section = 'body') => {
      const model = this.#table.model;
      return section === 'body'
        ? model.valueAt(index, columnId)
        : model.pinnedValueAt(section, index, columnId);
    },
    readValue: (row, columnId, index) => this.#table.model.readValue(row, columnId, index),
    rowDepth: (index, section = 'body') => {
      if (section !== 'body') return 0;
      // A data source's tree knows the depth of rows not loaded too (children loading).
      const remote = this.#data.tree;
      if (remote) return remote.depthAt(index) ?? 0;
      return this.#table.model.treeRow(index)?.depth ?? 0;
    },
    // A data source's rows have no source indexes (`data` isn't read).
    sourceRow: (index) => (this.#data.rows ? undefined : this.#table.model.sourceRow(index)),
    headerGroups: () =>
      this.#table.model.headerGroups.map((cells) =>
        cells.map(({ groupId, columns }) => ({ groupId, columns })),
      ),
    content: (value) => content(value),
    header: pluginHeader,
    headerText: pluginHeaderText,
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
  /** End of the light-DOM part holding cell content, so later children stay outside it. */
  #contentEnd: Comment | undefined;
  /** The light-DOM part: disconnected with the table, so foreign content is released. */
  #lightPart: RootPart | undefined;
  /** How many children the light DOM was last rendered with (`lightCount`). */
  #lightCount = 0;
  /** The detail panels' content, kept per row while open (`rowDetail`). */
  readonly #detail = new DetailContent<T>(this);
  #lightConnected = true;
  // Children loaded under a branch-selected row join the selection.
  readonly #data = new DataController<T>(this, (parentId) => {
    this.#select.arrived(parentId);
  });
  /** Scroll back to the top after the update (a new sort order for a data source). */
  #scrollToTop = false;
  // Looked up lazily: the virtualizer's hostUpdated runs before firstUpdated.
  readonly #virtual = new VirtualController(this, () => this.#scroller());
  readonly #pinScroll = new PinScrollController(
    this,
    () => this.#scroller(),
    (width) => {
      if (width === this.#viewWidth) return;
      this.#viewWidth = width;
      if (this.stretchColumns) this.requestUpdate();
    },
  );
  /** The scroller's inner width, for `stretchColumns`. */
  #viewWidth = 0;
  /** What `stretchColumns` passed to the model last, kept while it's the same. */
  #stretch: { width: number; keep: readonly string[] | undefined } | undefined;
  /** The stretched widths changed: the pinned columns' scroll range is measured again. */
  #stretchChanged = false;
  readonly #columnWindow = new ColumnWindowController<T>(this, () => this.#scroller());
  /** `block-size: auto` without a maximum: capped at the window's height. */
  readonly #fit = new FitHeight(this, () => this.#scroller());
  /** The header, pinned rows and body last rendered, in px. */
  #contentPx = 0;
  /** Columns an `editable` plugin hook calls editable; `undefined` without one (read-only grid). */
  #editable: ReadonlySet<string> | undefined;
  /** The columns the last render rendered (all of them, unless `virtualizeColumns`). */
  #rendered: RenderedColumn<T>[] = [];
  #rowPx = 40;
  #probeObserver?: ResizeObserver;
  /** The column template and row height the rows were last read for. */
  #rowsKey = '';
  /** Rows of different heights: reads the rendered rows (`rowHeight: 'auto'` only). */
  readonly #rowMeasure = new RowMeasure(this, {
    bodyIndex: (row) => {
      const model = this.#table.model;
      const at = gridRowOf(row, layoutOf(model));
      if (at?.section !== 'body') return undefined;
      const shown = model.display.at(at.index);
      // Panels always; data rows only with `rowHeight: 'auto'`, once loaded.
      if (shown?.kind === 'detail') return at.index;
      return shown && this.rowHeight === 'auto' && this.#data.stateAt(shown.index) === 'loaded'
        ? at.index
        : undefined;
    },
    sizeOf: (index) => this.#virtual.sizeOf(index),
    minimum: () => this.#rowPx,
  });
  #window: VirtualWindow = { rows: [], details: [], totalSize: 0, range: null };
  /** Rows of different heights are measured: every row (`rowHeight: 'auto'`), or open panels. */
  #measuring = false;
  /** The row order and displayed rows last given to the virtualizer. */
  #laidOut: LaidOut | undefined;
  /** The active cell, its focus and the keys that move it. */
  readonly #nav = new NavigationController<T>(
    this,
    () => this.#table.model,
    this.#virtual,
    this.#select,
    {
      rowPx: () => this.#rowPx,
      aroundPx: (layout) => this.#headerAndPinnedPx(layout),
      insets: (layout) => this.#bodyInsets(layout),
      measured: () => this.#measuring,
    },
    () => this.#data.tree,
  );
  /** Column widths: resize handles, Alt+Arrow and fits. */
  readonly #resize = new ColumnResize<T>(this, () => this.#table.model, this.#events);
  /** Column order: header drags and Alt+Shift+Arrow. */
  readonly #reorder = new ColumnReorder<T>(
    this,
    () => this.#table.model,
    this.#events,
    this.#nav,
    () => this.#labels,
    () => this.#scroller(),
  );
  /** Keys on a focused cell or header: the table's own, then navigation. */
  readonly #keys = new KeyboardRouter<T>(
    this,
    () => this.#table.model,
    this.#nav,
    this.#resize,
    this.#reorder,
    this.#plugins,
    this.#data,
    (index) => {
      this.#toggle(index);
    },
    (index) => {
      this.#toggleTree(index);
    },
    (columnId) => {
      this.#requestSort(columnId);
    },
  );
  /** Scrolling to rows and columns, and the restored row still to reach. */
  readonly #scroll = new ScrollTarget<T>(
    this,
    () => this.#table.model,
    this.#virtual,
    this.#data,
    (layout) => this.#bodyInsets(layout),
    () => this.#measuring,
    () => this.#scroller(),
  );
  #lastRange = '';
  #unwatchMaxHeight: (() => void) | undefined;

  /** The scroll container (`part="table"`); `null` before the first render. */
  #scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('[part~="table"]');
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) {
      this.#roleAttribute = this.#table.model.tree ? 'treegrid' : 'grid';
      this.setAttribute('role', this.#roleAttribute);
    }
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
    this.#detail.setConnected(connected);
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
   * would, so `argus-column-sizing-change` fires for each column that changes, then one
   * `argus-column-resize-end`, and with a controlled `columnSizing` nothing changes until you set it. Without `ids`, fits
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
    this.#resize.request(widths);
    await this.updateComplete;
  }

  /**
   * Scrolls to a row: `index` in the current row order (after sorting and
   * filtering), or `{ id }` (`getRowId`'s). `align` puts it at the top of the
   * view (`'start'`, the default, just below the header and pinned rows), at
   * the bottom (`'end'`), in the middle (`'center'`), or scrolls only as far as
   * needed to show it (`'nearest'`). Resolves once the table has re-rendered
   * there: `true` when the row is there, `false` for an id that isn't in the
   * rows (unknown, filtered out, under a collapsed row of a tree, a pinned row, a
   * data source row not loaded) or an index past the last row (it scrolls to the
   * end). With a `dataSource`
   * whose total isn't known yet, an index past the rows counted so far resolves
   * `false` and the table scrolls on toward the row as pages arrive, until the
   * user scrolls, clicks or presses a key. In a tree from a `dataSource`, an
   * index counts the rows shown (top-level rows, and the children and loading
   * rows of expanded ones), and an id finds a row whose page or parent's
   * children have loaded and whose ancestors are expanded.
   */
  scrollToRow(target: RowTarget, options: ScrollToRowOptions = {}): Promise<boolean> {
    return this.#scroll.toRow(target, options);
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
  scrollToColumn(id: string, options: ScrollToColumnOptions = {}): Promise<boolean> {
    return this.#scroll.toColumn(id, options, () => this.virtualizeColumns);
  }

  /**
   * The state users change, as one object of plain JSON for saving a user's
   * layout: `sorting`, `columnSizing`, `columnOrder`, `columnPinning`,
   * `columnVisibility`, `columnFilters`, `selection`, `expanded`, `treeExpanded`, `quickFilter`, and `scroll`
   * (the row at the top and the inline offset), with `version: 1`. Controlled properties are
   * included with the values you set. The object is a copy: changing it changes
   * nothing in the table.
   */
  getState(): Required<TableState> {
    const scroller = this.#scroller();
    return structuredClone({
      version: 1 as const,
      sorting: this.#sorting.value,
      columnSizing: this.#resize.state.value,
      columnOrder: this.#reorder.state.value,
      columnPinning: this.#pinning.value,
      columnVisibility: this.#visibility.value,
      columnFilters: this.#filters.value,
      selection: this.#select.state.value,
      expanded: this.#expanded.value,
      treeExpanded: this.#treeExpanded.value,
      quickFilter: this.#quickFilter,
      // Negative in RTL.
      scroll: {
        // The data row at the top (a panel there counts as its row).
        row: this.#table.model.display.at(this.#virtual.topRow)?.index ?? 0,
        inline: Math.abs(scroller?.scrollLeft ?? 0),
      },
    });
  }

  /**
   * Restores state from `getState()`, for example a layout saved in
   * `localStorage`. Only the keys given change; ids of columns that no longer
   * exist are ignored. State of another `version` is ignored as a whole. Properties you control are left alone (set them
   * yourself), and the others stay uncontrolled. No change events fire.
   * `quickFilter` is set like the property: a search box of yours shows it only
   * if you read it back. `scroll` is applied after the rest, so with a
   * `dataSource` the restored rows load where it points. In a tree from a
   * `dataSource`, its row counts the rows shown: an expanded row's children
   * count once its own row has loaded and they have (one loading row before), so
   * the restored row is off by the children of expanded rows above it whose
   * pages don't load on the way. Resolves once the table has re-rendered there.
   */
  async setState(state: TableState): Promise<void> {
    // Another format (a later version's): nothing it holds can be trusted to mean the same.
    if (((state.version as number | undefined) ?? 1) !== 1) return;
    restore(this, 'sorting', this.#sorting, state.sorting);
    restore(this, 'columnSizing', this.#resize.state, state.columnSizing);
    restore(this, 'columnOrder', this.#reorder.state, state.columnOrder);
    restore(this, 'columnPinning', this.#pinning, state.columnPinning);
    restore(this, 'columnVisibility', this.#visibility, state.columnVisibility);
    restore(this, 'columnFilters', this.#filters, state.columnFilters);
    // A Shift range starts over from the restored selection.
    if (restore(this, 'selection', this.#select.state, state.selection)) this.#select.restored();
    restore(this, 'expanded', this.#expanded, state.expanded);
    // Before the scroll: its row is an index among the rows shown.
    restore(this, 'treeExpanded', this.#treeExpanded, state.treeExpanded);
    if (state.quickFilter !== undefined) this.quickFilter = state.quickFilter;
    this.#scroll.drop();
    await this.updateComplete;
    const { scroll } = state;
    if (scroll) await this.#scroll.restoreScroll(scroll);
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
    const sourceChanged =
      changed.has('dataSource') ||
      changed.has('sorting') ||
      changed.has('getRowId') ||
      filtersChanged;
    // Expanded rows matter to a data source's tree only.
    if (sourceChanged || (changed.has('treeExpanded') && this.dataSource)) {
      this.#data.configure({
        source: this.dataSource,
        sorting: this.#sorting.value,
        filters: this.#filters.value,
        quickFilter: this.#quickFilter,
        getRowId: this.getRowId,
        treeExpanded: this.#treeExpanded.value,
      });
    }
    if (sourceChanged) {
      // A new order or filter starts over from the first row, so show it.
      if (this.dataSource && this.hasUpdated && (changed.has('sorting') || filtersChanged)) {
        this.#scrollToTop = !changed.has('dataSource');
      }
      // Other rows: a position restored for the old ones no longer applies.
      this.#scroll.drop();
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
      changed.has('pinnedRows') ||
      changed.has('rowDetail') ||
      changed.has('rowExpandable') ||
      changed.has('expanded') ||
      changed.has('getSubRows') ||
      changed.has('getParentId') ||
      changed.has('treeExpanded')
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
        columnSizing: this.#resize.state.value,
        columnOrder: this.#reorder.state.value,
        columnPinning: this.#pinning.value,
        columnVisibility: this.#visibility.value,
        columnFilters: this.#filters.value,
        quickFilter: this.#quickFilter,
        pinnedRows: this.pinnedRows,
        detail: this.rowDetail !== undefined,
        expanded: this.#expanded.value,
        rowExpandable: this.rowExpandable,
        getSubRows: this.getSubRows,
        getParentId: this.getParentId,
        treeExpanded: this.#treeExpanded.value,
      });
    }
    // A new page cache (new source, sort order or refresh) or none, new measured
    // widths, and whether the checkbox column shows.
    const autoWidths = this.#autoWidths.widths;
    this.#autoWidthsChanged = autoWidths !== this.#pushedAutoWidths;
    this.#pushedAutoWidths = autoWidths;
    const selectionColumn = this.#select.column;
    this.#selectionColumnChanged = selectionColumn !== this.#selectionColumn;
    this.#selectionColumn = selectionColumn;
    // The scrolling columns fill the table's width (`stretchColumns`).
    const stretch =
      this.stretchColumns && this.#viewWidth > 0
        ? { width: this.#viewWidth, keep: this.#resize.kept }
        : undefined;
    const keyOf = (s: typeof stretch) =>
      s ? `${String(s.width)}|${s.keep?.join('\u0001') ?? ''}` : '';
    this.#stretchChanged = keyOf(stretch) !== keyOf(this.#stretch);
    if (this.#stretchChanged) this.#stretch = stretch;
    this.#table.update({
      remote: this.#data.rows,
      autoWidths,
      selectionColumn,
      stretch: this.#stretch,
    });
    const model = this.#table.model;
    this.#nav.reconcile(model);
    // -1 tells assistive tech the total is unknown (a data source still growing).
    const unknownTotal = this.#data.cache?.totalKnown === false;
    const layout = layoutOf(model);
    this.#internals.ariaRowCount = unknownTotal ? '-1' : String(layout.total);
    this.#internals.ariaColCount = String(model.columns.length);
    this.#internals.ariaMultiSelectable = this.#select.mode === 'multi' ? 'true' : null;
    this.#syncRole(model.tree);
    this.#editable = this.#plugins.editable(columns);
    // Without an editing plugin nothing can be edited: say so once, on the grid.
    this.#internals.ariaReadOnly = this.#editable ? null : 'true';
    // The header and pinned rows scroll with the body.
    const aroundPx = this.#headerAndPinnedPx(layout);
    const auto = this.rowHeight === 'auto';
    const measuring = auto || model.display.open.length > 0;
    this.#measuring = measuring;
    if (!measuring) this.#rowMeasure.stop();
    // Anything but a scroll may change what rows hold (data, columns, widths).
    else if (changed.size > 0 || this.#columnsChanged) this.#rowMeasure.invalidate();
    const [config, laidOut] = virtualConfig(
      model,
      this.#laidOut,
      this.#nav,
      this.#rowPx,
      aroundPx,
      measuring,
      auto,
      Boolean(this.rowDetail),
      Math.max(0, this.overscan),
    );
    this.#laidOut = laidOut;
    this.#virtual.configure(config);
    // Before the window: a table without a maximum that just got its layout (it was
    // in a hidden tab) is capped now, rather than after rendering every row.
    this.#fit.check(this.#contentPx);
  }

  protected override update(changed: PropertyValues<this>): void {
    const model = this.#table.model;
    this.#window = this.#virtual.computeWindow();
    const rendered = this.#columnWindow.compute(
      model.columns,
      this.virtualizeColumns,
      this.virtualizeColumns ? this.#keptColumns(model) : [],
    );
    this.#rendered = rendered;
    const editable = this.#editable;
    if (editable) for (const c of rendered) c.readonly = !editable.has(c.id);
    // In WebKit, before the shadow root unless it shrinks: it slots new content
    // fast only when the slots come after it (`contentFirst`).
    let before = false;
    if (contentFirst) {
      const { rows, details } = this.#window;
      const count = lightCount(model, rows, rendered, model.headerGroups, details);
      before = count >= this.#lightCount;
      this.#lightCount = count;
    }
    if (before) this.#renderLight(model);
    super.update(changed);
    if (!before) this.#renderLight(model);
  }

  #renderLight(model: TableModel<T, CellContent>): void {
    const part = renderLightDom(
      this,
      model,
      this.#window.rows,
      this.#rendered,
      model.headerGroups,
      this.#lightDomEnd(),
      this.#window.details,
    );
    // A new marker starts a new part (the old one was removed): its content is gone.
    if (this.#lightPart && this.#lightPart !== part) this.#lightPart.setConnected(false);
    this.#lightPart = part;
  }

  protected override render(): TemplateResult {
    const model = this.#table.model;
    const columns = model.columns;
    const labels = this.#labels;
    const rendered = this.#rendered;
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
    const active = this.#nav.active;
    const activeIn = (section: GridRow['section']): ActiveCell | undefined =>
      active?.section === section ? { index: active.index, col: active.col } : undefined;
    const firstIndex = (section: GridRow['section']) => layout.ariaRowIndex({ section, index: 0 });
    if (typeof this.rowHeight === 'number' && this.rowHeight > 0) {
      style['--_row-height'] = `${String(this.rowHeight)}px`;
    }
    // The header, the pinned rows and the body: what the pinned-column shadows cover.
    const contentPx =
      this.#headerAndPinnedPx(layout) + (model.rowCount === 0 ? 0 : this.#window.totalSize);
    this.#contentPx = contentPx;
    // With detail panels, the body's part of the pinned edges is drawn in the body,
    // so it stops at each panel (an overlay can't go under a panel).
    const edges =
      this.rowDetail && pinStart + pinEnd > 0
        ? renderEdgeRuns(
            pinStart,
            pinEnd,
            edgeRuns(this.#window.rows, (row) => row.size ?? this.#rowPx),
          )
        : undefined;
    const bands = edges
      ? {
          top: layout.header * this.#rowPx + this.#pinnedPx('top', layout),
          bottom: this.#pinnedPx('bottom', layout),
        }
      : undefined;
    return html`<div
        part="table"
        role="presentation"
        style=${styleMap(style)}
        ?data-dragging=${this.#reorder.drag !== undefined}
        ?data-auto-rows=${auto}
        @keydown=${this.#keys.onKeydown}
        @focusin=${this.#nav.onFocusin}
        @mousedown=${this.#select.onMousedown}
        @click=${this.#onClick}
      >
        ${renderHeader({
          columns: rendered,
          groups: model.headerGroups,
          handlers: this.#headerHandlers,
          active: activeIn('header'),
          drag: this.#reorder.drag,
          checkAll: this.#select.checkAll(),
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
                this.#data.rows
                  ? loadingState(this.#data.rows, this.#window, model, labels, this.#onRetry)
                  : undefined,
                this.#select.selectedAt(),
                this.#selectionColumn ? this.#select.checkboxes(labels.selectRow) : undefined,
                auto,
                this.rowDetail
                  ? rowToggles(model, this.#window, labels, this.#onToggle)
                  : undefined,
                this.rowDetail
                  ? { rows: this.#window.details, colspan: columns.length }
                  : undefined,
                edges,
                treeRows(model, labels, this.#onTreeToggle, this.#data.tree),
              )
        }
        ${renderPinnedRows('bottom', layout.bottom, rendered, firstIndex('bottom'), activeIn('bottom'))}
        <div class="probe" aria-hidden="true"></div>
      </div>
      ${pinShadow('start', pinStart, contentPx, bands)}
      ${pinShadow('end', pinEnd, contentPx, bands)}`;
  }

  protected override firstUpdated(): void {
    this.#observeProbe();
    this.#measureRowHeight();
  }

  protected override updated(changed: PropertyValues<this>): void {
    const model = this.#table.model;
    this.#syncDetails(model);
    // Foreign content is committed before anything measures it.
    flushContent(this);
    this.#measureAutoWidths(model);
    // Rows of different heights: placed by the update this requests.
    const resized = this.#measuring && this.#measureRows();
    if (this.#scrollToTop) {
      this.#scrollToTop = false;
      const scroller = this.#scroller();
      if (scroller) scroller.scrollTop = 0;
    }
    this.#scroll.chase(model.rowCount);
    this.#fit.check(this.#contentPx);
    if (
      this.#columnsChanged ||
      this.#groupsChanged ||
      changed.has('columnSizing') ||
      changed.has('columnOrder') ||
      changed.has('columnPinning') ||
      changed.has('columnVisibility') ||
      this.#autoWidthsChanged ||
      this.#selectionColumnChanged ||
      // The toggle column comes or goes with it.
      changed.has('rowDetail') ||
      // Stretched widths change the scroll range end-pinned cells are shifted by.
      this.#stretchChanged ||
      changed.has('stretchColumns')
    ) {
      this.#pinScroll.measure();
    }
    // Rows that just changed height move with the next update: focus them there.
    this.#nav.focusPending(resized);
    if (changed.has('density') || changed.has('rowHeight')) this.#measureRowHeight();
    this.#reorder.announce(model);
    if (this.#announceRows) {
      this.#announceRows = false;
      this.#announceRowCount(model);
    }
    this.#events.flush();
    const { range } = this.#window;
    const display = model.display;
    // Positions to data rows: panels in view don't count.
    const rows = range && display.dataRange(range.start, range.end);
    const key = rows ? `${String(rows.first)}:${String(rows.last)}` : '';
    if (rows && key !== this.#lastRange) {
      this.#lastRange = key;
      fire(this, RANGE_CHANGE, rows);
    }
    if (range) {
      // The rendered rows: visible plus overscan.
      const over = Math.max(0, this.overscan);
      const load = display.dataRange(range.start - over, range.end + over);
      if (load) this.#data.request(load.first, load.last + 1);
    }
    for (const detail of this.#data.takeErrors()) fire(this, LOAD_ERROR, detail);
  }

  /**
   * Renders the detail panels in the window into their slot elements, and releases
   * the content of panels that closed or whose row can't show one any more.
   */
  #syncDetails(model: TableModel<T, CellContent>): void {
    const { display } = model;
    // Asked per kept panel only: walking every open one each update costs at scale.
    const isOpen = (id: string) => {
      const index = model.indexOf(id);
      return index !== undefined && display.hasDetail(index);
    };
    const rendered: RenderedPanel<T>[] = [];
    for (const panel of this.#window.details) {
      const row = panel.idle ? undefined : model.rowAt(panel.row);
      const slotElement = row
        ? this.querySelector<HTMLElement>(`:scope > [slot="${detailSlot(panel.slot)}"]`)
        : null;
      if (!row || !slotElement) continue;
      const context: RowDetailContext<T> = { row: row.original, rowId: row.id, index: panel.row };
      // No `depth` key without a tree: contexts stay as they were.
      const depth = model.treeRow(panel.row)?.depth;
      if (depth !== undefined) context.depth = depth;
      rendered.push({ rowId: row.id, slotElement, context });
    }
    this.#detail.sync(this.rowDetail, isOpen, rendered);
  }

  /**
   * Columns to render wherever they are, with `virtualizeColumns`: the active
   * cell's (its tab stop and focus survive scrolling sideways, and keyboard
   * moves land on a rendered cell), one being dragged, auto widths still to
   * measure, the targets of `autosizeColumns()`, and with a `dataSource` the
   * first data column, which holds the Retry buttons.
   */
  #keptColumns(model: TableModel<T, CellContent>): (string | undefined)[] {
    const drag = this.#reorder.drag;
    return [
      this.#nav.active?.col,
      // A dragged column, not a group's: their headers needn't render out of view.
      ...(drag?.key.startsWith('c:') ? drag.columns : []),
      this.dataSource ? model.columns.find((c) => c.kind === 'data')?.id : undefined,
      ...this.#autoWidths.pending(model.columns),
      ...this.#measureKeep,
      this.#scroll.keep,
    ];
  }

  /**
   * Measures the `width: 'auto'` columns once loaded body rows render, or right
   * away when there are no rows (the header and pinned rows only). While a data
   * source's first rows load, they keep the default width. A changed width
   * renders once more.
   */
  #measureAutoWidths(model: TableModel<T, CellContent>): void {
    const loaded = this.#window.rows.some((r) => !r.idle && model.rowAt(r.row) !== undefined);
    if (!loaded && model.rowCount > 0) return;
    if (this.#autoWidths.measure(this.renderRoot, model.columns, loaded)) this.requestUpdate();
  }

  readonly #onRetry = (event: Event) => {
    const button = event.currentTarget as HTMLElement;
    // The button goes away with the retry; keep focus in the grid, on its cell.
    if (button.matches(':focus')) button.parentElement?.focus({ preventScroll: true });
    this.#data.retry(Number(button.dataset.row));
  };

  readonly #headerHandlers = {
    click: (event: MouseEvent) => {
      const id = sortColumnOf(event);
      if (id !== undefined) this.#requestSort(id);
    },
    pointerdown: (event: PointerEvent) => {
      if (event.button !== 0) return;
      const handle = event.composedPath()[0];
      if (!(handle instanceof HTMLElement)) return;
      if (!this.#resize.pointerdown(handle, event)) this.#reorder.start(event);
    },
    dblclick: (event: MouseEvent) => {
      this.#resize.dblclick(event);
    },
  };

  /**
   * `argus-cell-click`, then `argus-row-click`, for clicks in the body; then,
   * with a `selectionMode`, the click selects its row.
   */
  readonly #onClick = (event: MouseEvent) => {
    activate(this, this.renderRoot, this.#table.model, event.composedPath());
    this.#select.click(event);
  };

  /** Opens or closes a body row's panel (a data index), through the controlled/uncontrolled rules. */
  #toggle(index: number): void {
    const model = this.#table.model;
    const id = model.rowAt(index)?.id;
    if (id === undefined) return;
    this.#requestExpanded('expanded', this.#expanded, EXPANDED_CHANGE, id, (rowId, open, base) =>
      model.nextExpanded(rowId, open, base),
    );
  }

  /**
   * Expands or collapses a tree row (a data index), through the controlled/uncontrolled
   * rules. It flips the row's membership in `treeExpanded`, so every toggle can be
   * undone. A row a filter keeps open (`forced`) is left alone: its toggle is
   * disabled until the filter clears, so nothing changes out of sight.
   */
  #toggleTree(index: number): void {
    const model = this.#table.model;
    const id = model.rowAt(index)?.id;
    const info = model.treeRow(index);
    // A row a filter keeps open stays so until the filter clears: nothing changes invisibly.
    if (id === undefined || !info || info.forced) return;
    this.#requestExpanded(
      'treeExpanded',
      this.#treeExpanded,
      TREE_EXPANDED_CHANGE,
      id,
      (rowId, open, base) => model.nextTreeExpanded(rowId, open, base),
    );
  }

  /**
   * Flips a row id's membership in an expand state (`expanded` or `treeExpanded`)
   * through the controlled/uncontrolled rules, when `next` allows it. From the
   * latest requested value: two toggles before an update don't cancel out.
   */
  #requestExpanded(
    name: 'expanded' | 'treeExpanded',
    state: Controllable<readonly string[]>,
    event: typeof EXPANDED_CHANGE | typeof TREE_EXPANDED_CHANGE,
    id: string,
    next: (rowId: string, open: boolean, base: readonly string[]) => readonly string[] | undefined,
  ): void {
    const open = !state.value.includes(id);
    const value = next(id, open, state.value);
    if (!value) return;
    this.#events.change(name, state, value, event, [[id, { rowId: id, open }]]);
  }

  /** `treegrid` while the rows form a tree, else `grid`; a `role` the page set stays. */
  #syncRole(tree: boolean): void {
    const role = tree ? 'treegrid' : 'grid';
    if (this.#internals.role !== role) this.#internals.role = role;
    // Only the attribute the table set itself, while it's still there.
    const own = this.#roleAttribute;
    if (own === undefined || own === role || this.getAttribute('role') !== own) return;
    this.#roleAttribute = role;
    this.setAttribute('role', role);
  }

  /** A chevron's click: its row is in `data-row`. */
  readonly #onToggle = (event: Event) => {
    this.#toggle(Number((event.currentTarget as HTMLElement).dataset.row));
  };

  /**
   * A tree toggle's click: its row (a data index) is in `data-row`. The toggle's
   * cell becomes the active cell and takes focus after the update (a click on a
   * button doesn't focus it in every engine).
   */
  readonly #onTreeToggle = (event: Event) => {
    const button = event.currentTarget as HTMLElement;
    this.#toggleTree(Number(button.dataset.row));
    const cell = button.parentElement ? gridCell(button.parentElement) : undefined;
    const row = cell && gridRowOfCell(cell, layoutOf(this.#table.model));
    const col = cell?.dataset.col;
    if (row && col !== undefined) this.#nav.moveTo(row, col);
  };

  /**
   * Pins or unpins a column through the controlled/uncontrolled rules. Starts
   * from the latest requested pins, so requests can come faster than renders.
   */
  #requestPin(columnId: string, pin: ColumnPin | false): void {
    const next = this.#table.model.nextPinning(columnId, pin, this.#pinning.value);
    if (!next) return;
    this.#events.change('columnPinning', this.#pinning, next, COLUMN_PINNING_CHANGE, [
      [columnId, { columnId, pin }],
    ]);
  }

  /** Hides or shows a column through the controlled/uncontrolled rules. */
  #requestHide(columnId: string, hidden: boolean): void {
    const next = this.#table.model.nextVisibility(columnId, hidden, this.#visibility.value);
    if (!next) return;
    this.#events.change('columnVisibility', this.#visibility, next, COLUMN_VISIBILITY_CHANGE, [
      [columnId, { columnId, visible: !hidden }],
    ]);
  }

  /** Sets or clears a column's filter through the controlled/uncontrolled rules. */
  #requestFilter(columnId: string, filter: ColumnFilter | undefined): void {
    const next = this.#table.model.nextFilters(columnId, filter, this.#filters.value);
    if (!next) return;
    this.#events.change('columnFilters', this.#filters, next, COLUMN_FILTERS_CHANGE, [
      [columnId, { columnId, columnFilter: filter }],
    ]);
  }

  /**
   * Says how many rows the filters leave ("42 rows"). With a `dataSource` the count
   * isn't known until the first page answers, so nothing is said.
   */
  #announceRowCount(model: TableModel<T, CellContent>): void {
    if (this.#data.rows) return;
    announce(this.ownerDocument, this.#labels.rowCount({ count: model.rowCount }));
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
    this.#events.change('sorting', this.#sorting, next, SORTING_CHANGE, [['', {}]]);
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
    return columnInfoOf(this.#columnsById.byId.get(id), this.#filters.value[id]);
  }

  /** A row of a section for plugins: the body's in the current order, a pinned one by its index on its side. */
  #rowView(index: number, section: RowSection = 'body') {
    const model = this.#table.model;
    return section === 'body' ? model.rowAt(index) : model.pinnedRowAt(section, index);
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
