import {
  LitElement,
  html,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { controllable, type ColumnResizeDetail, type ColumnView } from '@argus-table/core';
import { startResizeDrag } from './controllers/resize-drag.js';
import { TableController } from './controllers/table-controller.js';
import { VirtualController, type VirtualWindow } from './controllers/virtual-controller.js';
import { COLUMN_RESIZE, fire, RANGE_CHANGE, SORT_CHANGE } from './events.js';
import { renderBody } from './render/body.js';
import { renderLightDom } from './render/cells.js';
import { renderHeader } from './render/header.js';
import { baseStyles } from './styles/base.js';
import type { CellContent, ColumnDef, ColumnSizingState, Density, SortState } from './types.js';

/**
 * The host carries the grid role, so rows rendered in the shadow root become
 * its children in the accessibility tree. Set through ElementInternals (not an
 * attribute) so users can still override it with their own `role`.
 */
function attachGridInternals(host: HTMLElement): ElementInternals {
  const internals = host.attachInternals();
  internals.role = 'grid';
  return internals;
}

/**
 * The header cell an event came from, by `data-*` key (`sortCol`, `col`), if any.
 * Works for slotted content too. Events from a resize handle never count for
 * sorting, so a click that ends a drag doesn't sort.
 */
function headerOf(event: Event, key: 'sortCol' | 'col'): HTMLElement | undefined {
  for (const target of event.composedPath()) {
    if (!(target instanceof HTMLElement)) continue;
    if (key === 'sortCol' && target.dataset.resizeCol !== undefined) return undefined;
    if (target.dataset[key] !== undefined) return target;
    if (target.getAttribute('part') === 'header-row') return undefined;
  }
  return undefined;
}

const RESIZE_STEP = 10;

/** CSS grid track for a column: fixed px, or a flex share with the min width as floor. */
function track<T>(column: ColumnView<T, CellContent>): string {
  return column.flex === undefined
    ? `${String(column.width)}px`
    : `minmax(${String(column.minWidth)}px, ${String(column.flex)}fr)`;
}

/**
 * A virtualized data table.
 *
 * Set `columns` and `data` as properties. Header and cell content is rendered
 * into the element's light DOM and slotted into the cells, so page CSS and the
 * page's own components work inside cells.
 *
 * @summary Data table with pinned rows and columns and infinite loading.
 *
 * @fires argus-sort-change - A sortable header was clicked, or activated with Enter or Space. `detail: { sorting }`: the new order, or the proposed one when `sorting` is controlled.
 * @fires argus-column-resize - A column was resized by dragging its handle or with Alt+Arrow on its header. `detail: { columnId, width, sizing }`: the new widths, or the proposed ones when `columnSizing` is controlled. Fires on every frame of a drag.
 * @fires argus-range-change - The visible rows changed. `detail: { start, end }` (row indices, inclusive).
 *
 * @slot empty - Shown instead of the body when there are no rows. Default: "No rows".
 *
 * @csspart table - The scroll container that holds header and body.
 * @csspart header - The sticky header row group.
 * @csspart header-row - The header row.
 * @csspart header-cell - Every header cell.
 * @csspart header-cell-sorted - The header of the sorted column. The direction is in `aria-sort`.
 * @csspart resize-handle - The drag handle on the inline-end edge of a resizable column's header.
 * @csspart body - The row group holding the rendered body rows.
 * @csspart row - Every body row.
 * @csspart row-even - Body rows with an even index (0-based).
 * @csspart row-odd - Body rows with an odd index.
 * @csspart cell - Every body cell.
 * @csspart cell-sorted - Body cells in the sorted column.
 * @csspart cell-pinned - Body cells in a pinned column, on either side.
 * @csspart cell-pinned-edge - The pinned body cell next to the scrolling columns (one per pinned side).
 * @csspart empty - The empty-state container.
 *
 * @cssprop [--argus-bg=Canvas] - Background of the table and rows.
 * @cssprop [--argus-fg=CanvasText] - Text colour.
 * @cssprop [--argus-font=inherit] - Font shorthand for the table.
 * @cssprop [--argus-header-bg] - Header background.
 * @cssprop [--argus-header-fg=inherit] - Header text colour.
 * @cssprop [--argus-border-color] - Colour of the row borders.
 * @cssprop [--argus-border-width=1px] - Width of the row borders.
 * @cssprop [--argus-row-height] - Height of a row. Default per density: 32px, 40px, 52px.
 * @cssprop [--argus-cell-padding-inline] - Inline padding of cells. Default per density: 8px, 12px, 16px.
 * @cssprop [--argus-row-stripe-bg] - Background of odd rows. Default: no stripes.
 * @cssprop [--argus-pinned-shadow] - Shadow on the pinned edge, as a `box-shadow` falling toward the end side (`4px 0 6px -4px …`). Mirrored for the end edge and in RTL; `none` removes it.
 * @cssprop [--argus-resize-handle-color] - Colour of the resize handle's line, shown on hover, focus and drag.
 * @cssprop [--argus-focus-ring=2px solid Highlight] - Outline of a focused header (and, later, cell).
 * @cssprop [--argus-row-hover-bg] - Background of the hovered row. Default: no change.
 */
@customElement('argus-table')
export class ArgusTable<T = unknown> extends LitElement {
  static override styles: CSSResultGroup = baseStyles;

  /** Column definitions. Property only: functions can't be attributes. */
  @property({ attribute: false })
  columns: readonly ColumnDef<T>[] = [];

  /** The rows to show. Replace the array to update; changes inside it aren't detected. */
  @property({ attribute: false })
  data: readonly T[] = [];

  /** Returns a stable id for a row. Default: the row's index in `data`. */
  @property({ attribute: false })
  getRowId?: (row: T, index: number) => string;

  /** Row height in px. Unset: the density (or the `--argus-row-height` token) decides. */
  @property({ attribute: 'row-height', type: Number })
  rowHeight?: number;

  /** Row density: `compact`, `comfortable` or `spacious`. */
  @property({ reflect: true })
  density: Density = 'comfortable';

  /** Rows rendered above and below the visible ones. */
  @property({ type: Number })
  overscan = 6;

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

  readonly #sorting = controllable<SortState>([]);
  readonly #sizing = controllable<ColumnSizingState>({});
  /** A resize the table applied itself; its event fires once the update is done. */
  #appliedResize: ColumnResizeDetail | undefined;
  /** A sort the table applied itself; its event fires once the update is done. */
  #appliedSort: SortState | undefined;
  readonly #internals = attachGridInternals(this);
  readonly #table = new TableController<T>();
  // Looked up lazily: the virtualizer's hostUpdated runs before firstUpdated.
  readonly #virtual = new VirtualController(this, () =>
    this.renderRoot.querySelector<HTMLElement>('[part~="table"]'),
  );
  #rowPx = 40;
  #probeObserver?: ResizeObserver;
  #window: VirtualWindow = { rows: [], totalSize: 0, range: null };
  #lastRange = '';

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.#observeProbe();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#probeObserver?.disconnect();
  }

  /** Scrolls so that the row at `index` (in the current row order) is at the top. */
  async scrollToRow(index: number): Promise<void> {
    await this.updateComplete;
    this.#virtual.scrollToIndex(index);
    await this.updateComplete;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (
      changed.has('columns') ||
      changed.has('data') ||
      changed.has('getRowId') ||
      changed.has('sorting') ||
      changed.has('columnSizing')
    ) {
      this.#table.update({
        columns: this.columns,
        data: this.data,
        getRowId: this.getRowId,
        sorting: this.#sorting.value,
        columnSizing: this.#sizing.value,
      });
    }
    const model = this.#table.model;
    this.#internals.ariaRowCount = String(model.rowCount + 1);
    this.#internals.ariaColCount = String(model.columns.length);
    this.#virtual.configure({
      count: model.rowCount,
      rowHeight: this.#rowPx,
      overscan: Math.max(0, this.overscan),
      rowIdAt: (index) => model.rowAt(index)?.id ?? String(index),
    });
  }

  protected override render(): TemplateResult {
    const model = this.#table.model;
    const columns = model.columns;
    this.#window = this.#virtual.computeWindow();
    const style: Record<string, string> = {
      '--_cols': columns.map(track).join(' '),
      '--_width': `${String(model.totalWidth)}px`,
    };
    if (this.rowHeight !== undefined && this.rowHeight > 0) {
      style['--_row-height'] = `${String(this.rowHeight)}px`;
    }
    return html`<div part="table" role="presentation" style=${styleMap(style)}>
      ${renderHeader(columns, this.#headerHandlers)}
      ${
        model.rowCount === 0
          ? html`<div part="empty"><slot name="empty">No rows</slot></div>`
          : renderBody(this.#window.rows, columns, this.#window.totalSize)
      }
      <div class="probe" aria-hidden="true"></div>
    </div>`;
  }

  protected override firstUpdated(): void {
    this.#observeProbe();
    this.#measureRowHeight();
  }

  protected override updated(changed: PropertyValues<this>): void {
    renderLightDom(this, this.#table.model, this.#window.rows);
    if (changed.has('density') || changed.has('rowHeight')) this.#measureRowHeight();
    if (this.#appliedResize) {
      const detail = this.#appliedResize;
      this.#appliedResize = undefined;
      fire(this, COLUMN_RESIZE, detail);
    }
    if (this.#appliedSort) {
      const sorting = this.#appliedSort;
      this.#appliedSort = undefined;
      fire(this, SORT_CHANGE, { sorting });
    }
    const { range } = this.#window;
    const key = range ? `${String(range.start)}:${String(range.end)}` : '';
    if (range && key !== this.#lastRange) {
      this.#lastRange = key;
      fire(this, RANGE_CHANGE, { start: range.start, end: range.end });
    }
  }

  readonly #headerHandlers = {
    click: (event: MouseEvent) => {
      const id = headerOf(event, 'sortCol')?.dataset.sortCol;
      if (id !== undefined) this.#requestSort(id);
    },
    keydown: (event: KeyboardEvent) => {
      if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        const cell = headerOf(event, 'col');
        const id = cell?.dataset.col;
        if (!cell || id === undefined) return;
        event.preventDefault();
        // Logical: the arrow pointing toward the inline end grows the column.
        const towardEnd = (event.key === 'ArrowRight') === (this.#direction() === 1);
        this.#requestResize(
          id,
          this.#currentWidth(id, cell) + (towardEnd ? RESIZE_STEP : -RESIZE_STEP),
        );
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const id = headerOf(event, 'sortCol')?.dataset.sortCol;
      if (id === undefined) return;
      event.preventDefault();
      this.#requestSort(id);
    },
    pointerdown: (event: PointerEvent) => {
      if (event.button !== 0) return;
      const handle = event.composedPath()[0];
      if (!(handle instanceof HTMLElement)) return;
      const id = handle.dataset.resizeCol;
      const cell = handle.parentElement;
      if (id === undefined || !cell) return;
      startResizeDrag(handle, event, cell.getBoundingClientRect().width, this.#direction(), (w) => {
        this.#requestResize(id, w);
      });
    },
  };

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
    const next = this.#table.model.nextSizing(columnId, width);
    const target = next?.[columnId];
    if (!next || target === undefined || target === this.#sizing.value[columnId]) return;
    const old = this.#sizing.value;
    const { value, applied } = this.#sizing.request(next);
    const detail = { columnId, width: target, sizing: value };
    if (applied) {
      this.#appliedResize = detail;
      this.requestUpdate('columnSizing', old);
    } else {
      fire(this, COLUMN_RESIZE, detail);
    }
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
