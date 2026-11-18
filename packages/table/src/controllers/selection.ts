import type { ReactiveElement } from 'lit';
import {
  clickSelection,
  controllable,
  sameSelection,
  selectAll,
  selectRange,
  SELECTION_COLUMN_ID,
  toggleRow,
  type SelectionStep,
  type SelectionTarget,
  type TableModel,
} from '@argus-table/core';
import { SELECTION_CHANGE } from '../events.js';
import { dataIndexOf, gridCell, gridRowOf, layoutOf } from '../grid.js';
import { fromInteractive } from '../interactive.js';
import type { SelectedAt } from '../render/body.js';
import type { CheckboxHandlers } from '../render/content.js';
import type { CheckAll } from '../render/header.js';
import type { CellContent, SelectionMode, SelectionState } from '../types.js';
import type { StateEvents } from './state-events.js';

/** What the selection reads from the table. */
interface SelectionHost extends ReactiveElement {
  selectionMode: SelectionMode;
  selectionCheckboxes: boolean;
}

/**
 * Row selection (`selectionMode`, `selection`, `argus-selection-change`): the
 * state, through `controllable()`, the anchor a Shift range starts from, and
 * what clicks, the checkboxes and the select-all keys do. The rules are core's
 * (`state/selection.ts`); keys that move focus while selecting are
 * `NavigationController`'s, which calls `range()`.
 *
 * Only loaded body rows are selectable: not pinned rows, not skeletons. Ids are
 * never pruned.
 */
export class SelectionController<T> {
  /** The `selection` property. */
  readonly state = controllable<SelectionState>([]);
  readonly #host: SelectionHost;
  readonly #model: () => TableModel<T, CellContent>;
  /** Whether rows come from a `dataSource` (only the loaded ones are selectable). */
  readonly #remote: () => boolean;
  readonly #events: StateEvents;
  /** `selection` as a set, for the rows rendered; rebuilt when `selection` changes. */
  #ids: { of: SelectionState; ids: ReadonlySet<string> } | undefined;
  /** The row a Shift range starts from: the last row clicked or toggled without Shift. */
  #anchor: string | undefined;
  /** The select-all checkbox's state, kept until the selection or the shown rows change. */
  #checkAll: { key: readonly unknown[]; state: CheckAll['state'] } | undefined;

  constructor(
    host: SelectionHost,
    model: () => TableModel<T, CellContent>,
    remote: () => boolean,
    events: StateEvents,
  ) {
    this.#host = host;
    this.#model = model;
    this.#remote = remote;
    this.#events = events;
  }

  /** `selectionMode`, with anything unknown read as `none`. */
  get mode(): SelectionMode {
    const mode = this.#host.selectionMode;
    return mode === 'single' || mode === 'multi' ? mode : 'none';
  }

  /** Whether the checkbox column shows. */
  get column(): boolean {
    return this.#host.selectionCheckboxes && this.mode !== 'none';
  }

  /** A restored selection: a Shift range starts over from it. */
  restored(): void {
    this.#anchor = undefined;
  }

  /** Whether each rendered body row is selected; `undefined` without a `selectionMode`. */
  selectedAt(): SelectedAt | undefined {
    if (this.mode === 'none') return undefined;
    const ids = this.#selected();
    const model = this.#model();
    return (index) => {
      const id = model.rowAt(index)?.id;
      return id === undefined ? undefined : ids.has(id);
    };
  }

  /** The select-all checkbox, in the checkbox column of a `multi` table. */
  checkAll(): CheckAll | undefined {
    if (!this.column || this.mode !== 'multi') return undefined;
    return { state: this.#checkAllState(), handlers: this.handlers };
  }

  /**
   * Selects for a click on a row; `toggle` for a click in the checkbox column
   * or with Ctrl/Cmd. A click elsewhere (the header, a pinned row, content
   * such as a button) selects nothing.
   */
  click(event: MouseEvent): void {
    if (this.mode === 'none') return;
    const path = event.composedPath();
    const target = this.#rowOf(path);
    if (!target) return;
    // A click in the checkbox column, beside the checkbox, toggles like it.
    const inCheckboxCell = path.some(
      (t) => t instanceof HTMLElement && t.dataset.col === SELECTION_COLUMN_ID,
    );
    this.#click(target, event, inCheckboxCell || event.ctrlKey || event.metaKey);
  }

  /** Space on a body row: toggles it. */
  toggle(index: number): void {
    const id = this.#model().rowAt(index)?.id;
    if (id !== undefined) this.#request(toggleRow(this.state.value, this.mode, id));
  }

  /**
   * Shift+Arrow or Shift+PageUp/PageDown from body row `from` to `to`: selects
   * the rows from the anchor (else `from`) to `to`, keeping the anchor.
   */
  range(from: number, to: number): void {
    const model = this.#model();
    const fromId = model.rowAt(from)?.id;
    const anchor =
      this.#anchorAt() ?? (fromId === undefined ? undefined : { id: fromId, index: from });
    if (!anchor) return;
    const idAt = (index: number) => model.rowAt(index)?.id;
    this.#request({ selection: selectRange([], anchor.index, to, idAt, false), anchor: anchor.id });
  }

  /** Selects every selectable row, keeping the others (with a `dataSource`: the loaded ones). */
  selectAll(): void {
    this.#request({
      selection: selectAll(this.state.value, this.#model().selectableIds()),
      anchor: this.#anchor,
    });
  }

  /** The select-all checkbox: clears the selection when every row is selected, else selects all. */
  toggleAll(): void {
    if (this.#checkAllState() === 'all') this.#request({ selection: [], anchor: this.#anchor });
    else this.selectAll();
  }

  /**
   * The checkboxes' handlers. The table owns their state: a click asks for a new
   * selection, and the render that always follows sets every box back to the
   * selection (`live()`), so a change a controlled host turns down unticks it
   * again. Not `preventDefault()`: for a real click the browser runs that render
   * inside the dispatch, then undoes the toggle after it, over the render. A
   * press leaves focus on the cell, so the grid's keys keep working.
   */
  readonly handlers: CheckboxHandlers = {
    row: (event) => {
      const index = Number((event.currentTarget as HTMLElement).dataset.row);
      const id = this.#model().rowAt(index)?.id;
      if (id !== undefined) this.#click({ id, index }, event, true);
      this.#host.requestUpdate();
    },
    all: () => {
      this.toggleAll();
      this.#host.requestUpdate();
    },
    press: (event) => {
      event.preventDefault();
      (event.currentTarget as HTMLElement).parentElement?.focus({ preventScroll: true });
    },
  };

  /**
   * A Shift+press on a row in `multi` mode selects a range of rows, not the
   * page's text from the last click: no text selection, and the cell still
   * takes focus.
   */
  readonly onMousedown = (event: MouseEvent): void => {
    if (!event.shiftKey || event.button !== 0 || this.mode !== 'multi') return;
    const path = event.composedPath();
    if (!this.#rowOf(path)) return;
    event.preventDefault();
    for (const target of path) {
      const cell = gridCell(target);
      if (cell) {
        cell.focus({ preventScroll: true });
        return;
      }
    }
  };

  /** Selects for a click on a row, through `clickSelection`. */
  #click(target: SelectionTarget, event: MouseEvent, toggle: boolean): void {
    const model = this.#model();
    this.#request(
      clickSelection(
        this.state.value,
        this.mode,
        target,
        this.#anchorAt(),
        { toggle, range: event.shiftKey },
        (index) => model.rowAt(index)?.id,
      ),
    );
  }

  /**
   * Changes the selection through the controlled/uncontrolled rules, and moves
   * the anchor. A step that leaves the same rows selected fires nothing.
   */
  #request(step: SelectionStep | undefined): void {
    if (!step) return;
    this.#anchor = step.anchor;
    if (sameSelection(step.selection, this.state.value)) return;
    this.#events.change('selection', this.state, step.selection, SELECTION_CHANGE, [['', {}]]);
  }

  /** `selection` as a set, rebuilt only when `selection` changes. */
  #selected(): ReadonlySet<string> {
    const selection = this.state.value;
    if (this.#ids?.of !== selection) this.#ids = { of: selection, ids: new Set(selection) };
    return this.#ids.ids;
  }

  /**
   * Whether all, some or none of the selectable rows are selected. With `data`
   * it's worked out once per selection and row order (data, sort, filters), not
   * on scroll; with a `dataSource` every time, over the loaded rows, which
   * eviction keeps few.
   */
  #checkAllState(): CheckAll['state'] {
    const model = this.#model();
    const count = (): CheckAll['state'] => {
      const ids = model.selectableIds();
      const selected = this.#selected();
      const n = ids.reduce((sum, id) => (selected.has(id) ? sum + 1 : sum), 0);
      if (n === 0) return 'none';
      return n === ids.length ? 'all' : 'some';
    };
    if (this.#remote()) return count();
    const key = [this.state.value, model.rowOrder];
    const cached = this.#checkAll;
    if (cached?.key.every((k, i) => k === key[i])) return cached.state;
    const state = count();
    this.#checkAll = { key, state };
    return state;
  }

  /**
   * The loaded body row a pointer event is on, as a selection target. None for
   * the header, pinned rows, rows still loading, and presses on interactive
   * content in a cell (a button, a link, an input).
   */
  #rowOf(path: readonly EventTarget[]): SelectionTarget | undefined {
    // This table's row: a nested table's (in a cell or a panel) is skipped.
    const row = path.find(
      (t): t is HTMLElement =>
        t instanceof HTMLElement &&
        t.getAttribute('role') === 'row' &&
        t.getRootNode() === this.#host.renderRoot,
    );
    if (!row || fromInteractive(path, row)) return undefined;
    const model = this.#model();
    const at = gridRowOf(row, layoutOf(model));
    if (at?.section !== 'body') return undefined;
    // A panel's row selects nothing.
    const index = dataIndexOf(model, at.index);
    const id = index === undefined ? undefined : model.rowAt(index)?.id;
    return id === undefined || index === undefined ? undefined : { id, index };
  }

  /** The anchor row and where it is now; `undefined` if it isn't in the rows (or not loaded). */
  #anchorAt(): SelectionTarget | undefined {
    const id = this.#anchor;
    if (id === undefined) return undefined;
    const index = this.#model().indexOf(id);
    return index === undefined ? undefined : { id, index };
  }
}
