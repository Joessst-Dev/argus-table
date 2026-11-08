import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { ArgusColumn, unwatchColumns, watchColumns } from '../argus-column.js';
import type { ColumnDef } from '../types.js';

/**
 * Reads the host's `<argus-column>` children into `ColumnDef`s. The columns tell
 * the host when they change (`watchColumns`); the list is rebuilt only then, so
 * `defs` keeps its identity between changes.
 */
export class ColumnChildrenController<T> implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  #defs: readonly ColumnDef<T>[] = [];
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

  /** The children's columns, in document order. */
  get defs(): readonly ColumnDef<T>[] {
    if (this.#dirty) {
      this.#dirty = false;
      this.#defs = [...this.#host.children]
        .filter((c): c is ArgusColumn<T> => c instanceof ArgusColumn)
        .map((c) => c.toColumnDef());
    }
    return this.#defs;
  }
}
