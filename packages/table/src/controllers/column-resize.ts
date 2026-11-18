import type { ReactiveElement } from 'lit';
import {
  controllable,
  spreadWidth,
  type ColumnResizeEndDetail,
  type HeaderGroupCell,
  type TableModel,
} from '@argus-table/core';
import { COLUMN_RESIZE_END, COLUMN_SIZING_CHANGE } from '../events.js';
import { directionOf, groupCellOf } from '../grid.js';
import type { CellContent, ColumnSizingState } from '../types.js';
import { measureColumns } from './auto-width.js';
import { startResizeDrag } from './resize-drag.js';
import type { StateEvents } from './state-events.js';

/** How many px Alt+Arrow resizes by. */
const RESIZE_STEP = 10;

/** What resizing reads from the table. */
interface ResizeHost extends ReactiveElement {
  autosizeColumns(ids?: readonly string[]): Promise<void>;
}

/**
 * Column resizing (`columnSizing`, `argus-column-sizing-change`,
 * `argus-column-resize-end`): the state, through `controllable()`, drags on a
 * column's or group's resize handle, a double-click fit, Alt+Arrow, and
 * `request()` for `autosizeColumns()`. A group resize spreads over its
 * resizable columns (core `spreadWidth`), so events fire per column. A drag,
 * key press or fit is one resize: `argus-column-resize-end` fires once after
 * its changes.
 */
export class ColumnResize<T> {
  /** The `columnSizing` property. */
  readonly state = controllable<ColumnSizingState>({});
  readonly #host: ResizeHost;
  readonly #model: () => TableModel<T, CellContent>;
  readonly #events: StateEvents;
  /** The resize under way (a drag), or one in this call: the columns it changed and the last sizing. */
  #resizing: ColumnResizeEndDetail | undefined;

  constructor(host: ResizeHost, model: () => TableModel<T, CellContent>, events: StateEvents) {
    this.#host = host;
    this.#model = model;
    this.#events = events;
  }

  /**
   * A press on a header: starts a resize drag when it is on a column's or a
   * group's resize handle. Returns whether it did (else it may start a move).
   */
  pointerdown(handle: HTMLElement, event: PointerEvent): boolean {
    const group = groupCellOf(this.#model(), handle.dataset.resizeGroup);
    if (group) {
      const starts = this.#groupWidths(group.columns);
      const total = [...starts.values()].reduce((sum, w) => sum + w, 0);
      this.#startResize();
      startResizeDrag(
        handle,
        event,
        total,
        directionOf(this.#host),
        (w) => {
          this.#requestGroupResize(group.columns, starts, w);
        },
        this.#endResize,
      );
      return true;
    }
    const id = handle.dataset.resizeCol;
    const cell = handle.parentElement;
    if (id !== undefined && cell) {
      this.#startResize();
      startResizeDrag(
        handle,
        event,
        cell.getBoundingClientRect().width,
        directionOf(this.#host),
        (w) => {
          this.#requestResize(id, w);
        },
        this.#endResize,
      );
      return true;
    }
    return false;
  }

  /** A double-click on a resize handle fits the column to its rendered content. */
  readonly dblclick = (event: MouseEvent): void => {
    const handle = event.composedPath()[0];
    if (!(handle instanceof HTMLElement)) return;
    // A group's handle fits each of its columns (`autosizeColumns()` for them).
    const group = groupCellOf(this.#model(), handle.dataset.resizeGroup);
    if (group) {
      void this.#host.autosizeColumns([...group.columns]);
      return;
    }
    const id = handle.dataset.resizeCol;
    if (id === undefined) return;
    this.request(measureColumns(this.#host.renderRoot, [id]));
  };

  /** Alt+Arrow on a column's header: one step wider toward the inline end, else narrower. */
  step(id: string, cell: HTMLElement, towardEnd: boolean): void {
    this.#requestResize(
      id,
      this.#currentWidth(id, cell) + (towardEnd ? RESIZE_STEP : -RESIZE_STEP),
    );
  }

  /** Alt+Arrow on a group's header: resizes its resizable columns by one step. */
  stepGroup(group: HeaderGroupCell<CellContent>, towardEnd: boolean): void {
    if (!group.resizable) return;
    const starts = this.#groupWidths(group.columns);
    const total = [...starts.values()].reduce((sum, w) => sum + w, 0);
    this.#requestGroupResize(
      group.columns,
      starts,
      total + (towardEnd ? RESIZE_STEP : -RESIZE_STEP),
    );
  }

  /**
   * Sets column widths (clamped by core) in one change, through the
   * controlled/uncontrolled rules. One `argus-column-sizing-change` per column
   * that changes, each with the whole new sizing.
   */
  request(widths: ReadonlyMap<string, number>): void {
    const model = this.#model();
    const old = this.state.value;
    const targets: [string, number][] = [];
    for (const [columnId, width] of widths) {
      const target = model.nextSizing(columnId, width)?.[columnId];
      if (target !== undefined && target !== old[columnId]) targets.push([columnId, target]);
    }
    if (targets.length === 0) return;
    const value = this.#events.change(
      'columnSizing',
      this.state,
      { ...old, ...Object.fromEntries(targets) },
      COLUMN_SIZING_CHANGE,
      targets.map(([columnId, width]) => [columnId, { columnId, width }]),
    );
    // Outside a drag, this call is the whole resize: it ends below.
    const single = !this.#resizing;
    const resize = (this.#resizing ??= { columnSizing: value, columnIds: [] });
    resize.columnSizing = value;
    for (const [columnId] of targets) {
      if (!resize.columnIds.includes(columnId)) resize.columnIds.push(columnId);
    }
    if (single) this.#endResize();
  }

  #kept: string | undefined;

  /**
   * The column resized last on its own (a drag or Alt+Arrow): with `stretchColumns`
   * it keeps its width while the others fill the table. Not state: kept until
   * another column is resized.
   */
  get kept(): string | undefined {
    return this.#kept;
  }

  /** Sets one column's width (clamped by core), through the controlled/uncontrolled rules. */
  #requestResize(columnId: string, width: number): void {
    this.#kept = columnId;
    this.request(new Map([[columnId, width]]));
  }

  /**
   * The width a resize starts from: for the column resized last, the latest
   * requested width (key presses can come faster than renders); else the width
   * it renders at (stretched or not), or a flex column's rendered width.
   */
  #currentWidth(columnId: string, cell: HTMLElement): number {
    const sized = this.state.value[columnId];
    if (sized !== undefined && columnId === this.#kept) return sized;
    const view = this.#model().columns.find((c) => c.id === columnId);
    return view && view.flex === undefined ? view.width : cell.getBoundingClientRect().width;
  }

  /**
   * The widths a group resize starts from, by column: each column's
   * `#currentWidth()`, else the model's.
   */
  #groupWidths(columnIds: readonly string[]): Map<string, number> {
    const widths = new Map<string, number>();
    for (const id of columnIds) {
      const header = this.#host.renderRoot.querySelector<HTMLElement>(
        `[part~='header-cell'][data-col="${CSS.escape(id)}"]`,
      );
      const view = this.#model().columns.find((c) => c.id === id);
      widths.set(id, header ? this.#currentWidth(id, header) : (view?.width ?? 0));
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
    const views = new Map(this.#model().columns.map((c) => [c.id, c]));
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
    this.request(spreadWidth(spread, total - fixed));
  }

  /** A drag on a resize handle starts: its changes add up to one `argus-column-resize-end`. */
  #startResize(): void {
    this.#resizing = { columnSizing: this.state.value, columnIds: [] };
  }

  /**
   * The resize is done: `argus-column-resize-end` fires if it changed a width,
   * after the update when the table applied it, right away when `columnSizing` is controlled.
   */
  readonly #endResize = (): void => {
    const detail = this.#resizing;
    this.#resizing = undefined;
    if (!detail || detail.columnIds.length === 0) return;
    this.#events.emit(COLUMN_RESIZE_END, '', { ...detail }, this.state.controlled);
  };
}
