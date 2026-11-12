import {
  ContentChildren,
  Directive,
  ElementRef,
  Injector,
  Input,
  QueryList,
  TemplateRef,
  ViewContainerRef,
  inject,
  type AfterContentInit,
  type EmbeddedViewRef,
  type OnDestroy,
} from '@angular/core';
import type {
  ArgusPlugin,
  ArgusTable,
  CellContent,
  CellContext,
  ColumnDef,
  ColumnGroup,
  ContentRenderer,
  PluginHost,
  RowPin,
} from 'argus-table';

/** What an `argusCell` template gets: the row as `let-row`, and its context. */
export interface ArgusCellContext<T = unknown> {
  $implicit: T;
  row: T;
  /** The value the column's accessor reads. */
  value: unknown;
  rowId: string;
  /** The row's index in the current order; for a pinned row, in its list. */
  index: number;
  columnId: string;
  /** Set for a row from `pinnedRows`: its side. */
  pinned?: RowPin | undefined;
}

/** What an `argusHeader` template gets: the column id. */
export interface ArgusHeaderContext {
  $implicit: string;
  columnId: string;
}

/**
 * A column's cells, as a template inside `<argus-table>`:
 * `<ng-template argusCell="status" let-row let-value="value">…</ng-template>`.
 * `[argusCellOf]="rows"` types `row` with your row type in strict templates.
 */
@Directive({ selector: 'ng-template[argusCell]' })
export class ArgusCellDirective<T = unknown> {
  /** The id of the column whose cells this renders. */
  @Input({ required: true }) argusCell!: string;
  /** Only for typing: the rows, so `let-row` has their type. */
  @Input() argusCellOf?: readonly T[] | null;
  readonly template = inject<TemplateRef<ArgusCellContext<T>>>(TemplateRef);

  /* eslint-disable @typescript-eslint/no-unused-vars -- Angular reads the guard's signature only. */
  static ngTemplateContextGuard<T>(
    _directive: ArgusCellDirective<T>,
    context: unknown,
  ): context is ArgusCellContext<T> {
    return true;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}

/** A column's header, as a template inside `<argus-table>`: `<ng-template argusHeader="total">`. */
@Directive({ selector: 'ng-template[argusHeader]' })
export class ArgusHeaderDirective {
  /** The id of the column whose header this renders. */
  @Input({ required: true }) argusHeader!: string;
  readonly template = inject<TemplateRef<ArgusHeaderContext>>(TemplateRef);

  /* eslint-disable @typescript-eslint/no-unused-vars -- Angular reads the guard's signature only. */
  static ngTemplateContextGuard(
    _directive: ArgusHeaderDirective,
    context: unknown,
  ): context is ArgusHeaderContext {
    return true;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}

/** What an `argusGroupHeader` template gets: the group id. */
export interface ArgusGroupHeaderContext {
  $implicit: string;
  groupId: string;
}

/**
 * A column group's header, as a template inside `<argus-table>`:
 * `<ng-template argusGroupHeader="customer">`. For groups from `columnGroups`
 * and from `<argus-column-group>` children alike.
 */
@Directive({ selector: 'ng-template[argusGroupHeader]' })
export class ArgusGroupHeaderDirective {
  /** The id of the group whose header this renders. */
  @Input({ required: true }) argusGroupHeader!: string;
  readonly template = inject<TemplateRef<ArgusGroupHeaderContext>>(TemplateRef);

  /* eslint-disable @typescript-eslint/no-unused-vars -- Angular reads the guard's signature only. */
  static ngTemplateContextGuard(
    _directive: ArgusGroupHeaderDirective,
    context: unknown,
  ): context is ArgusGroupHeaderContext {
    return true;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}

const TEMPLATE = Symbol('argus-template');

/** A template with its context, as a `cell` or `header` function returns it: see `argusTemplate()`. */
export interface ArgusTemplate {
  readonly [TEMPLATE]: true;
  readonly template: TemplateRef<unknown>;
  readonly context: object;
}

/**
 * Renders a template in a cell or header, from a `cell` or `header` function:
 * `cell: (row) => argusTemplate(this.badge, { $implicit: row })`.
 */
export function argusTemplate<C extends object>(
  template: TemplateRef<C>,
  context: C,
): ArgusTemplate {
  return { [TEMPLATE]: true, template: template, context };
}

const isTemplate = (value: unknown): value is ArgusTemplate =>
  typeof value === 'object' && value !== null && TEMPLATE in value;

/** What a header or cell may return in Angular: a template, or what the table renders itself. */
export type AngularCellContent = CellContent | ArgusTemplate;

/** A column whose `header` and `cell` may return templates (`argusTemplate()`). */
export type AngularColumnDef<T = unknown> = ColumnDef<T, AngularCellContent>;

/** A column group (`columnGroups`) whose `header` may be an Angular template (`argusTemplate()`). */
export type AngularColumnGroup = ColumnGroup<AngularCellContent>;

/**
 * Renders templates into the table's pooled targets, like the CDK's DOM portal
 * outlet: an embedded view in the table component's container, its nodes moved
 * into the target. A pooled cell keeps its view and gets a new context as it shows
 * other rows. Synchronous (`detectChanges()`), so there's nothing to flush.
 */
class TemplateRenderer implements ContentRenderer {
  readonly #views = new Map<
    HTMLElement,
    { view: EmbeddedViewRef<object>; template: TemplateRef<unknown> }
  >();
  readonly #container: ViewContainerRef;
  readonly #injector: Injector;

  constructor(container: ViewContainerRef, injector: Injector) {
    this.#container = container;
    this.#injector = injector;
  }

  render(target: HTMLElement, content: unknown): void {
    if (!isTemplate(content)) {
      this.release(target);
      return;
    }
    const current = this.#views.get(target);
    if (current?.template === content.template) {
      Object.assign(current.view.context, content.context);
      current.view.detectChanges();
      return;
    }
    // A pooled target that shows another column now (`virtualizeColumns`).
    if (current) this.release(target);
    const view = this.#container.createEmbeddedView(
      content.template as TemplateRef<object>,
      { ...content.context },
      { injector: this.#injector },
    );
    for (const node of view.rootNodes as Node[]) target.append(node);
    view.detectChanges();
    this.#views.set(target, { view, template: content.template });
  }

  release(target: HTMLElement): void {
    const current = this.#views.get(target);
    if (!current) return;
    this.#views.delete(target);
    current.view.destroy();
  }

  destroy(): void {
    for (const target of [...this.#views.keys()]) this.release(target);
  }
}

/**
 * What `ArgusTableComponent` adds to the element: it renders templates from
 * `argusCell` / `argusHeader` children and from `cell` / `header` functions
 * (`argusTemplate()`). The templates reach the columns through a plugin that comes
 * first in `plugins`, so `headerMenu()` and `formulas()` wrap what it gives.
 */
@Directive()
export abstract class ArgusTableBase<T = unknown> implements AfterContentInit, OnDestroy {
  /** The `<argus-table>` element. */
  readonly element: ArgusTable<T> = inject<ElementRef<ArgusTable<T>>>(ElementRef).nativeElement;

  @ContentChildren(ArgusCellDirective) protected cellTemplates?: QueryList<ArgusCellDirective>;
  @ContentChildren(ArgusHeaderDirective)
  protected headerTemplates?: QueryList<ArgusHeaderDirective>;
  @ContentChildren(ArgusGroupHeaderDirective)
  protected groupTemplates?: QueryList<ArgusGroupHeaderDirective>;

  readonly #renderer = new TemplateRenderer(inject(ViewContainerRef), inject(Injector));
  #host: PluginHost<T> | undefined;
  readonly #subscriptions: { unsubscribe(): void }[] = [];

  /** Turns the `argusCell` / `argusHeader` templates into the columns' `cell` and `header`. */
  readonly #templates: ArgusPlugin<T> = {
    name: 'angular-templates',
    connect: (host) => {
      this.#host = host;
      return () => {
        this.#host = undefined;
      };
    },
    columns: (defs) => defs.map((def) => this.#withTemplates(def)),
    columnGroups: (groups) => groups.map((group) => this.#withGroupTemplate(group)),
  };

  constructor() {
    this.element.contentRenderer = this.#renderer;
    this.setPlugins(undefined);
  }

  /** Sets the element's `plugins`: the template plugin first, then the user's. */
  protected setPlugins(value: readonly ArgusPlugin<T>[] | null | undefined): void {
    this.element.plugins = [this.#templates, ...(value ?? [])];
  }

  ngAfterContentInit(): void {
    for (const list of [this.cellTemplates, this.headerTemplates, this.groupTemplates]) {
      const subscription = list?.changes.subscribe(() => {
        this.#host?.invalidateColumns();
      });
      if (subscription) this.#subscriptions.push(subscription);
    }
    this.#host?.invalidateColumns();
  }

  ngOnDestroy(): void {
    for (const subscription of this.#subscriptions) subscription.unsubscribe();
    this.#renderer.destroy();
  }

  /** A group, and the groups inside it, with the header from its `argusGroupHeader` template. */
  #withGroupTemplate(group: ColumnGroup<unknown>): ColumnGroup<unknown> {
    const id = group.id;
    const columns = group.columns.map((c) =>
      typeof c === 'string' ? c : this.#withGroupTemplate(c),
    );
    const changed = columns.some((c, i) => c !== group.columns[i]);
    const template = this.groupTemplates?.find((t) => t.argusGroupHeader === id);
    if (!template) return changed ? { ...group, columns } : group;
    return {
      ...group,
      columns,
      header: () => argusTemplate(template.template, { $implicit: id, groupId: id }),
    };
  }

  #withTemplates(def: ColumnDef<T, unknown>): ColumnDef<T, unknown> {
    const id = def.id;
    const cell = this.cellTemplates?.find((t) => t.argusCell === id);
    const header = this.headerTemplates?.find((t) => t.argusHeader === id);
    if (!cell && !header) return def;
    return {
      ...def,
      ...(cell && {
        cell: (row: T, context: CellContext<T>) =>
          argusTemplate(cell.template, {
            $implicit: row,
            row,
            value: context.value,
            rowId: context.rowId,
            index: context.index,
            columnId: context.columnId,
            pinned: context.pinned,
          }),
      }),
      ...(header && {
        header: () => argusTemplate(header.template, { $implicit: id, columnId: id }),
      }),
    };
  }
}
