import {
  createElement,
  forwardRef,
  useLayoutEffect,
  useMemo,
  useState,
  type ElementType,
  type ReactNode,
  type ReactPortal,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import type { CellContent, ColumnDef, ColumnGroup, ContentRenderer } from 'argus-table';

/** What a header or cell may return in React: a React node, or what the table renders itself. */
export type ReactCellContent = CellContent | ReactNode;

/** A column whose `header` and `cell` may return React nodes (JSX). */
export type ReactColumnDef<T = unknown> = ColumnDef<T, ReactCellContent>;

/** A column group (`columnGroups`) whose `header` may be React content. */
export type ReactColumnGroup = ColumnGroup<ReactCellContent>;

interface Entry {
  key: string;
  node: ReactNode;
}

/**
 * The React content of one table: what each target shows. The table calls `render`
 * and `release` while it renders its cells, then `flush` once, which commits every
 * portal synchronously, before the table measures its content or the page paints.
 */
class PortalStore {
  readonly entries = new Map<HTMLElement, Entry>();
  #next = 0;
  #changed = false;
  /** Re-renders `<Portals>`; set while it is mounted. */
  listener: (() => void) | undefined;

  readonly renderer: ContentRenderer = {
    render: (target, content) => {
      const entry = this.entries.get(target);
      if (entry) entry.node = content as ReactNode;
      else this.entries.set(target, { key: String(this.#next++), node: content as ReactNode });
      this.#changed = true;
    },
    release: (target) => {
      if (this.entries.delete(target)) this.#changed = true;
    },
    flush: () => {
      this.commit();
    },
  };

  commit(): void {
    const listener = this.listener;
    if (!this.#changed || !listener) return;
    this.#changed = false;
    flushSync(listener);
  }
}

/**
 * The portals of a table's cells and headers. In the table's React tree, so cells
 * get the app's context (themes, routers, stores) like any other child.
 */
function Portals({ store }: { store: PortalStore }): ReactPortal[] {
  const [, setTick] = useState(0);
  useLayoutEffect(() => {
    store.listener = () => {
      setTick((tick) => tick + 1);
    };
    // Content the table rendered before this mounted.
    store.commit();
    return () => {
      store.listener = undefined;
    };
  }, [store]);
  return [...store.entries].map(([target, { key, node }]) => createPortal(node, target, key));
}

/**
 * Wraps the table component: sets the table's `contentRenderer` to one that renders
 * React nodes from `header` and `cell` through portals, and renders the portals.
 */
export function withContent(component: ElementType, displayName: string) {
  const wrapped = forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    const store = useMemo(() => new PortalStore(), []);
    return createElement(
      component,
      { ...props, ref, contentRenderer: store.renderer },
      props.children as ReactNode,
      createElement(Portals, { store }),
    );
  });
  wrapped.displayName = displayName;
  return wrapped;
}
