/**
 * A popover's `focusin` handler: scrolls what took focus into view, for a menu or
 * filter form capped to the room beside its button. WebKit's `focus()` doesn't
 * scroll it there.
 */
export function revealFocused(event: FocusEvent): void {
  (event.target as Element).scrollIntoView({ block: 'nearest' });
}
