import type { ReactiveElement } from 'lit';
import { controllable, sameUnit, type OrderUnit, type TableModel } from '@argus-table/core';
import { announce } from '../announce.js';
import { COLUMN_ORDER_CHANGE } from '../events.js';
import { directionOf, pinnedWidth, unitKey } from '../grid.js';
import type { TableLabels } from '../labels.js';
import { headerText } from '../render/header-text.js';
import type { HeaderDrag } from '../render/header.js';
import type { CellContent, ColumnOrderState } from '../types.js';
import type { NavigationController } from './navigation.js';
import { canStartReorder, dropTarget, startReorderDrag, type DropSlot } from './reorder-drag.js';
import type { StateEvents } from './state-events.js';

/**
 * Column order (`columnOrder`, `argus-column-order-change`): the state, through
 * `controllable()`, header drags (`start()`), Alt+Shift+Arrow (`byKey()`) and
 * the announcement of a keyboard move once it has rendered (`announce()`).
 * Moves are of units, a column or a group on one pin side, among their siblings
 * (core `siblingUnits`, `nextMove`). A moved header is a new node, so focus
 * goes back to it through `NavigationController.refocus()`.
 */
export class ColumnReorder<T> {
  /** The `columnOrder` property. */
  readonly state = controllable<ColumnOrderState>([]);
  readonly #host: ReactiveElement;
  readonly #model: () => TableModel<T, CellContent>;
  readonly #events: StateEvents;
  readonly #nav: NavigationController<T>;
  readonly #labels: () => TableLabels;
  readonly #scroller: () => HTMLElement | null;
  /** The header being dragged to a new position, if any. */
  #drag: HeaderDrag | undefined;
  /** A move from the keyboard, announced once it has rendered: what moved and its old position. */
  #announceMove: { unit: OrderUnit; from: number } | undefined;

  constructor(
    host: ReactiveElement,
    model: () => TableModel<T, CellContent>,
    events: StateEvents,
    nav: NavigationController<T>,
    labels: () => TableLabels,
    scroller: () => HTMLElement | null,
  ) {
    this.#host = host;
    this.#model = model;
    this.#events = events;
    this.#nav = nav;
    this.#labels = labels;
    this.#scroller = scroller;
  }

  /** The header being dragged, for rendering. */
  get drag(): HeaderDrag | undefined {
    return this.#drag;
  }

  /** In `updated()`: tells screen readers where a column or group moved from the keyboard went. */
  announce(model: TableModel<T, CellContent>): void {
    if (!this.#announceMove) return;
    this.#announceMoved(model, this.#announceMove);
    this.#announceMove = undefined;
  }

  /** Alt+Shift+Arrow on a column or group header: one step toward the start (-1) or the end (1). */
  byKey(unit: OrderUnit, step: 1 | -1): void {
    const model = this.#model();
    // From the latest requested order, so presses can come faster than renders.
    // Positions count the shown columns and groups: hidden columns keep their place.
    const from = model
      .siblingUnits(unit, this.state.value)
      .findIndex((s) => sameUnit(s.unit, unit));
    const at = this.#colIndexOf(model, unit);
    if (from < 0 || at === undefined) return;
    if (!this.#request(unit, from + step)) return;
    // The header node moves, which drops its focus: focus it again once rendered.
    this.#nav.refocus();
    this.#announceMove ??= { unit, from: at };
    this.#host.requestUpdate();
  }

  /** A press on a reorderable column or group header: becomes a drag once the pointer moves. */
  start(down: PointerEvent): void {
    const cell = down
      .composedPath()
      .find(
        (t): t is HTMLElement =>
          t instanceof HTMLElement && t.getAttribute('role') === 'columnheader',
      );
    if (!cell || !canStartReorder(down, cell)) return;
    const model = this.#model();
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
      targetAt: (x) => dropTarget(this.#dropSlots(unit), key, x, directionOf(this.#host)),
      scrollArea: () => (pin === undefined ? this.#scrollArea(scroller) : undefined),
      onStart: () => {
        this.#drag = { key, columns, target: undefined };
        this.#host.requestUpdate();
      },
      onTarget: (target) => {
        this.#drag = { key, columns, target };
        this.#host.requestUpdate();
      },
      onDrop: (target) => {
        this.#drag = undefined;
        if (target && this.#request(unit, target.to)) {
          // The header node moves, which drops its focus: focus it again once rendered.
          if (this.#host.matches(':focus-within')) this.#nav.refocus();
        }
        this.#host.requestUpdate();
      },
      onCancel: () => {
        this.#drag = undefined;
        this.#host.requestUpdate();
      },
    });
  }

  /**
   * Moves a column or group to position `to` among its siblings (the columns and
   * groups of its parent group on its pin side), through the controlled/uncontrolled
   * rules. Starts from the latest requested order, so moves can come faster than
   * renders. `false` if it can't move there.
   */
  #request(unit: OrderUnit, to: number): boolean {
    const old = this.state.value;
    const model = this.#model();
    const moving = model.siblingUnits(unit, old).find((s) => sameUnit(s.unit, unit));
    const next = model.nextMove(unit, to, old);
    const columnId = moving?.columns[0];
    if (!next || columnId === undefined) return false;
    this.#events.change('columnOrder', this.state, next, COLUMN_ORDER_CHANGE, [
      [unitKey(unit), unit.kind === 'group' ? { columnId, groupId: unit.id } : { columnId }],
    ]);
    return true;
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
    const labels = this.#labels();
    if (unit.kind === 'column') {
      const view = model.columns.find((c) => c.id === unit.id);
      if (!view || view.colIndex === move.from) return;
      const name =
        headerText(view.header, { columnId: unit.id, text: true }) ??
        this.#slotText(`[role='columnheader'][data-col="${CSS.escape(unit.id)}"] > slot`);
      announce(
        this.#host.ownerDocument,
        labels.columnMoved({ column: name || unit.id, position: view.colIndex, total }),
      );
      return;
    }
    const key = unitKey(unit);
    const cell = model.headerGroups.flat().find((c) => c.key === key);
    if (!cell || cell.colIndex === move.from) return;
    const name =
      headerText(cell.header, { groupId: unit.id, text: true }) ??
      this.#slotText(`[data-group-key="${CSS.escape(key)}"] slot`);
    announce(
      this.#host.ownerDocument,
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
    const slot = this.#host.renderRoot.querySelector(selector);
    return slot instanceof HTMLSlotElement
      ? slot
          .assignedNodes({ flatten: true })
          .map((n) => n.textContent)
          .join('')
          .trim()
      : '';
  }

  /**
   * The rendered headers of what a column or group moves among (see
   * `siblingUnits`), with their positions there. With `virtualizeColumns`, columns
   * out of view have no header and no slot.
   */
  #dropSlots(unit: OrderUnit): DropSlot[] {
    const slots: DropSlot[] = [];
    this.#model()
      .siblingUnits(unit)
      .forEach((sibling, index) => {
        const id = unitKey(sibling.unit);
        const cell = this.#host.renderRoot.querySelector(
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
    const width = (side: 'start' | 'end') => pinnedWidth(this.#model().columns, side);
    const ltr = directionOf(this.#host) === 1;
    const left = scroller.getBoundingClientRect().left + scroller.clientLeft;
    return {
      left: left + width(ltr ? 'start' : 'end'),
      right: left + scroller.clientWidth - width(ltr ? 'end' : 'start'),
    };
  }
}
