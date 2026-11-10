/**
 * Interactive content a page may put in a header or cell. A press on it belongs
 * to that content: it doesn't sort, start a column drag or select a row. A
 * popover or a dialog (a menu or an editor a plugin opens from a header) counts
 * as a whole, padding included.
 */
export const INTERACTIVE =
  'button,input,select,textarea,a[href],label,[contenteditable],[popover],dialog';

/**
 * Whether an event path reaches interactive content before `stop` (the cell or
 * row the table handles the event for).
 */
export function fromInteractive(path: readonly EventTarget[], stop: Element): boolean {
  for (const target of path) {
    if (target === stop) return false;
    if (target instanceof Element && target.matches(INTERACTIVE)) return true;
  }
  return false;
}
