---
name: lit3
description: How to write Lit 3 web components the way argus-table does. Covers LitElement and its update lifecycle, reactive properties and attributes, TypeScript decorators, templates and directives, shadow DOM styles with CSS tokens and ::part() names, slotted light-DOM content, reactive controllers (including those around TanStack Table and Virtual), typed composed CustomEvents, ARIA on custom elements, JSDoc for the Custom Elements Manifest, and testing with Vitest browser mode. Use it whenever you create, change, review or debug a custom element, a Lit template, a reactive controller or component styles in this repo (packages/table, argus-table.ts, argus-column.ts, controllers/, render/, styles/), even when the request doesn't say "Lit", for example "add a resize handle", "expose a part for pinned cells", "why does the header re-render on scroll" or "fire an event when sorting changes".
---

# Lit 3 components in argus-table

argus-table is a framework-agnostic data table built as Lit 3 custom elements (`<argus-table>`, `<argus-column>`) around TanStack Table and TanStack Virtual. Its public API (properties, attributes, events, CSS tokens, part names, slots) is what users depend on, and part and token names freeze at 1.0. Treat every public name as a promise: pick it on purpose, document it, and don't rename it casually.

The plan in `docs/plan/` is the source of truth for names and behaviour. Before adding public surface, check `docs/plan/plan/07-public-api.md` (properties, events, parts, tokens), `06-styling-and-theming.md`, `08-accessibility.md` and `docs/plan/code-architecture/`. When this skill and the plan disagree, follow the plan and mention the conflict.

## Public names: reuse first, propose the rest

Every property, attribute, event, part, token and slot that ships is something themes, wrappers and apps code against. After 1.0 a rename is a breaking change. So:

- **Reuse the planned names**, even when a more specific one is tempting. Body cells in a pinned column are `cell cell-pinned`, and the edge one adds `cell-pinned-edge`. That's the whole set: don't add `cell-pinned-left` or `cell-pinned-start` because one side might need different styling. Themes can tell the sides apart through the cell's position or a private `data-` attribute styled internally.
- **Keep what a planned name means.** A token named `--argus-pinned-shadow` takes a `box-shadow` value, because that's what its name promises and what themes will pass in. If your implementation wants something else (a gradient, a background image), keep the public token a box-shadow and translate internally, or put the extra knob in a private `--_` property.
- **When something new is truly needed**, add as few names as possible and list each one under a "Proposed public names" heading in your summary, with a one-line reason, so a human approves it before it reaches the plan. Don't silently add names in code.
- **Private names are free.** `--_row-surface`, `data-pin="start"` and internal classes can change at any time, so use them for implementation details.

## Build what was asked

Write the smallest change that does the task well within this architecture. If you notice a follow-up the task will eventually need (a measuring controller, multi-column sort, header pinning), describe it under "Follow-ups" in your summary rather than building it now. Unrequested infrastructure is code the human has to review, test and maintain before the design for it has been discussed.

## How the element is organised

The element is thin. Work lives in **reactive controllers**, and logic with no DOM lives in `@argus-table/core`:

| Where | What goes there | Tested with |
|---|---|---|
| `packages/core/src/` | Column resolution, paging, row cache, controlled/uncontrolled state, the TanStack adapter. No Lit, no DOM | plain Vitest |
| `packages/table/src/controllers/` | `ColumnController`, `DataController`, `TableController`, `VirtualController`, `InteractionController` | Vitest browser mode |
| `packages/table/src/render/` | Template functions: `header.ts`, `body.ts`, `pinned-rows.ts`, `skeleton.ts` | through the element |
| `packages/table/src/argus-table.ts` | Creates controllers, declares public properties, calls render functions | Vitest browser mode |
| `packages/table/src/events.ts` | Event names and typed `detail` objects | — |
| `packages/table/src/styles/` | `base.ts`: `@layer argus-base`, default token values | visual tests |

When new behaviour doesn't fit an existing controller, ask whether it is a new concern (a new controller) or pure logic (core). Avoid growing `argus-table.ts`. TanStack types never appear in the public API; they stay behind core's adapter (`core/table/create-table.ts`), because TanStack v9 may still change.

## TypeScript and decorators

Use **experimental decorators** with `useDefineForClassFields: false`:

```jsonc
// tsconfig (compilerOptions)
"experimentalDecorators": true,
"useDefineForClassFields": false,
"target": "ES2022",
"strict": true
```

Lit 3 also supports standard (TC39) decorators, but those need the `accessor` keyword on every decorated field and produce more code. Experimental decorators are what the Lit docs, the Custom Elements Manifest analyzer and most examples assume. Use one style across the whole repo; mixing them breaks the build. So write `@property() overscan = 6;` without `accessor`, unless the repo's tsconfig already uses standard decorators. In that case, follow it everywhere.

The reason for `useDefineForClassFields: false`: with `true`, a class field such as `overscan = 6` is defined on the instance with `Object.defineProperty`. That shadows the reactive accessor Lit put on the prototype, so setting the property never triggers an update, and nothing warns you.

## Element skeleton

```ts
import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { baseStyles } from './styles/base.js';

/**
 * A virtualized data table.
 *
 * @summary Data table with pinned rows and columns and infinite loading.
 * @fires argus-sort-change - Sorting changed. `detail: { sorting }`
 * @csspart cell - Every body cell.
 * @cssprop [--argus-row-height=40px] - Height of one body row.
 * @slot - `<argus-column>` children (data only, not rendered).
 */
@customElement('argus-table')
export class ArgusTable<T = unknown> extends LitElement {
  static override styles = baseStyles;

  /** Row height in px, or `'auto'` to measure rows. Unset: the density decides. */
  @property({ attribute: 'row-height', converter: rowHeightConverter })
  rowHeight?: number | 'auto';

  /** Column definitions. Property only: functions can't be attributes. */
  @property({ attribute: false })
  columns: ColumnDef<T>[] = [];

  @state() private activeCell: CellId | null = null;

  @query('[part~="table"]') private scroller!: HTMLElement;

  protected override willUpdate(changed: PropertyValues<this>) {
    // derive state here, before render
  }

  protected override render() {
    return html`…`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'argus-table': ArgusTable;
  }
}
```

Points that matter:

- **Import paths end in `.js`** (`'lit/decorators.js'`, `'./styles/base.js'`). Lit's package exports require it, and the repo builds ESM only.
- **Properties versus attributes.** Rich data (`columns`, `data`, `dataSource`, `getRowId`, `sorting`) uses `attribute: false`. Simple flags and scalars get a kebab-case attribute (`row-height`, `density`, `overscan`). Lit's default attribute name is the lowercased property name (`rowheight`), so name it explicitly.
- **Use `reflect: true` sparingly.** Reflect only what CSS or tests need to select on (for example `density`, so `:host([density="compact"])` works). Every reflection writes to the DOM on each change.
- **Public properties versus `@state`.** Users set public properties; `@state()` is internal reactive state. Mark internals `private` so they stay out of the manifest and the docs.
- **Registration.** `@customElement` calls `customElements.define`, which throws if the tag is already defined. That happens when two copies of the package load, and it should be loud rather than silently ignored. Register only in the module that defines the class, and keep side-effect-free entry points (types, `core`) separate.
- **`HTMLElementTagNameMap`** gives `document.querySelector('argus-table')` the right type. Add an entry for every element.

## The update lifecycle: what goes where

Lit batches all property changes in a microtask into **one** update. In order:

| Hook | Use it for | Avoid |
|---|---|---|
| `constructor` | Create controllers (`new DataController(this)`), set defaults | Touching attributes, children or the DOM |
| `connectedCallback` | Global listeners and observers (`ResizeObserver`, the `MutationObserver` on `<argus-column>` children). Call `super` first | Work that `disconnectedCallback` doesn't undo |
| `willUpdate(changed)` | Derive state from properties: resolve columns, rebuild the row model, compute grid templates. Changes here don't cause another update | DOM reads |
| `render()` | Return a template. Pure: read state, describe DOM | Setting properties, firing events, measuring |
| `firstUpdated` | One-time DOM setup that needs the rendered shadow root (the scroll element for the virtualizer) | — |
| `updated(changed)` | Measuring (row heights, auto widths); firing `argus-*` events after state settled | Setting reactive properties unconditionally |
| `disconnectedCallback` | Remove listeners, disconnect observers, abort requests. Call `super` | — |

Rules of thumb:

- **Derive in `willUpdate`, not in `render`.** Gate expensive work on `changed.has('columns')` and similar checks, so a scroll that only moves the virtual range doesn't rebuild columns or the row model. The render-cycle doc requires this: a pure scroll re-runs only the virtualizer and render.
- **Setting a reactive property in `updated()` schedules another update.** Lit's dev build warns about this (`change-in-update`). Sometimes it is right: after measuring, sizes changed, so render once more. The plan allows **one** extra pass, then stops, so auto row heights and auto widths can't loop. Guard it explicitly, for example with a `measuredForRange` key or a pass counter reset in `willUpdate`.
- **`await el.updateComplete`** before reading the DOM after changing properties, in tests and in methods like `scrollToRow`.
- **Never fire events from `render()`.** Lit may render without the DOM being in its final state, and listeners running inside `render` can re-enter the update.

## Templates

```ts
html`
  <div part="row ${rowParts}" role="row" aria-rowindex=${index + 1}
       style=${styleMap({ transform: `translateY(${start}px)` })}
       @click=${this.onRowClick}>
    ${repeat(cells, (c) => c.column.id, (c) => this.renderCell(c))}
  </div>
`;
```

- Binding kinds: `attr=${v}` (string attribute), `.prop=${v}` (property, for objects and arrays), `?hidden=${bool}` (boolean attribute), `@event=${fn}` (listener, with `this` bound to the host automatically).
- Use `nothing` to render nothing or to remove an attribute (`aria-sort=${sorted ? dir : nothing}`). An empty string is still an attribute.
- **Key every virtualized list with `repeat(items, key, template)`** using the row id (`getRowId`) or the column id. Without keys, Lit reuses DOM by position. Then focus, measured heights and slotted content follow the wrong row when the window scrolls.
- Keep callbacks stable. Write handlers as class fields (`private onRowClick = (e: MouseEvent) => { … }`) rather than inline arrows inside `repeat`, so Lit doesn't rebind listeners on every row of every update.
- Don't build new arrays or objects for `.prop` bindings in `render()` when nothing changed: child elements with `hasChanged` would update anyway. Memoise in `willUpdate`.
- Split large templates into functions in `render/` that take plain data and return `TemplateResult`, for example `renderHeader(model, handlers)`. They are easier to read and test than deep methods on the element.

Directive cheat sheet and performance notes: `references/templates-and-directives.md`.

## Styles: tokens, parts, layers

argus-table's styling contract has three layers (see `06-styling-and-theming.md`): **CSS custom properties** (`--argus-*`), **`::part()` names with the state in the name**, and **light-DOM cell content** that page CSS can reach.

```ts
// styles/base.ts
import { css } from 'lit';
export const baseStyles = css`
  @layer argus-base {
    :host {
      display: block;
      color-scheme: light dark;
      contain: content;
      --_row-height: var(--argus-row-height, 40px);
    }
    [part~='cell'] {
      padding-inline: var(--argus-cell-padding-inline, 0.75rem);
      border-block-end: var(--argus-border-width, 1px) solid
        var(--argus-border-color, light-dark(#e5e7eb, #374151));
    }
    [part~='cell-pinned'] {
      position: sticky;
      background: var(--argus-bg, Canvas);
    }
  }
`;
```

- **No hard-coded colours.** Every value reads a token with a neutral fallback (`var(--argus-bg, Canvas)`); use `light-dark()` for dark-mode fallbacks. Themes in `@argus-table/themes` only set tokens and `::part()` rules, so anything they need must be a token or a part.
- **Private custom properties** (`--_row-height`) hold resolved or computed values internally. They aren't part of the API, so they can change.
- **State goes in the part name**, for example `part="cell cell-pinned cell-sorted"`. The reason: parts can't be chained (`::part(row) ::part(cell)` is invalid), and attribute or class selectors after a part aren't allowed (`::part(cell)[data-pinned]` is invalid). User-action pseudo-classes such as `::part(row):hover` do work. Users write `argus-table::part(cell-pinned)`. Build part strings with a small helper (`parts({ cell: true, 'cell-pinned': pinned })`) so names stay consistent. Select them internally with `[part~='cell']`.
- **New part or token? Add it to the plan's list and to the JSDoc** (`@csspart`, `@cssprop`). It becomes API once it ships.
- **Use logical properties** (`inset-inline-start`, `padding-inline`, `border-block-end`) so RTL works. Pinned columns use `position: sticky` with `inset-inline-start/end` offsets from the table model.
- **About `@layer argus-base`.** Rules from the page (theme files, `::part()` rules, styles on the host) already beat shadow-root styles for normal declarations, whatever their specificity, because the outer tree wins in the cascade. The layer keeps the component's own rules low-specificity and makes a move to light DOM painless. Whether cells stay in shadow DOM or move to light DOM inside `@layer` is still open until the rendering spike decides. Keep base rules inside the layer either way.
- Respect `prefers-reduced-motion`: no smooth scrolling or transitions under `reduce`.
- Share styles as `css` exports. Lit turns them into constructable stylesheets shared by all instances, so put no per-instance values in `static styles`. Per-instance values go in custom properties set via `styleMap`.

## Slots and light-DOM cell content

Cell and header content is meant to live in the **light DOM** (the Vaadin Grid pattern), so page CSS, utility classes and the page's own components work inside cells. The shadow-DOM cell holds a named `<slot>`, and the table renders the user's content into a light-DOM container with matching `slot` names:

```ts
// shadow DOM, inside the cell
html`<div part="cell" role="gridcell"><slot name=${slotName}></slot></div>`;

// light DOM, in one dedicated container the element owns
render(cellContent, this.cellHost, { host: this });
```

- Generated cell content goes into **one container the element owns**, never mixed with `<argus-column>` children.
- Use `render(template, container, { host: this })` from `lit` for the light-DOM part, so `@event` bindings in user templates get the table as `this`.
- Slot names derive from row id and column id and must be unique within the window. Recycle them when rows leave the virtual range, or the light DOM grows without bound.
- The rendering risk is real: slotted light-DOM cells may be too slow at 100k rows, and the fallback is shadow-DOM cells with tokens and parts only. Keep slot plumbing behind the render functions so the spike's outcome is a local change.

## Reactive controllers

Each concern is a controller that hooks into the host's lifecycle and calls `host.requestUpdate()` when its state changes:

```ts
import type { ReactiveController, ReactiveControllerHost } from 'lit';

export class DataController<T> implements ReactiveController {
  rows: (T | undefined)[] = [];
  #abort?: AbortController;

  constructor(private host: ReactiveControllerHost & HTMLElement) {
    host.addController(this);
  }

  hostConnected() {}
  hostDisconnected() { this.#abort?.abort(); }
  hostUpdate() {}   // before host.update(): like willUpdate
  hostUpdated() {}  // after host.updated()

  async load(range: Range) {
    this.#abort?.abort();
    this.#abort = new AbortController();
    // ...fetch, fill rows...
    this.host.requestUpdate();
  }
}
```

- The element creates controllers in its constructor and passes properties down in `willUpdate` (`this.data.setSource(this.dataSource)`). Controllers don't read the element's public properties behind its back.
- A controller fires its own `argus-*` events through the host (`this.host.dispatchEvent(…)`), which keeps the element class small.
- `hostDisconnected` must undo everything `hostConnected` did. Elements get moved in the DOM (disconnect, then reconnect), so `hostConnected` must work again afterwards.

The TanStack Lit adapters (`TableController` from `@tanstack/lit-table`, `VirtualizerController` from `@tanstack/lit-virtual`), memoisation and the one-extra-pass guard: `references/controllers.md`.

## Events

Every public event is a `CustomEvent` with `bubbles: true` and `composed: true` (so it crosses the shadow boundary), an `argus-` prefixed kebab-case name, and a typed `detail`:

```ts
// events.ts
export interface ArgusSortChangeDetail { sorting: SortState }

declare global {
  interface HTMLElementEventMap {
    'argus-sort-change': CustomEvent<ArgusSortChangeDetail>;
  }
}

export const fire = <D>(el: HTMLElement, name: string, detail: D) =>
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
```

- **Controlled versus uncontrolled** (see `code-architecture/04-state-and-events.md`). If the host never set the state property, the table updates its own state and then fires. If the host set it, the table fires the event with the proposed state and changes nothing until the host sets the property again. Use the shared helper in `core/state/controllable.ts`; don't reimplement it per feature.
- Fire after the update (`updated()`, or from a handler after state is applied), never during `render()`.
- `detail` holds plain data (ids, state objects), not TanStack objects or DOM nodes.
- Add `@fires` JSDoc for every event, because Storybook and the React, Vue and Angular wrappers are generated from the manifest.

## Accessibility

The table follows the WAI-ARIA **grid** pattern from the first release (`08-accessibility.md`). Details for Lit:

- The host gets its role through `ElementInternals`, so users can still set their own attributes:
  ```ts
  #internals = this.attachInternals();
  constructor() { super(); this.#internals.role = 'grid'; }
  ```
  Set `ariaRowCount` and `ariaColCount` on internals too, with the full size, not the rendered window.
- Rendered rows and cells inside the shadow root carry `role="row"` and `role="gridcell"` (or `columnheader`) plus `aria-rowindex` and `aria-colindex`, which are 1-based and include header rows. That way screen readers see the virtual position, not the DOM position.
- `aria-sort` goes on sorted headers only (`nothing` elsewhere).
- **Use roving tabindex, not `aria-activedescendant`.** ID references don't cross shadow roots, so `aria-activedescendant` pointing into another tree fails silently. Give one tab stop into the grid (the active cell has `tabindex="0"`, the others `-1`), and move focus with the arrow keys.
- Focus has to survive virtualization. Track the active cell by row id plus column id, keep that row rendered even outside the range, and restore focus after re-render with `await this.updateComplete`.
- Visible focus ring via `--argus-focus-ring` on `:focus-visible`.

For audits and screen-reader checks, use the `accessibility-compliance`, `wcag-audit-patterns` and `screen-reader-testing` skills.

## Document for the Custom Elements Manifest

The manifest (from `@custom-elements-manifest/analyzer`) feeds Storybook controls and API tables, the generated JSX, Vue and Angular wrappers and types, and VS Code hints. If something isn't in the JSDoc, users of those tools can't see it.

- **Class JSDoc tags:** `@summary`, `@fires name - description`, `@csspart name - description`, `@cssprop [--name=default] - description`, `@slot name - description`.
- **Property JSDoc:** one sentence per public property: what it does, its units, its default. The analyzer reads types and defaults from the code.
- Keep internals `private` or `#private`, so they stay out of the manifest.
- **If the element class isn't part of your change** (for example, you're writing render functions or styles before `argus-table.ts` exists), write the exact `@csspart` and `@cssprop` lines it needs into your summary, ready to paste. Otherwise new parts and tokens silently go undocumented.

Full tag list and examples: `references/documenting.md`.

## Testing

`core` uses plain Vitest; anything with a custom element uses **Vitest browser mode** (Playwright provider: Chromium, Firefox, WebKit), because scrolling, layout, sticky positioning and focus need a real browser.

```ts
import { expect, test } from 'vitest';
import '../src/argus-table.js';

test('fires argus-sort-change when a sortable header is clicked', async () => {
  const el = document.createElement('argus-table');
  el.columns = [{ id: 'total', header: 'Total', accessor: 'total', sortable: true }];
  el.data = [{ total: 2 }, { total: 1 }];
  document.body.append(el);
  await el.updateComplete;

  const events: CustomEvent[] = [];
  el.addEventListener('argus-sort-change', (e) => events.push(e));
  el.shadowRoot!.querySelector<HTMLElement>('[part~="header-cell"]')!.click();
  await el.updateComplete;

  expect(events[0].detail.sorting).toEqual([{ id: 'total', desc: false }]);
  el.remove();
});
```

- Always `await el.updateComplete` after changing properties or dispatching input.
- Query by part (`[part~="cell"]`) or role, not by internal class names. Parts are the public contract.
- Clean up elements after each test, or observers and listeners leak between tests.
- Test the controlled and uncontrolled paths of every state property.

More patterns (scroll, virtualization, focus, fake data sources, Storybook stories as tests): `references/testing.md`. For story files, also use the `storybook-stories` skill.

## Pitfalls to check for in review

- A class field shadowing a reactive property (`useDefineForClassFields`, or a field redeclared in a subclass without `declare`).
- Mutating an array or object property in place (`this.columns.push(…)`). Lit compares by identity, so nothing updates. Assign a new value, or call `requestUpdate('columns')`.
- A missing `super.connectedCallback()` or `super.disconnectedCallback()`.
- `repeat` without a key, or with the index as the key, in the virtual window.
- Events fired in `render()`, or without `composed: true`.
- Hard-coded colours or sizes instead of tokens; physical `left` and `right` instead of logical properties.
- A new public property, event, part or token missing from JSDoc, or not listed as a proposal.
- A planned token whose meaning changed (for example `--argus-pinned-shadow` no longer taking a box-shadow).
- `accessor` decorators mixed with experimental ones.
- TanStack types in a public signature or event `detail`.
- Unbounded measure-then-render loops in `updated()`.
