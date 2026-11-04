/**
 * One pointer drag on a resize handle. The pointer is captured, so the drag keeps
 * working outside the handle, and moves are batched to one `onWidth` call per
 * animation frame (TanStack's `onChange` mode: the width updates while dragging).
 *
 * `direction` is 1 in LTR and -1 in RTL: the handle sits on the inline-end edge,
 * so moving toward the inline end always grows the column.
 */
export function startResizeDrag(
  handle: HTMLElement,
  down: PointerEvent,
  startWidth: number,
  direction: 1 | -1,
  onWidth: (width: number) => void,
): void {
  const startX = down.clientX;
  let frame = 0;
  let pending: number | undefined;

  const flush = () => {
    frame = 0;
    if (pending !== undefined) onWidth(pending);
    pending = undefined;
  };
  const move = (event: PointerEvent) => {
    pending = startWidth + (event.clientX - startX) * direction;
    frame ||= requestAnimationFrame(flush);
  };
  const end = (event: PointerEvent) => {
    if (event.type === 'pointerup') move(event);
    if (frame) cancelAnimationFrame(frame);
    flush();
    handle.removeAttribute('data-active');
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  };

  down.preventDefault();
  try {
    handle.setPointerCapture(down.pointerId);
  } catch {
    // Synthetic or already released pointers can't be captured; moves on the handle still work.
  }
  handle.setAttribute('data-active', '');
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}
