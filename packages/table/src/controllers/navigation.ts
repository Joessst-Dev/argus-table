import type { ReactiveElement } from 'lit';
import {
  SELECTION_COLUMN_ID,
  type ColumnView,
  type GridRow,
  type HeaderGroupCell,
  type RowLayout,
  type StandIn,
  type TableModel,
} from '@argus-table/core';
import {
  dataIndexOf,
  directionOf,
  gridCell,
  gridRowOf,
  gridRowOfCell,
  groupCell,
  layoutOf,
  panelRowId,
  positionOfIndex,
  rowIdOfPanel,
  type Active,
} from '../grid.js';
import { PANEL_COLUMN } from '../render/body.js';
import type { CellContent } from '../types.js';
import type { SelectionController } from './selection.js';
import type { VirtualController } from './virtual-controller.js';

/** What navigation reads from the table. */
interface NavigationHost extends ReactiveElement {
  rowHeight?: number | 'auto';
}

/** Sizes the table measures, for paging and revealing a row. */
export interface NavigationSizes {
  /** The row height in px. */
  rowPx: () => number;
  /** The header rows and the pinned rows: the rows in the scroller besides the body. */
  aroundPx: (layout: RowLayout) => number;
  /** The rows in the scroller above the body (header, top pinned rows) and below it, in px. */
  insets: (layout: RowLayout) => { before: number; after: number };
  /** Whether body rows have heights of their own (`rowHeight: 'auto'`, or open detail panels). */
  measured: () => boolean;
}

/** The active cell's row after a change: its index in its section, its id, and whether it's another row. */
interface Placed {
  index: number;
  rowId: string | undefined;
  moved: boolean;
}

type VerticalKey = 'PageDown' | 'PageUp' | 'ArrowDown' | 'ArrowUp';

function isVerticalKey(key: string): key is VerticalKey {
  return key === 'ArrowDown' || key === 'ArrowUp' || key === 'PageDown' || key === 'PageUp';
}

/**
 * The data row at body position `position`; on a detail panel, the next data
 * row in the direction moved (`down`), or the panel's own row at the end.
 */
function dataRowNear<T>(
  model: TableModel<T, CellContent>,
  position: number,
  down: boolean,
): number | undefined {
  const row = dataIndexOf(model, position);
  if (row !== undefined) return row;
  const shown = model.display.at(position);
  const next = shown && (down ? shown.index + 1 : shown.index);
  return next !== undefined && next >= model.rowCount ? shown?.index : next;
}

/** A row's id, loaded or not: a row not loaded gets the stand-in that holds its place. */
function idAt<T>(model: TableModel<T, CellContent>, index: number): string {
  const { rows } = model;
  return rows.idAt(index) ?? rows.standInId(index);
}

/**
 * The grid's single tab stop (WAI-ARIA grid pattern): which cell is active,
 * keeping it valid as rows and columns change (`reconcile()`), moving it with
 * the keyboard and with focus, and focusing it after the update that renders
 * it (`refocus()`, `focusPending()`). The table handles its own keys first
 * (resize, move, sort, Enter) and hands the rest to `key()` / `groupKey()`.
 */
export class NavigationController<T> {
  readonly #host: NavigationHost;
  readonly #model: () => TableModel<T, CellContent>;
  readonly #virtual: VirtualController;
  readonly #select: SelectionController<T>;
  readonly #env: NavigationSizes;
  #active: Active | undefined;
  /** Move focus to the active cell after the next update (keyboard navigation). */
  #focusPending = false;
  /** The header row of column headers at the last reconcile. */
  #leafLevel = 0;
  /** The column the active cell was on before it moved onto a detail panel: where it goes back to. */
  #lastCol: string | undefined;

  constructor(
    host: NavigationHost,
    model: () => TableModel<T, CellContent>,
    virtual: VirtualController,
    select: SelectionController<T>,
    sizes: NavigationSizes,
  ) {
    this.#host = host;
    this.#model = model;
    this.#virtual = virtual;
    this.#select = select;
    this.#env = sizes;
  }

  /** The active cell; `undefined` while there are no columns. */
  get active(): Active | undefined {
    return this.#active;
  }

  /** Focus the active cell after the next update: its header or row moves, or it was just set. */
  refocus(): void {
    this.#focusPending = true;
  }

  /**
   * In `updated()`: focuses the active cell if a move asked for it. Not while
   * rows just changed height (`resized`): they move with the next update.
   */
  focusPending(resized: boolean): void {
    if (!this.#focusPending || resized) return;
    this.#focusPending = false;
    this.#focus();
  }

  /**
   * Moves the active cell for a key on a focused cell or header, after the
   * table's own keys (resize, move, sort, Enter): arrows by cell, Home/End along
   * the row, PageUp/PageDown by a page of rows (the view scrolls with it),
   * Ctrl+Home/End (or Cmd) to the first header and the last cell, and with a
   * `selectionMode` the selection keys (`#selectionKey`).
   */
  key(
    event: KeyboardEvent,
    cell: HTMLElement,
    id: string,
    inHeader: boolean,
    scroller: HTMLElement,
  ): void {
    const { key } = event;
    if (this.#selectionKey(event, cell, id, inHeader, scroller)) return;
    // Ctrl (Cmd on macOS) only goes with Home and End: to the corners.
    const corner = event.ctrlKey || event.metaKey;
    if (event.altKey || event.shiftKey || (corner && key !== 'Home' && key !== 'End')) return;
    const model = this.#model();
    const layout = layoutOf(model);
    const from = gridRowOfCell(cell, layout);
    if (!from) return;
    const columns = model.columns;
    // A detail panel is one cell: only moves between rows (and the corners) leave it.
    const onPanel = id === PANEL_COLUMN;
    if (!onPanel) this.#lastCol = id;
    if (onPanel && !corner && key !== 'ArrowDown' && key !== 'ArrowUp' && !key.startsWith('Page')) {
      return;
    }
    const col = columns.findIndex((c) => c.id === (onPanel ? (this.#lastCol ?? id) : id));
    const to = this.#keyTarget(key, corner, layout.position(from), Math.max(col, 0), id, scroller);
    if (!to) return;
    event.preventDefault();
    let row = layout.at(to.pos) ?? layout.leafHeader;
    const target = columns[Math.min(Math.max(to.col, 0), columns.length - 1)];
    if (!target) return;
    if (row.section === 'header' && row.index < layout.header - 1 && key === 'ArrowUp') {
      // Up from a column header: to the nearest group above it, if there is one.
      const level = this.#headerLevelUp(model, row.index, target.id);
      if (level === undefined) return;
      row = { section: 'header', index: level };
    }
    this.#scrollWithMove(key, corner, from, row);
    // Onto a detail panel: its one cell.
    const panel = row.section === 'body' && model.display.at(row.index)?.kind === 'detail';
    this.moveTo(row, panel ? PANEL_COLUMN : target.id);
  }

  /**
   * The grid position and column index a navigation key moves to from grid
   * position `pos` and column index `col` (on column `id`); `undefined` for
   * keys that aren't navigation keys.
   */
  #keyTarget(
    key: string,
    corner: boolean,
    pos: number,
    col: number,
    id: string,
    scroller: HTMLElement,
  ): { pos: number; col: number } | undefined {
    const model = this.#model();
    const layout = layoutOf(model);
    const columns = model.columns;
    switch (key) {
      case 'PageDown':
      case 'PageUp':
      case 'ArrowDown':
      case 'ArrowUp':
        return { pos: this.#verticalStep(key, pos, layout, scroller), col };
      case 'ArrowRight':
        return { pos, col: col + directionOf(this.#host) };
      case 'ArrowLeft':
        return { pos, col: col - directionOf(this.#host) };
      case 'Home':
        if (!corner) return { pos, col: 0 };
        // The top header of the first column: its outermost group, else its header.
        pos = this.#headerLevelDown(model, 0, columns[0]?.id ?? id);
        this.#virtual.scrollToEdge('start');
        return { pos, col: 0 };
      case 'End':
        return { pos: corner ? layout.total - 1 : pos, col: columns.length - 1 };
      default:
        return undefined;
    }
  }

  /**
   * PageUp/PageDown scroll by as many rows as focus moved, so the focused cell
   * keeps its place on screen. The ends clamp; focusing scrolls the rest of the
   * way. Ctrl+End onto a bottom pinned row shows the end of the body too, as
   * Ctrl+Home shows its start.
   */
  #scrollWithMove(key: string, corner: boolean, from: GridRow, to: GridRow): void {
    if (key.startsWith('Page') && from.section === 'body' && to.section === 'body') {
      this.#scrollBetween(from.index, to.index);
    }
    if (corner && key === 'End' && to.section === 'bottom') this.#virtual.scrollToEdge('end');
  }

  /** Scrolls by the distance between two body positions. Through the virtualizer: a scaled body's px aren't rows. */
  #scrollBetween(from: number, to: number): void {
    this.#virtual.scrollBy(this.#virtual.startOf(to) - this.#virtual.startOf(from));
  }

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
   * Moves the active cell for a key on a focused group header, after the
   * table's own keys (Alt+Arrow). Arrows move between group headers in its row
   * (fillers are skipped) and to the headers above and below it; ArrowDown ends on
   * the column headers. Home and End go to the row's first and last group,
   * PageDown into the body, Ctrl+Home and Ctrl+End to the corners.
   */
  groupKey(event: KeyboardEvent, cell: HTMLElement, scroller: HTMLElement): void {
    const model = this.#model();
    const layout = layoutOf(model);
    const at = gridRowOf(cell.parentElement, layout);
    const row = at?.section === 'header' ? model.headerGroups[at.index] : undefined;
    const here = row?.find((c) => c.key === cell.dataset.groupKey);
    if (!at || !row || here?.groupId === undefined) return;
    // The column the group is active on, else its first.
    const active = this.#active;
    const anchor =
      active?.section === 'header' && active.index === at.index && here.columns.includes(active.col)
        ? active.col
        : here.columns[0];
    if (anchor === undefined) return;
    if (this.#selectionKey(event, cell, anchor, true, scroller)) return;
    const { key } = event;
    const corner = event.ctrlKey || event.metaKey;
    if (event.altKey || event.shiftKey || (corner && key !== 'Home' && key !== 'End')) return;
    const groups = row.filter((c) => c.kind === 'group');
    const to = this.#groupTarget(key, corner, at, anchor, groups, groups.indexOf(here), scroller);
    if (to === false) return;
    event.preventDefault();
    if (to) this.moveTo(to.row, to.col);
  }

  /**
   * Where a key on the group header at index `index` of its row's `groups`
   * (header row `at`, active on column `anchor`) moves: `undefined` for a key
   * it takes that goes nowhere, `false` for keys it doesn't handle.
   */
  #groupTarget(
    key: string,
    corner: boolean,
    at: GridRow,
    anchor: string,
    groups: readonly HeaderGroupCell<CellContent>[],
    index: number,
    scroller: HTMLElement,
  ): { row: GridRow; col: string } | undefined | false {
    const model = this.#model();
    const layout = layoutOf(model);
    // The first column of the group at `i` in this row, on this row.
    const onGroup = (i: number) => {
      const col = groups[i]?.columns[0];
      return col === undefined ? undefined : { row: at, col };
    };
    switch (key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const towardEnd = (key === 'ArrowRight') === (directionOf(this.#host) === 1);
        return onGroup(index + (towardEnd ? 1 : -1));
      }
      case 'Home':
      case 'End':
        if (!corner) return onGroup(key === 'Home' ? 0 : groups.length - 1);
        return this.#cornerTarget(key === 'Home', model, layout);
      case 'ArrowDown':
        return {
          row: { section: 'header', index: this.#headerLevelDown(model, at.index + 1, anchor) },
          col: anchor,
        };
      case 'ArrowUp': {
        const up = this.#headerLevelUp(model, at.index - 1, anchor);
        return up === undefined
          ? undefined
          : { row: { section: 'header', index: up }, col: anchor };
      }
      case 'PageDown': {
        const pos = this.#verticalStep(key, layout.position(at), layout, scroller);
        return { row: layout.at(pos) ?? at, col: anchor };
      }
      case 'PageUp':
        return undefined;
      default:
        return false;
    }
  }

  /**
   * Ctrl+Home or Ctrl+End from a group header: the first column's top header
   * (its outermost group, else its header), or the last cell, scrolling the body
   * to that end.
   */
  #cornerTarget(
    first: boolean,
    model: TableModel<T, CellContent>,
    layout: RowLayout,
  ): { row: GridRow; col: string } | undefined {
    const columns = model.columns;
    const col = (first ? columns[0] : columns.at(-1))?.id;
    if (col === undefined) return undefined;
    if (first) this.#virtual.scrollToEdge('start');
    else if (layout.bottom > 0) this.#virtual.scrollToEdge('end');
    const pos = first ? this.#headerLevelDown(model, 0, col) : layout.total - 1;
    return { row: layout.at(pos) ?? layout.leafHeader, col };
  }

  /**
   * The grid position ArrowUp/ArrowDown (one row) or PageUp/PageDown (a page of
   * the body) moves to from `pos`. PageDown from above the body lands a page
   * into it and stops at its last row; PageUp stays in the body.
   */
  #verticalStep(key: VerticalKey, pos: number, layout: RowLayout, scroller: HTMLElement): number {
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
    if (!this.#env.measured()) {
      // Whole rows between the sticky header rows and pinned rows (each one row tall).
      const fit = Math.floor(scroller.clientHeight / this.#env.rowPx() + 0.01);
      return Math.max(1, fit - layout.header - layout.top - layout.bottom);
    }
    // The body rows that fit between the header and the pinned rows, from the
    // focused body row (or the body's first or last row).
    const view = scroller.clientHeight - this.#env.aroundPx(layout);
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
    const select = this.#select;
    const mode = select.mode;
    if (mode === 'none' || event.altKey) return false;
    const { key } = event;
    if (event.ctrlKey || event.metaKey) {
      if (event.shiftKey || key.toLowerCase() !== 'a' || mode !== 'multi') return false;
      // Ctrl/Cmd+A: not the page's text, the rows.
      event.preventDefault();
      select.selectAll();
      return true;
    }
    if (inHeader) {
      // Space on the select-all header does what its checkbox does.
      if (key !== ' ' || col !== SELECTION_COLUMN_ID || mode !== 'multi') return false;
      event.preventDefault();
      select.toggleAll();
      return true;
    }
    const model = this.#model();
    const layout = layoutOf(model);
    const from = gridRowOf(cell.parentElement, layout);
    if (from?.section !== 'body') return false;
    // Selection keys act on data rows: a panel selects nothing.
    const fromRow = dataIndexOf(model, from.index);
    if (key === ' ') {
      // Space would scroll the table.
      event.preventDefault();
      if (fromRow !== undefined) select.toggle(fromRow);
      return true;
    }
    if (!event.shiftKey || mode !== 'multi' || !isVerticalKey(key)) return false;
    event.preventDefault();
    if (fromRow !== undefined) this.#extendSelection(key, from, fromRow, col, scroller);
    return true;
  }

  /**
   * Shift+ArrowUp/ArrowDown or Shift+PageUp/PageDown from body position `from`
   * (data row `fromRow`): moves focus through the body and selects from the
   * anchor to the row it lands on. A range stays in the body: the header and
   * pinned rows can't be selected.
   */
  #extendSelection(
    key: VerticalKey,
    from: GridRow,
    fromRow: number,
    col: string,
    scroller: HTMLElement,
  ): void {
    const model = this.#model();
    const layout = layoutOf(model);
    const bodyFirst = layout.position({ section: 'body', index: 0 });
    const pos = this.#verticalStep(key, layout.position(from), layout, scroller);
    const toRow = dataRowNear(
      model,
      Math.min(Math.max(pos, bodyFirst), bodyFirst + layout.body - 1) - bodyFirst,
      key === 'ArrowDown' || key === 'PageDown',
    );
    if (toRow === undefined || toRow === fromRow) return;
    const to = { section: 'body' as const, index: positionOfIndex(model, toRow) };
    if (key.startsWith('Page')) this.#scrollBetween(from.index, to.index);
    this.#select.range(fromRow, toRow);
    this.moveTo(to, col === PANEL_COLUMN ? (this.#lastCol ?? col) : col);
  }

  /** Focus that lands in a cell (a click, or content inside it) makes that cell active. */
  readonly onFocusin = (event: FocusEvent): void => {
    // Tab into the grid landed on the scroll container (Firefox makes it a tab
    // stop): move on to the grid's one tab stop, the active cell. Only when focus
    // came from outside the grid: coming from inside means the user is leaving,
    // and sending them back would trap the keyboard.
    const scroller = event.currentTarget as HTMLElement;
    if (event.composedPath()[0] === scroller) {
      const from = event.relatedTarget;
      if (!(from instanceof Node && scroller.contains(from))) {
        this.#focusPending = true;
        this.#host.requestUpdate();
      }
      return;
    }
    const root = this.#host.renderRoot;
    for (const target of event.composedPath()) {
      // A nested table's cells (in a cell or a panel) are its own.
      const group = groupCell(target, root);
      if (group) {
        this.#focusGroup(group);
        return;
      }
      const cell = gridCell(target, root);
      const col = cell?.dataset.col;
      if (cell && col !== undefined) {
        this.#focusCell(cell, col);
        return;
      }
      if (target === event.currentTarget) return;
    }
  };

  /** Focus on a cell or column header makes it active. */
  #focusCell(cell: HTMLElement, col: string): void {
    const model = this.#model();
    const row = gridRowOfCell(cell, layoutOf(model));
    if (col !== PANEL_COLUMN) this.#lastCol = col;
    const prev = this.#active;
    if (row && (row.section !== prev?.section || row.index !== prev.index || col !== prev.col)) {
      this.#active = { ...row, rowId: this.gridRowId(model, row), col };
      this.#host.requestUpdate();
    }
  }

  /** Focus on a group header makes it active, on the column it was active on, else its first. */
  #focusGroup(cell: HTMLElement): void {
    const model = this.#model();
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
    this.#host.requestUpdate();
  }

  /**
   * A row's id. A data source row that hasn't loaded gets a stand-in: the
   * active cell's row id if it sits there (so its DOM and focus stay put), else
   * the row structure's stand-in (`standInId`), which holds its place as rows load above it.
   */
  rowId(model: TableModel<T, CellContent>, index: number): string {
    const active = this.#active;
    const held = active?.section === 'body' ? active.rowId : undefined;
    if (
      held !== undefined &&
      model.rows.stateAt(index) !== 'loaded' &&
      dataIndexOf(model, active?.index ?? -1) === index
    ) {
      return held;
    }
    return idAt(model, index);
  }

  /** The id of a grid row: a body or pinned row's id; none for the header. */
  gridRowId(model: TableModel<T, CellContent>, row: GridRow): string | undefined {
    switch (row.section) {
      case 'header':
        return undefined;
      case 'body': {
        // A position: a data row's id, or a panel's (from its row's).
        const shown = model.display.at(row.index);
        // Past the body (a move to clamp): a stand-in id, so `reconcile()` clamps it.
        if (!shown) return this.rowId(model, row.index);
        const id = this.rowId(model, shown.index);
        return shown.kind === 'data' ? id : panelRowId(id);
      }
      default:
        return model.pinnedRowAt(row.section, row.index)?.id;
    }
  }

  /** Makes a cell active and focuses it after the update. The keep-rendered rule renders its row. */
  moveTo(row: GridRow, col: string): void {
    const model = this.#model();
    if (col !== PANEL_COLUMN) this.#lastCol = col;
    this.#active = { ...row, rowId: this.gridRowId(model, row), col };
    this.#focusPending = true;
    this.#host.requestUpdate();
  }

  /**
   * Focuses the active cell and scrolls it into view: through the virtualizer
   * when the body is scaled or rows are measured (the row may move again).
   */
  #focus(): void {
    const active = this.#active;
    if (!active) return;
    const col = CSS.escape(active.col);
    const model = this.#model();
    const layout = layoutOf(model);
    // aria-rowindex is unique across the grid: header, pinned and body rows.
    const index = layout.ariaRowIndex(active);
    const row = `[role='row'][aria-rowindex="${String(index)}"]`;
    if (active.section === 'header' && active.index < layout.header - 1) {
      // A group header: focus it, and show the column it is active on.
      const key = model.headerCell(active.index, active.col)?.key ?? '';
      const group = this.#host.renderRoot.querySelector<HTMLElement>(
        `${row} > [data-group-key="${CSS.escape(key)}"]`,
      );
      if (!group) return;
      group.focus({ preventScroll: true });
      const leaf = `[role='row'][aria-rowindex="${String(layout.header)}"] > [data-col="${col}"]`;
      this.#host.renderRoot
        .querySelector(leaf)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }
    const cell = this.#host.renderRoot.querySelector<HTMLElement>(`${row} > [data-col="${col}"]`);
    if (!cell) return;
    cell.focus({ preventScroll: true });
    // A scaled body moves `ratio` px of rows per px scrolled, so the browser can't
    // scroll a body row into view: the virtualizer does, and the next update
    // (from its scroll) shows the row and scrolls sideways. Rows of different
    // heights too: rows measured on the way can move the row again, so it
    // scrolls until they're done.
    if (active.section === 'body' && (this.#virtual.scaled || this.#env.measured())) {
      const { before, after } = this.#env.insets(layout);
      if (this.#virtual.reveal(active.index, before, after)) {
        this.#focusPending = true;
        return;
      }
    }
    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /**
   * Keeps the active cell valid after columns or rows change. In the body: on the
   * same row id when it still exists (it may have moved), else (a tree row under a
   * collapsed row, or filtered out) on its nearest shown ancestor, else at the
   * same index, clamped. A data source row that isn't loaded (yet, or any more) keeps
   * its id. A pinned row stays at its index, clamped to its list. A row whose
   * section has no rows left gives way to the header, the default. If its row
   * went away while the grid had focus, focus follows to the replacement.
   */
  reconcile(model: TableModel<T, CellContent>): void {
    const columns = model.columns;
    const first = columns[0];
    if (!first) {
      this.#active = undefined;
      return;
    }
    const layout = layoutOf(model);
    const prev = this.#active ?? { ...layout.leafHeader, rowId: undefined, col: first.id };
    // On a detail panel the column is the panel's own; it's checked with the row below.
    const col =
      prev.col === PANEL_COLUMN || columns.some((c) => c.id === prev.col)
        ? prev.col
        : this.#columnInPlaceOf(model, prev.col, first.id);
    const placed = this.#placeRow(model, prev, col, layout.header - 1);
    this.#leafLevel = layout.header - 1;
    let { section } = prev;
    let { index, rowId } = placed;
    if (index < 0) {
      ({ section, index } = layout.leafHeader);
      rowId = undefined;
    }
    const cellCol = this.#columnOnRow(model, section, index, col, first.id);
    // The cell went away (with its column, or its row) while focused: focus its replacement.
    const moved = placed.moved || (col !== prev.col && this.#active !== undefined);
    if (moved && this.#host.matches(':focus-within')) this.#focusPending = true;
    if (
      section !== prev.section ||
      index !== prev.index ||
      rowId !== prev.rowId ||
      cellCol !== prev.col ||
      !this.#active
    ) {
      this.#active = { section, index, rowId, col: cellCol };
    }
  }

  /** Where the active cell's row is now, in its own section; `moved` if it's another row. */
  #placeRow(model: TableModel<T, CellContent>, prev: Active, col: string, leaf: number): Placed {
    const { section, index, rowId } = prev;
    switch (section) {
      case 'header':
        return this.#placeHeader(model, index, rowId, col, leaf);
      case 'body':
        return rowId === undefined
          ? { index, rowId, moved: false }
          : this.#placeBodyRow(model, index, rowId);
      default: {
        // A pinned row stays at its index, clamped to its list.
        const count = model.pinnedCount(section);
        const at = Math.min(index, count - 1);
        const id = at >= 0 ? model.pinnedRowAt(section, at)?.id : undefined;
        return { index: at, rowId: id, moved: index >= count };
      }
    }
  }

  /**
   * The header row the active cell stays on: the column headers (still there,
   * though group rows came or went above), or a group header whose group is
   * still over its column. A group that went away hands over to the column's
   * header.
   */
  #placeHeader(
    model: TableModel<T, CellContent>,
    index: number,
    rowId: string | undefined,
    col: string,
    leaf: number,
  ): Placed {
    if (!this.#active || index === this.#leafLevel) return { index: leaf, rowId, moved: false };
    const gone = index >= leaf || model.headerCell(index, col)?.kind !== 'group';
    return { index: gone ? leaf : index, rowId, moved: gone };
  }

  /**
   * Where the active body row is now: on the same row id when it still exists
   * (it may have moved; a panel follows its row, or a closed one's cell goes to
   * the row), else on its stand-in's place (a data source row not loaded keeps
   * its id), else (a tree row under a collapsed row, or filtered out) on its
   * nearest shown ancestor, else at the same position, clamped.
   */
  #placeBodyRow(model: TableModel<T, CellContent>, index: number, rowId: string): Placed {
    const display = model.display;
    // A panel's id names its row's.
    const owner = rowIdOfPanel(rowId);
    const found = model.indexOf(owner ?? rowId);
    if (found !== undefined) {
      if (owner === undefined) return { index: display.positionOf(found), rowId, moved: false };
      const panel = display.detailPositionOf(found);
      return panel === undefined
        ? { index: display.positionOf(found), rowId: owner, moved: true }
        : { index: panel, rowId, moved: false };
    }
    // A row not loaded yet keeps its stand-in id, which holds its data index:
    // its position follows panels that appear above it.
    const held = model.rows.standIn(rowId);
    if (held?.moves) return this.#placeMovingStandIn(model, held, rowId);
    if (
      held !== undefined &&
      held.index < model.rowCount &&
      model.rows.idAt(held.index) === undefined
    ) {
      return { index: display.positionOf(held.index), rowId, moved: false };
    }
    // A tree row out of the shown rows (its parent collapsed, or a filter
    // dropped it): to its nearest shown ancestor.
    const ancestor = model.shownAncestor(owner ?? rowId);
    if (ancestor !== undefined) {
      return {
        index: display.positionOf(ancestor),
        rowId: this.rowId(model, ancestor),
        moved: true,
      };
    }
    // A data source row that isn't loaded (any more) keeps its place and id.
    const data = dataIndexOf(model, index);
    if (data !== undefined && model.rows.idAt(data) === undefined) {
      return { index, rowId, moved: false };
    }
    const at = Math.min(index, display.count - 1);
    const id = at >= 0 ? this.gridRowId(model, { section: 'body', index: at }) : undefined;
    return { index: at, rowId: id, moved: true };
  }

  /**
   * A data source tree's row not loaded: where it is now (rows may have loaded
   * above it), with its id once it has loaded; or its replacement. Rendered rows
   * follow ids: under the same id the focused cell stays (and isn't scrolled
   * back into view); another id renders another row.
   */
  #placeMovingStandIn(model: TableModel<T, CellContent>, held: StandIn, rowId: string): Placed {
    const loaded = model.rows.idAt(held.index);
    const id = loaded !== undefined || !held.same ? (loaded ?? idAt(model, held.index)) : rowId;
    return {
      index: model.display.positionOf(held.index),
      rowId: id,
      moved: !held.same || id !== rowId,
    };
  }

  /** The column of the active cell on its row: a panel's one cell, or back to a column off one. */
  #columnOnRow(
    model: TableModel<T, CellContent>,
    section: GridRow['section'],
    index: number,
    col: string,
    fallback: string,
  ): string {
    if (section === 'body' && model.display.at(index)?.kind === 'detail') return PANEL_COLUMN;
    if (col !== PANEL_COLUMN) return col;
    const last = this.#lastCol;
    return last !== undefined && model.columns.some((c) => c.id === last) ? last : fallback;
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
}
