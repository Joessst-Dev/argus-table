import { EXPAND_COLUMN_ID, SELECTION_COLUMN_ID, type TableModel } from '@argus-table/core';
import { activate, cellTargetOf } from '../cell-events.js';
import { firstFocusable } from '../focusable.js';
import {
  dataIndexOf,
  directionOf,
  gridCell,
  gridRowOfCell,
  groupCell,
  groupCellOf,
  layoutOf,
  positionOfIndex,
} from '../grid.js';
import { firstDataColumn, PANEL_COLUMN } from '../render/body.js';
import type { CellContent } from '../types.js';
import type { ColumnReorder } from './column-reorder.js';
import type { ColumnResize } from './column-resize.js';
import type { DataController } from './data-controller.js';
import type { NavigationController } from './navigation.js';
import type { PluginController } from './plugins.js';

/** The element the keys are for: its shadow root holds the grid. */
type KeyHost = HTMLElement & { readonly renderRoot: HTMLElement | DocumentFragment };

function hasModifier(event: KeyboardEvent): boolean {
  return event.altKey || event.shiftKey || event.ctrlKey || event.metaKey;
}

/**
 * Shift+Tab out of the grid. Firefox makes the scroll container a tab stop, so
 * Shift+Tab would stop on it before leaving the grid. Take it out of the tab
 * order for this one move only: a tabindex there for good would expose it as a
 * node of its own between the grid and its rows.
 */
function leaveBackward(cell: HTMLElement, scroller: HTMLElement): void {
  scroller.tabIndex = -1;
  // Put it back once focus has actually moved (a timer can run first).
  cell.addEventListener(
    'focusout',
    () => {
      scroller.removeAttribute('tabindex');
    },
    { once: true },
  );
}

/**
 * The table's keydown handler: which of its own keys a key is (and which
 * controller handles it), before the rest move the active cell.
 */
export class KeyboardRouter<T> {
  readonly #host: KeyHost;
  readonly #model: () => TableModel<T, CellContent>;
  readonly #nav: NavigationController<T>;
  readonly #resize: ColumnResize<T>;
  readonly #reorder: ColumnReorder<T>;
  readonly #plugins: PluginController<T>;
  readonly #data: DataController<T>;
  /** Opens or closes a body row's panel (a data index). */
  readonly #toggle: (index: number) => void;
  /** Expands or collapses a tree row (a data index). */
  readonly #toggleTree: (index: number) => void;
  /** Sorts by a column: asc → desc → unsorted. */
  readonly #sort: (columnId: string) => void;

  constructor(
    host: KeyHost,
    model: () => TableModel<T, CellContent>,
    nav: NavigationController<T>,
    resize: ColumnResize<T>,
    reorder: ColumnReorder<T>,
    plugins: PluginController<T>,
    data: DataController<T>,
    toggle: (index: number) => void,
    toggleTree: (index: number) => void,
    sort: (columnId: string) => void,
  ) {
    this.#host = host;
    this.#model = model;
    this.#nav = nav;
    this.#resize = resize;
    this.#reorder = reorder;
    this.#plugins = plugins;
    this.#data = data;
    this.#toggle = toggle;
    this.#toggleTree = toggleTree;
    this.#sort = sort;
  }

  /**
   * Keys on a focused cell or header. The table's own come first, in this order:
   * Escape from a detail panel's content back to its cell, Shift+Tab out of the
   * grid, group headers' keys (`#groupKey`), a detail panel's cell (`#panelKey`),
   * then on other cells (`#cellKey`): Enter or Space on the chevron column,
   * plugins' keys, and a header's keys (`#headerKey`: Alt+Arrow resizes, with
   * Shift moves, Enter or Space sorts) or a body cell's (`#treeKey`: Right and
   * Left in a tree's first data column; `#bodyEnter`: a click, Retry on a failed
   * row, or a group row's toggle). The rest move the active cell
   * (`NavigationController`). Keys from content inside a cell (an input, a
   * button) are left to that content.
   */
  readonly onKeydown = (event: KeyboardEvent) => {
    const path = event.composedPath();
    const origin = path[0] ?? event.target ?? this.#host;
    const root = this.#host.renderRoot;
    if (event.key === 'Escape' && !event.defaultPrevented && this.#panelBack(path, origin)) {
      event.preventDefault();
      return;
    }
    // Only this table's cells: keys from content (a nested table's cells too) are the content's.
    const group = groupCell(origin, root);
    const cell = gridCell(origin, root) ?? group;
    const id = cell?.dataset.col;
    if (!cell || (id === undefined && !group)) return;
    const scroller = event.currentTarget as HTMLElement;
    if (event.key === 'Tab' && event.shiftKey) leaveBackward(cell, scroller);
    else if (group || id === undefined) this.#groupKey(event, cell, scroller);
    else if (id === PANEL_COLUMN) this.#panelKey(event, cell, scroller);
    else this.#cellKey(event, cell, id, scroller);
  };

  /** Keys on a detail panel's cell: Enter or F2 goes into its content; arrows move between rows. */
  #panelKey(event: KeyboardEvent, cell: HTMLElement, scroller: HTMLElement): void {
    if (event.key !== 'Enter' && event.key !== 'F2') {
      this.#nav.key(event, cell, PANEL_COLUMN, false, scroller);
      return;
    }
    const content = cell.querySelector('slot')?.assignedElements() ?? [];
    const target = firstFocusable(content);
    if (target) {
      event.preventDefault();
      target.focus();
    }
  }

  /**
   * Keys on a column header or a body or pinned-row cell: the chevron column's,
   * then plugins', then the header's or the body's own; the rest move the active cell.
   */
  #cellKey(event: KeyboardEvent, cell: HTMLElement, id: string, scroller: HTMLElement): void {
    if (id === EXPAND_COLUMN_ID && this.#expandKey(event, cell)) return;
    if (this.#pluginKey(event, id)) return;
    const inHeader = cell.getAttribute('role') === 'columnheader';
    const took = inHeader
      ? this.#headerKey(event, cell, id)
      : this.#treeKey(event, cell, id) || this.#bodyEnter(event, cell);
    if (!took) this.#nav.key(event, cell, id, inHeader, scroller);
  }

  /**
   * Enter or Space on a chevron cell opens or closes its row's panel. A group row
   * has no panel: its keys do what they do on its other cells (Enter opens or
   * closes the group, Space ticks its rows). `true` if the key is done with.
   */
  #expandKey(event: KeyboardEvent, cell: HTMLElement): boolean {
    if (event.key !== 'Enter' && event.key !== ' ') return false;
    const model = this.#model();
    const at = gridRowOfCell(cell, layoutOf(model));
    const index = at?.section === 'body' ? dataIndexOf(model, at.index) : undefined;
    if (index === undefined) return true;
    if (model.rows.grouped && model.rows.groupAt(index)) return false;
    event.preventDefault();
    this.#toggle(index);
    return true;
  }

  /** Offers the key to plugins (not on the checkbox and chevron columns). `true` if one took it. */
  #pluginKey(event: KeyboardEvent, id: string): boolean {
    if (id === SELECTION_COLUMN_ID || id === EXPAND_COLUMN_ID) return false;
    const target = cellTargetOf(event, this.#host.renderRoot, this.#model(), this.#nav);
    return target !== undefined && this.#plugins.keydown(event, target);
  }

  /**
   * A column header's own keys: Alt+Arrow resizes the column, or moves it with
   * Shift; Enter or Space sorts a sortable column. `true` if it took the key.
   */
  #headerKey(event: KeyboardEvent, cell: HTMLElement, id: string): boolean {
    const { key } = event;
    if ((key === 'ArrowLeft' || key === 'ArrowRight') && event.altKey) {
      event.preventDefault();
      // Logical: the arrow pointing toward the inline end grows the column, or
      // moves it that way with Shift.
      const towardEnd = (key === 'ArrowRight') === (directionOf(this.#host) === 1);
      if (event.shiftKey) this.#reorder.byKey({ kind: 'column', id }, towardEnd ? 1 : -1);
      else this.#resize.step(id, cell, towardEnd);
      return true;
    }
    if ((key === 'Enter' || key === ' ') && cell.dataset.sortCol !== undefined) {
      event.preventDefault();
      this.#sort(id);
      return true;
    }
    return false;
  }

  /**
   * Enter (no modifier keys) on a body or pinned-row cell does what a click does;
   * on a failed row, it retries; on a group row (which has no clicks), it opens or
   * closes the group. `true` if it took the key.
   */
  #bodyEnter(event: KeyboardEvent, cell: HTMLElement): boolean {
    if (event.key !== 'Enter' || hasModifier(event)) return false;
    const model = this.#model();
    const from = gridRowOfCell(cell, layoutOf(model));
    if (!from) return true;
    event.preventDefault();
    const index = from.section === 'body' ? dataIndexOf(model, from.index) : undefined;
    const { rows } = model;
    if (index !== undefined && rows.grouped && rows.groupAt(index)) {
      this.#toggleTree(index);
    } else if (index !== undefined && rows.stateAt(index) === 'error') {
      this.#data.retry(index);
    } else {
      activate(this.#host, this.#host.renderRoot, model, event.composedPath());
    }
    return true;
  }

  /**
   * Right or Left (logical, no modifier keys) on a body cell of a tree's first
   * data column. Toward the inline end: expands a collapsed row with children.
   * Toward the start: collapses an expanded row, else moves to the parent row's
   * cell in that column (also from a data source's loading or failed child
   * row). A row a filter keeps expanded doesn't collapse. `false`
   * leaves the key to navigation: toward the end on an expanded row or a leaf,
   * toward the start on a top-level row that can't collapse.
   */
  #treeKey(event: KeyboardEvent, cell: HTMLElement, id: string): boolean {
    if ((event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') || hasModifier(event)) {
      return false;
    }
    const model = this.#model();
    if (!model.tree || id !== firstDataColumn(model.columns)) return false;
    const at = gridRowOfCell(cell, layoutOf(model));
    const index = at?.section === 'body' ? dataIndexOf(model, at.index) : undefined;
    if (index === undefined) return false;
    const info = model.treeRow(index);
    const towardEnd = (event.key === 'ArrowRight') === (directionOf(this.#host) === 1);
    if (!info) {
      // A data source's row not loaded: toward the start from a loading or failed
      // child row goes to its parent, which is shown (it's open).
      const parent = towardEnd ? undefined : model.rows.parentAt(index);
      if (parent === undefined) return false;
      event.preventDefault();
      this.#nav.moveTo({ section: 'body', index: positionOfIndex(model, parent) }, id);
      return true;
    }
    if (towardEnd) {
      if (!info.hasChildren || info.open) return false;
      event.preventDefault();
      this.#toggleTree(index);
      return true;
    }
    if (info.open && !info.forced) {
      event.preventDefault();
      this.#toggleTree(index);
      return true;
    }
    if (info.parent === undefined) return false;
    event.preventDefault();
    this.#nav.moveTo({ section: 'body', index: positionOfIndex(model, info.parent) }, id);
    return true;
  }

  /**
   * Escape inside a detail panel's content (not on its cell): focus goes back to
   * the panel's cell. Not from a dialog or popover in the panel: Escape closes
   * those. Returns whether it moved focus.
   */
  #panelBack(path: readonly EventTarget[], origin: EventTarget): boolean {
    for (const target of path) {
      if (!(target instanceof HTMLElement)) continue;
      if (target.matches('dialog, [popover]')) return false;
      if (target.dataset.col !== PANEL_COLUMN || target.getRootNode() !== this.#host.renderRoot)
        continue;
      if (target === origin) return false;
      target.focus({ preventScroll: true });
      return true;
    }
    return false;
  }

  /**
   * Keys on a focused group header: Alt+Arrow resizes the group, or moves it
   * with Shift; Enter and Space do nothing (groups don't sort). The rest move
   * the active cell (`NavigationController.groupKey`).
   */
  #groupKey(event: KeyboardEvent, cell: HTMLElement, scroller: HTMLElement): void {
    const here = groupCellOf(this.#model(), cell.dataset.groupKey);
    if (here?.groupId === undefined) return;
    const { key } = event;
    if ((key === 'ArrowLeft' || key === 'ArrowRight') && event.altKey) {
      event.preventDefault();
      const towardEnd = (key === 'ArrowRight') === (directionOf(this.#host) === 1);
      if (event.shiftKey) {
        this.#reorder.byKey({ kind: 'group', id: here.groupId, pin: here.pin }, towardEnd ? 1 : -1);
      } else {
        this.#resize.stepGroup(here, towardEnd);
      }
      return;
    }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      return;
    }
    this.#nav.groupKey(event, cell, scroller);
  }
}
