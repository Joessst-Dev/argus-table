import {
  LitElement,
  css,
  html,
  nothing,
  render,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  TableController,
  columnPinningFeature,
  columnSizingFeature,
  rowPinningFeature,
  tableFeatures,
  type Cell,
  type ColumnDef,
  type Row,
} from '@tanstack/lit-table';
import { VirtualizerController } from '@tanstack/lit-virtual';
import { EXTRA_COLUMNS, type Person } from './data.js';
import './spike-badge.js';

export type Variant = 'slotted' | 'shadow';
/** `row`: DOM keyed by row id (recreated for new rows). `pool`: DOM recycled per pool slot. */
export type Keying = 'row' | 'pool';

const features = tableFeatures({ columnPinningFeature, columnSizingFeature, rowPinningFeature });
type F = typeof features;

const ROW_HEIGHT = 36;

/** Twenty columns: 2 pinned at the start, 1 at the end, the rest scroll. Module constant = stable reference. */
const columns: ColumnDef<F, Person>[] = [
  { id: 'id', accessorKey: 'index', header: '#', size: 80 },
  { id: 'name', accessorKey: 'name', header: 'Name', size: 180 },
  { id: 'email', accessorKey: 'email', header: 'Email', size: 260 },
  { id: 'city', accessorKey: 'city', header: 'City', size: 120 },
  { id: 'country', accessorKey: 'country', header: 'Country', size: 90 },
  { id: 'status', accessorKey: 'status', header: 'Status', size: 110 },
  { id: 'amount', accessorKey: 'amount', header: 'Amount', size: 120 },
  { id: 'date', accessorKey: 'date', header: 'Date', size: 120 },
  ...Array.from({ length: EXTRA_COLUMNS }, (_, i): ColumnDef<F, Person> => {
    const id = `f${String(i + 1)}`;
    return { id, accessorFn: (p) => p.extra[i], header: id.toUpperCase(), size: 120 };
  }),
  { id: 'actions', accessorFn: () => '', header: '', size: 90 },
];

type Pin = 'start' | 'end' | false;

interface ColumnLayout {
  id: string;
  pin: Pin;
  edge: boolean;
  offset: number;
  colIndex: number;
}

/**
 * Rendering spike: virtualized rows, sticky pinned columns and rows, and cell content
 * either in shadow DOM (`shadow`) or slotted from light DOM (`slotted`).
 */
@customElement('spike-grid')
export class SpikeGrid extends LitElement {
  static override styles = css`
    :host {
      display: block;
      height: 100%;
      font:
        13px/1.4 system-ui,
        sans-serif;
      color-scheme: light dark;
      contain: strict;
    }
    [part~='table'] {
      height: 100%;
      overflow: auto;
      position: relative;
      overscroll-behavior: contain;
    }
    .row {
      display: grid;
      grid-template-columns: var(--_cols);
      width: var(--_width);
      height: ${ROW_HEIGHT}px;
    }
    .body {
      position: relative;
    }
    .body > .row {
      position: absolute;
      inset-block-start: 0;
      inset-inline-start: 0;
    }
    .header,
    .pinned-top {
      position: sticky;
      inset-block-start: 0;
      z-index: 3;
    }
    .pinned-top {
      inset-block-start: ${ROW_HEIGHT}px;
      z-index: 2;
    }
    .pinned-bottom {
      position: sticky;
      inset-block-end: 0;
      z-index: 2;
    }
    [part~='cell'],
    [part~='header-cell'] {
      box-sizing: border-box;
      padding-inline: 8px;
      display: flex;
      align-items: center;
      overflow: hidden;
      white-space: nowrap;
      background: Canvas;
      border-block-end: 1px solid light-dark(#e5e7eb, #374151);
    }
    [part~='header-cell'] {
      font-weight: 600;
      background: light-dark(#f9fafb, #111827);
    }
    [part~='row-pinned'] [part~='cell'] {
      background: light-dark(#f3f4f6, #1f2937);
    }
    [data-pin] {
      position: sticky;
      z-index: 1;
    }
    [data-pin='start'][data-edge] {
      box-shadow: 4px 0 6px -4px rgb(0 0 0 / 0.25);
    }
    [data-pin='end'][data-edge] {
      box-shadow: -4px 0 6px -4px rgb(0 0 0 / 0.25);
    }
    :host(:dir(rtl)) [data-pin='start'][data-edge] {
      box-shadow: -4px 0 6px -4px rgb(0 0 0 / 0.25);
    }
    :host(:dir(rtl)) [data-pin='end'][data-edge] {
      box-shadow: 4px 0 6px -4px rgb(0 0 0 / 0.25);
    }
  `;

  @property() variant: Variant = 'shadow';
  @property({ attribute: false }) rows: Person[] = [];
  @property({ type: Number }) overscan = 8;
  @property() keying: Keying = 'row';

  #internals = attachGridInternals(this);
  #table = new TableController<F, Person>(this);
  #virtual = new VirtualizerController<HTMLElement, Element>(this, {
    count: 0,
    getScrollElement: () => this.renderRoot.querySelector<HTMLElement>('[part~="table"]'),
    estimateSize: () => ROW_HEIGHT,
    overscan: this.overscan,
  });

  #layout: ColumnLayout[] = [];
  #layoutById = new Map<string, ColumnLayout>();
  #gridStyle: Record<string, string> = {};
  #topIds: string[] = [];
  #bottomIds: string[] = [];

  /** Slot pool: row id -> pool index, kept while the row stays rendered. */
  #pool = new Map<string, number>();
  #free: number[] = [];
  #poolSize = 0;
  /** Rows currently rendered (pinned + window), for the light-DOM pass. */
  #renderedRows: Row<F, Person>[] = [];
  /** Pixel range of the rendered window, read by the benchmark's blank-row check. */
  renderedRange = { start: 0, end: 0 };

  protected override willUpdate(changed: PropertyValues<this>) {
    if (changed.has('rows')) {
      const last = this.rows.at(-1);
      this.#topIds = this.rows.slice(0, 2).map((r) => r.id);
      this.#bottomIds = last ? [last.id] : [];
      this.#internals.ariaRowCount = String(this.rows.length + 1);
      this.#internals.ariaColCount = String(columns.length);
    }
    if (changed.has('overscan')) {
      this.#virtual.setOptions({ overscan: this.overscan });
    }
  }

  protected override render() {
    const table = this.#table.table({
      features,
      columns,
      data: this.rows,
      getRowId: (row) => row.id,
      initialState: {
        columnPinning: { start: ['id', 'name'], end: ['actions'] },
        rowPinning: { top: this.#topIds, bottom: this.#bottomIds },
      },
    });

    if (this.#layout.length === 0) this.#computeLayout(table);

    const center = table.getCenterRows();
    const v = this.#virtual.getVirtualizer();
    if (v.options.count !== center.length) {
      this.#virtual.setOptions({ count: center.length, getItemKey: (i) => center[i]?.id ?? i });
    }
    const items = v.getVirtualItems();
    const top = table.getTopRows();
    const bottom = table.getBottomRows();
    const windowRows = items.flatMap((item) => {
      const row = center[item.index];
      return row ? [{ row, start: item.start, index: item.index }] : [];
    });
    this.renderedRange = {
      start: items[0]?.start ?? 0,
      end: items.at(-1)?.end ?? 0,
    };
    this.#renderedRows = [...top, ...windowRows.map((w) => w.row), ...bottom];
    if (this.variant === 'slotted' || this.keying === 'pool') this.#assignPool();

    const headers = [
      ...table.getStartLeafHeaders(),
      ...table.getCenterLeafHeaders(),
      ...table.getEndLeafHeaders(),
    ];

    return html`
      <div part="table" role="presentation" style=${styleMap(this.#gridStyle)}>
        <div class="header row" role="row" aria-rowindex="1" part="header-row">
          ${repeat(
            headers,
            (h) => h.id,
            (h) =>
              this.#renderCellBox(h.column.id, 'header-cell', html`${h.column.columnDef.header}`),
          )}
        </div>
        <div class="pinned-top" role="rowgroup">
          ${repeat(
            top,
            (r) => r.id,
            (r) => this.#renderRow(r, null),
          )}
        </div>
        <div
          class="body"
          role="rowgroup"
          style=${styleMap({ height: `${String(v.getTotalSize())}px` })}
        >
          ${repeat(
            this.keying === 'pool'
              ? [...windowRows].sort((a, b) => this.#poolOf(a.row) - this.#poolOf(b.row))
              : windowRows,
            (w) => (this.keying === 'pool' ? this.#poolOf(w.row) : w.row.id),
            (w) => this.#renderRow(w.row, w.start),
          )}
        </div>
        <div class="pinned-bottom" role="rowgroup">
          ${repeat(
            bottom,
            (r) => r.id,
            (r) => this.#renderRow(r, null),
          )}
        </div>
      </div>
    `;
  }

  protected override updated() {
    if (this.variant === 'slotted') this.#renderLightDom();
  }

  /** Light-DOM pool size; the benchmark checks it stays bounded. */
  get poolSize(): number {
    return this.#poolSize;
  }

  #computeLayout(table: ReturnType<TableController<F, Person>['table']>) {
    const start = table.getStartLeafColumns();
    const centerCols = table.getCenterLeafColumns();
    const end = table.getEndLeafColumns();
    const ordered = [...start, ...centerCols, ...end];
    this.#layout = ordered.map((col, i) => {
      const pin: Pin = col.getIsPinned();
      const edge =
        (pin === 'start' && col.id === start.at(-1)?.id) ||
        (pin === 'end' && col.id === end[0]?.id);
      const offset =
        pin === 'start' ? col.getStart('start') : pin === 'end' ? col.getAfter('end') : 0;
      return { id: col.id, pin, edge, offset, colIndex: i };
    });
    this.#layoutById = new Map(this.#layout.map((l) => [l.id, l]));
    const sizes = ordered.map((c) => `${String(c.getSize())}px`).join(' ');
    const width = ordered.reduce((sum, c) => sum + c.getSize(), 0);
    this.#gridStyle = { '--_cols': sizes, '--_width': `${String(width)}px` };
  }

  #renderRow(row: Row<F, Person>, start: number | null) {
    const pinned = start === null;
    const cells = [
      ...row.getStartVisibleCells(),
      ...row.getCenterVisibleCells(),
      ...row.getEndVisibleCells(),
    ];
    const ariaRow = row.original.index + 2;
    return html`<div
      class="row"
      role="row"
      aria-rowindex=${ariaRow}
      part=${pinned ? 'row row-pinned' : `row ${row.original.index % 2 ? 'row-odd' : 'row-even'}`}
      style=${pinned ? nothing : styleMap({ transform: `translateY(${String(start)}px)` })}
    >
      ${repeat(
        cells,
        (c) => c.column.id,
        (c) => this.#renderCell(row, c),
      )}
    </div>`;
  }

  #renderCell(row: Row<F, Person>, cell: Cell<F, Person>) {
    if (this.variant === 'shadow') {
      return this.#renderCellBox(cell.column.id, 'cell', cellContent(cell));
    }
    const layout = this.#layoutById.get(cell.column.id);
    const pool = this.#pool.get(row.id);
    return this.#renderCellBox(
      cell.column.id,
      'cell',
      html`<slot name=${`c-${String(pool)}-${String(layout?.colIndex)}`}></slot>`,
    );
  }

  #renderCellBox(columnId: string, base: 'cell' | 'header-cell', content: TemplateResult) {
    const layout = this.#layoutById.get(columnId);
    const pin = layout?.pin ?? false;
    // Public part names only on body cells (as planned); headers use private data attributes.
    const parts: string[] = [base];
    if (base === 'cell' && pin) parts.push('cell-pinned');
    if (base === 'cell' && layout?.edge) parts.push('cell-pinned-edge');
    const style =
      pin === 'start'
        ? { insetInlineStart: `${String(layout?.offset ?? 0)}px` }
        : pin === 'end'
          ? { insetInlineEnd: `${String(layout?.offset ?? 0)}px` }
          : {};
    return html`<div
      part=${parts.join(' ')}
      role=${base === 'cell' ? 'gridcell' : 'columnheader'}
      aria-colindex=${(layout?.colIndex ?? 0) + 1}
      data-pin=${pin || nothing}
      data-edge=${layout?.edge ? '' : nothing}
      style=${styleMap(style)}
    >
      ${content}
    </div>`;
  }

  #poolOf(row: Row<F, Person>): number {
    return this.#pool.get(row.id) ?? -1;
  }

  /** Give every rendered row a pool index; rows that stay rendered keep theirs. */
  #assignPool() {
    const keep = new Set(this.#renderedRows.map((r) => r.id));
    for (const [id, index] of this.#pool) {
      if (!keep.has(id)) {
        this.#pool.delete(id);
        this.#free.push(index);
      }
    }
    for (const row of this.#renderedRows) {
      if (!this.#pool.has(row.id)) {
        const index = this.#free.pop() ?? this.#poolSize++;
        this.#pool.set(row.id, index);
      }
    }
  }

  /** Render slotted cell content as direct children of the host, keyed by pool index. */
  #renderLightDom() {
    // In pool order, so a recycled slot updates in place instead of moving.
    const entries = this.#renderedRows
      .map((row) => ({ row, pool: this.#poolOf(row) }))
      .sort((a, b) => (this.keying === 'pool' ? a.pool - b.pool : 0));
    render(
      repeat(
        entries,
        (e) => e.pool,
        (e) => {
          const cells = [
            ...e.row.getStartVisibleCells(),
            ...e.row.getCenterVisibleCells(),
            ...e.row.getEndVisibleCells(),
          ];
          return repeat(
            cells,
            (c) => c.column.id,
            (c) =>
              html`<div
                class="cell-content"
                slot=${`c-${String(e.pool)}-${String(this.#layoutById.get(c.column.id)?.colIndex)}`}
              >
                ${cellContent(c)}
              </div>`,
          );
        },
      ),
      this,
      { host: this },
    );
  }
}

function cellContent(cell: Cell<F, Person>): TemplateResult {
  const id = cell.column.id;
  if (id === 'status') return html`<spike-badge status=${cell.getValue()}></spike-badge>`;
  if (id === 'actions') return html`<button type="button" tabindex="-1">Open</button>`;
  return html`${String(cell.getValue())}`;
}

function attachGridInternals(host: HTMLElement): ElementInternals {
  const internals = host.attachInternals();
  internals.role = 'grid';
  return internals;
}

declare global {
  interface HTMLElementTagNameMap {
    'spike-grid': SpikeGrid;
  }
}
