import {
  LitElement,
  html,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { ColumnView } from '@argus-table/core';
import { TableController } from './controllers/table-controller.js';
import { VirtualController, type VirtualWindow } from './controllers/virtual-controller.js';
import { fire, RANGE_CHANGE } from './events.js';
import { renderBody } from './render/body.js';
import { renderLightDom } from './render/cells.js';
import { renderHeader } from './render/header.js';
import { baseStyles } from './styles/base.js';
import type { CellContent, ColumnDef, Density } from './types.js';

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
 * @fires argus-range-change - The visible rows changed. `detail: { start, end }` (row indices, inclusive).
 *
 * @slot empty - Shown instead of the body when there are no rows. Default: "No rows".
 *
 * @csspart table - The scroll container that holds header and body.
 * @csspart header - The sticky header row group.
 * @csspart header-row - The header row.
 * @csspart header-cell - Every header cell.
 * @csspart body - The row group holding the rendered body rows.
 * @csspart row - Every body row.
 * @csspart row-even - Body rows with an even index (0-based).
 * @csspart row-odd - Body rows with an odd index.
 * @csspart cell - Every body cell.
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
    if (changed.has('columns') || changed.has('data') || changed.has('getRowId')) {
      this.#table.update({
        columns: this.columns,
        data: this.data,
        getRowId: this.getRowId,
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
    // Temporary: `data-argus-pin-mode="cells"` selects the per-cell sticky layout for the
    // benchmark comparison. Removed with that layout once the numbers are in.
    const grouped = this.dataset.argusPinMode !== 'cells';
    this.#window = this.#virtual.computeWindow();
    const style: Record<string, string> = {
      '--_cols': columns.map(track).join(' '),
      '--_width': `${String(model.totalWidth)}px`,
    };
    if (this.rowHeight !== undefined && this.rowHeight > 0) {
      style['--_row-height'] = `${String(this.rowHeight)}px`;
    }
    return html`<div part="table" role="presentation" style=${styleMap(style)}>
      ${renderHeader(columns, grouped)}
      ${
        model.rowCount === 0
          ? html`<div part="empty"><slot name="empty">No rows</slot></div>`
          : renderBody(this.#window.rows, columns, this.#window.totalSize, grouped)
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
    const { range } = this.#window;
    const key = range ? `${String(range.start)}:${String(range.end)}` : '';
    if (range && key !== this.#lastRange) {
      this.#lastRange = key;
      fire(this, RANGE_CHANGE, { start: range.start, end: range.end });
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
