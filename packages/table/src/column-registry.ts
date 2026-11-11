/**
 * Elements watching their `<argus-column>` and `<argus-column-group>` children,
 * by element: tables, and groups (which pass it on to their own parent). Columns
 * and groups call their parent's entry when they connect, disconnect or change,
 * so the table needs no MutationObserver on its own children (which would fire on
 * every light-DOM cell render while scrolling).
 */
const watchers = new WeakMap<Element, () => void>();

/** Calls `onChange` whenever a column or group child of `host` is added, removed, moved or changed. */
export function watchColumns(host: Element, onChange: () => void): void {
  watchers.set(host, onChange);
}

export function unwatchColumns(host: Element): void {
  watchers.delete(host);
}

/** Tells a column's or group's parent that it changed. */
export function notify(parent: Element | null): void {
  if (parent) watchers.get(parent)?.();
}
