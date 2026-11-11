import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { ArgusColumn } from '../argus-column.js';
import { ArgusColumnGroup } from '../argus-column-group.js';
import { unwatchColumns, watchColumns } from '../column-registry.js';
import type { ColumnDef, ColumnGroup } from '../types.js';

const NO_GROUPS: readonly ColumnGroup[] = [];

/** The `<argus-column>`s among an element's children and in its groups, in document order. */
function columnsIn<T>(parent: Element): ArgusColumn<T>[] {
  return [...parent.children].flatMap((c) => {
    if (c instanceof ArgusColumn) return [c as ArgusColumn<T>];
    if (c instanceof ArgusColumnGroup) return columnsIn<T>(c);
    return [];
  });
}

/**
 * Reads the host's `<argus-column>` children, and those in its
 * `<argus-column-group>` children, into `ColumnDef`s, and the groups into
 * `ColumnGroup`s. Columns and groups tell the host when they change
 * (`watchColumns`); the lists are rebuilt only then, so they keep their identity
 * between changes.
 */
export class ColumnChildrenController<T> implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  #defs: readonly ColumnDef<T>[] = [];
  #groups: readonly ColumnGroup[] = NO_GROUPS;
  #dirty = true;

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this.#host = host;
    host.addController(this);
  }

  hostConnected(): void {
    this.#dirty = true;
    watchColumns(this.#host, () => {
      this.#dirty = true;
      this.#host.requestUpdate();
    });
  }

  hostDisconnected(): void {
    unwatchColumns(this.#host);
  }

  /** Whether the host has any `<argus-column>` child. */
  get present(): boolean {
    return this.defs.length > 0;
  }

  /** The children's columns, in document order, those in groups included. */
  get defs(): readonly ColumnDef<T>[] {
    this.#read();
    return this.#defs;
  }

  /** The `<argus-column-group>` children's groups, in document order. */
  get groups(): readonly ColumnGroup[] {
    this.#read();
    return this.#groups;
  }

  #read(): void {
    if (!this.#dirty) return;
    this.#dirty = false;
    this.#defs = columnsIn<T>(this.#host).map((c) => c.toColumnDef());
    const groups = [...this.#host.children]
      .filter((c): c is ArgusColumnGroup => c instanceof ArgusColumnGroup)
      .map((c) => c.toColumnGroup());
    this.#groups = groups.length ? groups : NO_GROUPS;
  }
}
