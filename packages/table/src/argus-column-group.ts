import { ReactiveElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ArgusColumn, flagConverter } from './argus-column.js';
import { notify, unwatchColumns, watchColumns } from './column-registry.js';
import type { CellContent, ColumnGroup } from './types.js';

/**
 * A header over the `<argus-column>` children it wraps, written as markup instead
 * of an entry in the table's `columnGroups` property. Groups nest: a group inside
 * a group adds a header row. It is data only and renders nothing.
 *
 * Only direct children of the table or of another group count. A non-empty
 * `columnGroups` property wins over the children, and a non-empty `columns`
 * property turns all column and group children off.
 *
 * @summary Declarative column group of an `<argus-table>`.
 */
@customElement('argus-column-group')
export class ArgusColumnGroup extends ReactiveElement {
  /** Stable key. Must be unique among the table's groups; it may equal a column id. */
  @property({ attribute: 'group-id' })
  groupId = '';

  /** Header content: text as an attribute; a Lit template, a node or a function as a property. Default: the id. */
  @property()
  header?: CellContent | (() => CellContent);

  /** Whether the group can be moved as a whole. Default: `true`; `reorderable="false"` turns it off. */
  @property({ converter: flagConverter })
  reorderable?: boolean;

  #parent: Element | null = null;
  #group: ColumnGroup | undefined;

  /** Data only: no shadow root, nothing rendered. */
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Columns and groups inside tell this group, which tells its own parent.
    watchColumns(this, () => {
      this.#group = undefined;
      notify(this.#parent);
    });
    this.#parent = this.parentElement;
    notify(this.#parent);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    unwatchColumns(this);
    const parent = this.#parent;
    this.#parent = null;
    notify(parent);
  }

  /** The group as the table reads it, with its column and group children in document order. */
  toColumnGroup(): ColumnGroup {
    return (this.#group ??= {
      id: this.groupId,
      header: this.header,
      reorderable: this.reorderable,
      columns: [...this.children].flatMap((c): (string | ColumnGroup)[] => {
        if (c instanceof ArgusColumn) return [c.columnId];
        if (c instanceof ArgusColumnGroup) return [c.toColumnGroup()];
        return [];
      }),
    });
  }

  protected override willUpdate(): void {
    this.#group = undefined;
  }

  protected override updated(): void {
    notify(this.#parent);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'argus-column-group': ArgusColumnGroup;
  }
}
