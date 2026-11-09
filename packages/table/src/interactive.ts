/**
 * Interactive content a page may put in a header or cell. A press on it belongs
 * to that content: it neither starts a column drag nor selects a row.
 */
export const INTERACTIVE = 'button,input,select,textarea,a[href],label,[contenteditable]';

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
