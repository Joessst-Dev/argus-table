import { createElement, forwardRef, type ElementType } from 'react';

type Handler = (event: Event) => void;

/** One wrapper per handler, so @lit/react sees the same function on every render. */
const wrappers = new WeakMap<Handler, Handler>();

/**
 * A handler that only runs for the element's own events. The table's events
 * bubble, so those of a table nested in a cell also pass the outer table.
 */
function own(handler: Handler): Handler {
  let wrapper = wrappers.get(handler);
  if (!wrapper) {
    wrapper = (event) => {
      if (event.target === event.currentTarget) handler(event);
    };
    wrappers.set(handler, wrapper);
  }
  return wrapper;
}

/** Wraps a @lit/react component so that its event props only see the element's own events. */
export function ownEvents(
  component: ElementType,
  eventProps: readonly string[],
  displayName: string,
) {
  const wrapped = forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    const next: Record<string, unknown> = { ...props, ref };
    for (const key of eventProps) {
      const handler = next[key];
      if (typeof handler === 'function') next[key] = own(handler as Handler);
    }
    return createElement(component, next);
  });
  wrapped.displayName = displayName;
  return wrapped;
}
