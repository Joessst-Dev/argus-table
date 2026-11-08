import { html, ReactiveElement, type ComplexAttributeConverter } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { templateContent } from 'lit/directives/template-content.js';
import type {
  CellContent,
  CellContext,
  ColumnAlign,
  ColumnDef,
  ColumnPin,
  ColumnWidth,
} from './types.js';

/**
 * Tables watching their `<argus-column>` children, by table element. Columns
 * call their parent's entry when they connect, disconnect or change, so the
 * table needs no MutationObserver on its own children (which would fire on
 * every light-DOM cell render while scrolling).
 */
const watchers = new WeakMap<Element, () => void>();

/** Calls `onChange` whenever an `<argus-column>` child of `host` is added, removed, moved or changed. */
export function watchColumns(host: Element, onChange: () => void): void {
  watchers.set(host, onChange);
}

export function unwatchColumns(host: Element): void {
  watchers.delete(host);
}

function notify(parent: Element | null): void {
  if (parent) watchers.get(parent)?.();
}

/** `width` attribute: `"90"` or `"90px"` → 90, `"auto"`, `"2fr"` → `{ flex: 2 }`. */
const widthConverter: ComplexAttributeConverter<ColumnWidth | undefined> = {
  fromAttribute(value) {
    if (value === null) return undefined;
    const text = value.trim().toLowerCase();
    if (text === 'auto') return 'auto';
    const match = /^(\d*\.?\d+)(px|fr)?$/.exec(text);
    if (!match) return undefined;
    const n = Number(match[1]);
    return match[2] === 'fr' ? { flex: n } : n;
  },
};

/**
 * Boolean attribute with a default that may be `true`: absent → unset (the
 * default applies), `"false"` → `false`, anything else → `true`.
 */
const flagConverter: ComplexAttributeConverter<boolean | undefined> = {
  fromAttribute(value) {
    return value === null ? undefined : value.trim().toLowerCase() !== 'false';
  },
};

/**
 * One column of the parent `<argus-table>`, written as markup instead of an entry in
 * its `columns` property. It is data only and renders nothing.
 *
 * Only direct children of the table count, in document order. A non-empty `columns`
 * property wins over the children. Adding, removing, moving or changing a column
 * updates the table; sizes, order and sorting are kept by `column-id`.
 *
 * A `<template>` child is the content of every cell in the column (static: the same
 * for each row). Set the `cell` property for content that depends on the row.
 *
 * @summary Declarative column of an `<argus-table>`.
 */
@customElement('argus-column')
export class ArgusColumn<T = unknown> extends ReactiveElement {
  /** Stable key, used in state objects, events and persistence. Must be unique within the table. */
  @property({ attribute: 'column-id' })
  columnId = '';

  /** Header content: text as an attribute; a Lit template, a node or a function as a property. */
  @property()
  header?: CellContent | (() => CellContent);

  /**
   * How to read the cell value: a property path such as `customer.name`, or (as a
   * property) a function of the row and its index.
   */
  @property()
  accessor?: string | ((row: T, index: number) => unknown);

  /** Cell content from the row: `(row, context) => content`. Property only; wins over a `<template>` child. */
  @property({ attribute: false })
  cell?: (row: T, context: CellContext<T>) => CellContent;

  /** Width: `90` (px), `auto` to fit the content, or `2fr` for a share of the free space. Default: 150 px. */
  @property({ converter: widthConverter })
  width?: ColumnWidth;

  /** Lower bound for resizing and for flex columns, in px. Default: 40. */
  @property({ attribute: 'min-width', type: Number })
  minWidth?: number;

  /** Upper bound for resizing, in px. Default: no limit. */
  @property({ attribute: 'max-width', type: Number })
  maxWidth?: number;

  /** Pins the column to the `start` or `end` side. */
  @property()
  pin?: ColumnPin;

  /** Text alignment: `start`, `center` or `end`. Default: `start`. */
  @property()
  align?: ColumnAlign;

  /** Whether the header can be clicked to sort. Default: `false`. */
  @property({ converter: flagConverter })
  sortable?: boolean;

  /** Whether the column can be resized. Default: `true`; `resizable="false"` turns it off. */
  @property({ converter: flagConverter })
  resizable?: boolean;

  /** Whether the column can be moved. Default: `true`; `reorderable="false"` turns it off. */
  @property({ converter: flagConverter })
  reorderable?: boolean;

  #parent: Element | null = null;
  #def: ColumnDef<T> | undefined;
  readonly #children = new MutationObserver(() => {
    this.#def = undefined;
    this.requestUpdate();
  });

  /** Data only: no shadow root, nothing rendered. */
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#children.observe(this, { childList: true });
    this.#parent = this.parentElement;
    notify(this.#parent);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#children.disconnect();
    const parent = this.#parent;
    this.#parent = null;
    notify(parent);
  }

  /**
   * The column as the table reads it. Unset fields stay `undefined`, which the
   * table reads as its defaults. An unknown `pin` is ignored and an unknown
   * `align` falls back to `start`.
   */
  toColumnDef(): ColumnDef<T> {
    if (this.#def) return this.#def;
    const template = [...this.children].find((c) => c instanceof HTMLTemplateElement);
    return (this.#def = {
      id: this.columnId,
      header: this.header,
      accessor: this.accessor,
      cell: this.cell ?? (template && (() => html`${templateContent(template)}`)),
      width: this.width,
      minWidth: this.minWidth,
      maxWidth: this.maxWidth,
      pin: this.pin,
      align: this.align,
      sortable: this.sortable,
      resizable: this.resizable,
      reorderable: this.reorderable,
    });
  }

  protected override willUpdate(): void {
    this.#def = undefined;
  }

  protected override updated(): void {
    notify(this.#parent);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'argus-column': ArgusColumn;
  }
}
