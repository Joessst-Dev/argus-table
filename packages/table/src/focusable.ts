/** What the keyboard can reach: controls, links, editable content and explicit tab stops. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * The first element in `roots` (in document order, through open shadow roots)
 * that the keyboard can focus: where Enter or F2 on a detail panel moves focus.
 * A nested `<argus-table>` is reached through its shadow root, at its tab stop.
 */
export function firstFocusable(roots: Iterable<Element>): HTMLElement | undefined {
  for (const root of roots) {
    const found = visit(root);
    if (found) return found;
  }
  return undefined;
}

function visit(element: Element): HTMLElement | undefined {
  if (element.closest('[hidden], [inert]')) return undefined;
  if (element instanceof HTMLElement && element.matches(FOCUSABLE)) return element;
  if (element.shadowRoot) {
    const inside = firstFocusable(element.shadowRoot.children);
    if (inside) return inside;
  }
  return firstFocusable(element.children);
}
