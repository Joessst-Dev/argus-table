import type { ReactiveElement } from 'lit';
import {
  clickSelection,
  controllable,
  sameSelection,
  selectAll,
  selectRange,
  SELECTION_COLUMN_ID,
  toggleBranch,
  toggleRow,
  withBranches,
  type BranchTree,
  type SelectionModifiers,
  type SelectionStep,
  type SelectionTarget,
  type TableModel,
} from '@argus-table/core';
import { SELECTION_CHANGE } from '../events.js';
import { dataIndexOf, gridCell, gridRowOf, layoutOf } from '../grid.js';
import { fromInteractive } from '../interactive.js';
import type { RowCheckboxes, SelectedAt } from '../render/body.js';
import type { CheckboxHandlers } from '../render/content.js';
import type { CheckAll } from '../render/header.js';
import type { CellContent, SelectionMode, SelectionState } from '../types.js';
import type { StateEvents } from './state-events.js';

/** What the selection reads from the table. */
interface SelectionHost extends ReactiveElement {
  selectionMode: SelectionMode;
  selectionCheckboxes: boolean;
  selectBranches: boolean;
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
 *
 * With branches (`selectBranches` on a tree in `multi` mode) each row clicked,
 * toggled or in a range counts as its branch (core's `withBranches` and
 * `toggleBranch`), select-all covers rows under collapsed rows, and the row
 * checkboxes show their branch's state.
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

  /**
   * Whether rows select as whole branches: `selectBranches` on a tree, in `multi`
   * mode. Not yet for a tree from a `dataSource` (no `branchTree()`).
   */
  #branches(): boolean {
    if (!this.#host.selectBranches || this.mode !== 'multi') return false;
    const model = this.#model();
    return model.tree && model.branchTree() !== undefined;
  }

  /**
   * Whether ticking a row could select nothing (core's `'blocked'`): with
   * branches, its id kept out by rows a filter hides, and nothing under it to
   * tick. Its checkbox is disabled, and clicks and Space on it do nothing.
   */
  #blocked(index: number): boolean {
    return this.#branches() && this.#model().branchCheck(this.#selected())(index) === 'blocked';
  }

  /** The kept rows as a tree of ids, with branches; else `undefined`. */
  #tree(): BranchTree | undefined {
    return this.#branches() ? this.#model().branchTree() : undefined;
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

  /**
   * The rows' checkboxes: handlers, name, and with branches each row's state
   * (one pass over the rows per selection and kept rows' tree).
   */
  checkboxes(label: string): RowCheckboxes {
    return this.#branches()
      ? { ...this.handlers, label, state: this.#model().branchCheck(this.#selected()) }
      : { ...this.handlers, label };
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

  /** Space on a body row: toggles it (with branches, its branch). */
  toggle(index: number): void {
    const id = this.#model().rowAt(index)?.id;
    if (id === undefined || this.#blocked(index)) return;
    const tree = this.#tree();
    if (tree) this.#request(this.#toggleBranch(id, tree));
    else this.#request(toggleRow(this.state.value, this.mode, id));
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
    const selection = selectRange([], anchor.index, to, idAt, false);
    const tree = this.#tree();
    this.#request({
      selection: tree ? withBranches([], selection, tree) : selection,
      anchor: anchor.id,
    });
  }

  /**
   * Selects every selectable row, keeping the others (with a `dataSource`: the
   * loaded ones; with branches, every row the filters keep, and the parents'
   * ids where their whole branch is selected).
   */
  selectAll(): void {
    const model = this.#model();
    const current = this.state.value;
    // Every row the filters keep is blocked: nothing to tick.
    if (this.#branches() && this.#checkAllState() === 'blocked') return;
    this.#request({
      selection: this.#branches()
        ? model.branchSelectAll(current, this.#selected())
        : selectAll(current, model.selectableIds()),
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

  /** Selects for a click on a row, through `clickSelection` (with branches, `#clickBranch`). */
  #click(target: SelectionTarget, event: MouseEvent, toggle: boolean): void {
    const model = this.#model();
    const tree = this.#tree();
    if (tree) {
      // On a blocked row, only a range does something: a click would select
      // nothing, or (plain) clear the rest.
      if (!(event.shiftKey && this.#anchorAt()) && this.#blocked(target.index)) return;
      this.#request(this.#clickBranch(target, { toggle, range: event.shiftKey }, tree));
      return;
    }
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
   * A click with branches, as `clickSelection` with each row counted as its
   * branch: a plain click selects the row's branch only, Ctrl/Cmd toggles it,
   * Shift selects the branches of the rows from the anchor, and Ctrl+Shift
   * adds them to the selection.
   */
  #clickBranch(
    target: SelectionTarget,
    modifiers: SelectionModifiers,
    tree: BranchTree,
  ): SelectionStep {
    const anchor = this.#anchorAt();
    if (modifiers.range && anchor) {
      const model = this.#model();
      const ids = selectRange([], anchor.index, target.index, (i) => model.rowAt(i)?.id, false);
      const current = modifiers.toggle ? this.state.value : [];
      return { selection: withBranches(current, ids, tree), anchor: anchor.id };
    }
    if (modifiers.toggle) return this.#toggleBranch(target.id, tree);
    return { selection: withBranches([], [target.id], tree), anchor: target.id };
  }

  /**
   * Toggles a row's branch: deselects it when its checkbox shows all of it
   * selected, which `toggleBranch` reads from the branch alone, not from a
   * pass over every row.
   */
  #toggleBranch(id: string, tree: BranchTree): SelectionStep {
    return {
      selection: toggleBranch(this.state.value, id, tree, this.#selected()),
      anchor: id,
    };
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
   * Whether all, some or none of the selectable rows are selected (with
   * branches, whether every row the filters keep counts as checked: core's
   * `branchCheckAll`, kept per selection and kept rows' tree, so expanding a
   * row doesn't count again). With `data` it's worked out once per selection
   * and row order (data, sort, filters, expanded rows), not on scroll; with a
   * `dataSource` every time, over the loaded rows, which eviction keeps few.
   */
  #checkAllState(): CheckAll['state'] {
    const model = this.#model();
    if (this.#branches()) return model.branchCheckAll(this.#selected());
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
