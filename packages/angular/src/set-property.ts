// Registers the elements, and writes inputs to them.
import 'argus-table';

/**
 * Sets an element property from an input. A string for a property that has an
 * attribute goes to the attribute instead, so the element converts it as it
 * would in HTML: Angular passes `<argus-column width="90">` to the `width`
 * input as `'90'`, which the element reads as 90 px. `null` (say from the
 * `async` pipe) means `undefined`, which hands state back to the element.
 */
export function setProperty(
  element: HTMLElement,
  property: string,
  attribute: string | undefined,
  value: unknown,
): void {
  if (attribute !== undefined) {
    if (typeof value === 'string') {
      element.setAttribute(attribute, value);
      return;
    }
    // A value set as a string earlier stays in the attribute; clear it so the
    // attribute and the property agree.
    if (value == null) element.removeAttribute(attribute);
  }
  (element as unknown as Record<string, unknown>)[property] = value ?? undefined;
}
