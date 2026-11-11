import { INTERACTIVE } from '../interactive.js';

/** Where a dragged column or group would land: its new position and the header that shows the drop line. */
export interface DropTarget {
  /** Position among its siblings after the move, 0-based. */
  to: number;
  /** The slot (a column or group header) that draws the drop line. */
  id: string;
  /** The edge of that header the line is on, in logical terms. */
  edge: 'start' | 'end';
}

/** A header of what the dragged column or group moves among, in visual order. */
export interface DropSlot {
  id: string;
  /** Its position among them, 0-based. */
  index: number;
  rect: { left: number; right: number };
}

/**
 * The drop target for a pointer at `x`: the gap between headers nearest to it,
 * decided by each header's midpoint. `undefined` where the column would stay
 * put. `direction` is 1 in LTR and -1 in RTL, where the group runs right to left.
 * The slots needn't be next to each other in the order: with
 * `virtualizeColumns`, headers out of view aren't rendered.
 */
export function dropTarget(
  slots: readonly DropSlot[],
  draggedId: string,
  x: number,
  direction: 1 | -1,
): DropTarget | undefined {
  const dragged = slots.find((s) => s.id === draggedId);
  const last = slots.at(-1);
  if (!dragged || !last) return undefined;
  // The gap before the first header whose middle is past the pointer, in reading order.
  const at = slots.find((s) => (x - (s.rect.left + s.rect.right) / 2) * direction < 0);
  if (!at) {
    // Past the last header: after it.
    const to = last.index >= dragged.index ? last.index : last.index + 1;
    return to === dragged.index ? undefined : { to, id: last.id, edge: 'end' };
  }
  // Taking the column out shifts the ones after it one place back.
  const to = at.index > dragged.index ? at.index - 1 : at.index;
  return to === dragged.index ? undefined : { to, id: at.id, edge: 'start' };
}

export interface ReorderDragOptions {
  /** The scroll container: it scrolls while the pointer is near its edges. */
  scroller: HTMLElement;
  /** The drop target for a pointer at `x` (client coordinates). */
  targetAt: (x: number) => DropTarget | undefined;
  /**
   * Where the dragged column's group is visible, in client x, if it can scroll
   * (the scrolling columns). Near these edges the scroller scrolls with the drag.
   */
  scrollArea: () => { left: number; right: number } | undefined;
  onStart: () => void;
  /** The target changed (`undefined`: the column would stay put). */
  onTarget: (target: DropTarget | undefined) => void;
  /** The pointer was released over a target, or `undefined` when it would stay put. */
  onDrop: (target: DropTarget | undefined) => void;
  /** Escape, a cancelled pointer, or a release without a drag. */
  onCancel: () => void;
}

/** Movement before a press becomes a drag, so a click still sorts. */
const THRESHOLD = 4;
/** Width of the band at the scroll area's edges that scrolls, and the top speed there. */
const EDGE = 40;
const MAX_SPEED = 16;

/**
 * Whether a press on a header may start a reorder drag: the primary button of a
 * mouse or pen (a touch pans the table instead), not on a resize handle, and not
 * in interactive content slotted into the header.
 */
export function canStartReorder(down: PointerEvent, cell: HTMLElement): boolean {
  if (down.button !== 0 || down.pointerType === 'touch') return false;
  for (const target of down.composedPath()) {
    if (target === cell) return true;
    if (!(target instanceof Element)) continue;
    if (target instanceof HTMLElement && target.dataset.resizeCol !== undefined) return false;
    if (target.matches(INTERACTIVE)) return false;
  }
  return false;
}

/**
 * One pointer drag of a column header. It becomes a drag after a few pixels of
 * movement; until then the press is a click. While dragging, the pointer is
 * captured by the header, the target follows the pointer once per frame, and the
 * scroll area scrolls near its edges. Escape cancels. The click that ends a drag
 * is swallowed, so it neither sorts nor counts as a cell click.
 */
export function startReorderDrag(
  cell: HTMLElement,
  down: PointerEvent,
  options: ReorderDragOptions,
): void {
  const view = cell.ownerDocument.defaultView ?? window;
  const startX = down.clientX;
  const startY = down.clientY;
  let x = startX;
  let dragging = false;
  let frame = 0;
  let target: DropTarget | undefined;

  const same = (a: DropTarget | undefined, b: DropTarget | undefined) =>
    a?.to === b?.to && a?.id === b?.id && a?.edge === b?.edge;

  const tick = () => {
    frame = 0;
    if (!dragging) return;
    const area = options.scrollArea();
    if (area) {
      const speed =
        x < area.left + EDGE
          ? -Math.min(1, (area.left + EDGE - x) / EDGE)
          : x > area.right - EDGE
            ? Math.min(1, (x - (area.right - EDGE)) / EDGE)
            : 0;
      // A visual delta: scrollLeft runs the same way in LTR and RTL.
      if (speed !== 0) options.scroller.scrollLeft += Math.round(speed * MAX_SPEED);
      // Targets past the visible part would be hidden under pinned columns.
      x = Math.min(Math.max(x, area.left), area.right);
    }
    const next = options.targetAt(x);
    if (!same(next, target)) {
      target = next;
      options.onTarget(target);
    }
    // Keep running while dragging: the view may still be scrolling.
    frame = view.requestAnimationFrame(tick);
  };

  const listeners = new AbortController();
  const cleanup = (event?: PointerEvent) => {
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0;
    listeners.abort();
    if (event && cell.hasPointerCapture(event.pointerId)) {
      cell.releasePointerCapture(event.pointerId);
    }
  };

  const move = (event: PointerEvent) => {
    if (event.pointerId !== down.pointerId) return;
    x = event.clientX;
    if (!dragging) {
      if (Math.hypot(x - startX, event.clientY - startY) < THRESHOLD) return;
      dragging = true;
      try {
        cell.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointers can't be captured; the window listeners still see the moves.
      }
      options.onStart();
    }
    // No text selection while dragging.
    event.preventDefault();
    frame ||= view.requestAnimationFrame(tick);
  };

  const up = (event: PointerEvent) => {
    if (event.pointerId !== down.pointerId) return;
    cleanup(event);
    if (!dragging) return;
    x = event.clientX;
    const area = options.scrollArea();
    if (area) x = Math.min(Math.max(x, area.left), area.right);
    swallowClick(view);
    options.onDrop(options.targetAt(x));
  };

  const cancel = (event: PointerEvent) => {
    if (event.pointerId !== down.pointerId) return;
    cleanup(event);
    if (dragging) options.onCancel();
  };

  const key = (event: KeyboardEvent) => {
    if (!dragging || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    cleanup();
    // The pointer is still down: its release must not count as a click.
    swallowClick(view, false);
    options.onCancel();
  };

  const listen = { capture: true, signal: listeners.signal };
  view.addEventListener('pointermove', move, listen);
  view.addEventListener('pointerup', up, listen);
  view.addEventListener('pointercancel', cancel, listen);
  view.addEventListener('keydown', key, listen);
}

/**
 * Stops the click that follows the release of a drag, if one comes. It comes in
 * the same task as the release, so the guard goes once that task is over. After
 * Escape the pointer is still down (`released: false`): the guard waits for its release.
 */
function swallowClick(view: Window, released = true): void {
  const stop = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const remove = () => {
    setTimeout(() => {
      view.removeEventListener('click', stop, { capture: true });
    });
  };
  view.addEventListener('click', stop, { capture: true, once: true });
  if (released) remove();
  else view.addEventListener('pointerup', remove, { capture: true, once: true });
}
