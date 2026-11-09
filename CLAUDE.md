# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`<argus-table>`: a framework-agnostic, virtualized data table web component built with Lit 3, TanStack Table v9 (`@tanstack/table-core`) and TanStack Virtual. pnpm + Nx monorepo, Node ≥ 22.12 (`.nvmrc`), pnpm via Corepack. Currently v0.1 (virtualized rows, pinned columns, sorting, resizing, keyboard nav, default theme) plus, for v0.2, `dataSource` infinite loading, pinned rows, auto column widths, column reordering, `<argus-column>` children, the React, Vue and Angular wrappers, the Material-inspired theme, the benchmarks (Storybook "Benchmarks" page, fed by `benchmarks/published/`) and scroll scaling past the engines' maximum element height; StackBlitz starters are still to come in v0.2.

`docs/plan/` is the design plan (public API draft, roadmap, architecture diagrams). It describes intended features too, so check the source before assuming something exists (for example `rowHeight: 'auto'` is planned but not implemented). `docs/adr/0001-shadow-vs-light-dom.md` explains the rendering model below.

## Commands

```bash
pnpm install
pnpm dev                 # Storybook (apps/storybook) on :6006
pnpm play                # Vite playground (apps/playground) on :5173
pnpm lint                # nx run-many -t lint typecheck  (Prettier is separate: pnpm format:check / pnpm format)
pnpm test                # Vitest in all projects (browser mode, headless Chromium)
pnpm build               # every package
pnpm test:e2e            # Playwright against the built playground (`vite preview` on :4173)
pnpm test:visual         # screenshot tests inside the CI Playwright Docker image (needs Docker)
pnpm size                # CDN bundle min+gzip vs packages/table/.size-limit.json (45 kB)
pnpm bench               # benchmarks/: ROWS=10000,100000,1000000 BROWSERS=… RUNS=… (see benchmarks/README.md)
pnpm affected            # what CI runs for the branch (base: main)
pnpm changeset           # add a release note
```

Single project / single test:

```bash
pnpm nx test argus-table                                   # Nx project names: argus-table, core, themes, react, vue, angular, generate-wrappers, storybook, playground, e2e, visual, benchmarks
pnpm --filter argus-table exec vitest run src/argus-table.test.ts -t "keyboard"
pnpm --filter @argus-table/core exec vitest run src/table/create-table.test.ts
pnpm nx run storybook:test-storybook                        # every story as a test, with axe (violations fail)
BROWSERS=chromium pnpm --filter @argus-table/e2e exec playwright test specs/sort.spec.ts
```

- `BROWSERS` env selects engines: `chromium,firefox,webkit` or `all`. Vitest (unit and storybook) defaults to Chromium; **e2e defaults to all three**.
- First run needs browsers: `pnpm --filter argus-table exec playwright install chromium` (Playwright is pinned to 1.63.0 everywhere).
- Nx targets depend on `^build`, so running through `nx` builds dependencies first. Storybook, the playground and e2e consume `argus-table` through its `dist/` exports; running their tools directly without Nx needs `pnpm nx build argus-table` first. `packages/table`'s own unit tests and typecheck read `@argus-table/core` from source and need no build.
- Don't update visual snapshots locally (fonts differ outside the CI image). CI regenerates them when a PR gets the `update-snapshots` label; `pnpm test:visual --update-snapshots` runs in Docker if needed.

## Packages

- `packages/core` (`@argus-table/core`, **private, never published**): DOM-free logic, tests run in Node. Column resolution, the TanStack adapter (`table/create-table.ts`), the `controllable` state helper, the `RowPool`. It is bundled into `argus-table`'s build; `packages/table/scripts/check-dist.mjs` fails the build if any `dist` file still imports it. A core change ships as an `argus-table` changeset.
- `packages/table` (`argus-table`, published): the Lit element. Build = Vite library build (ESM, `preserveModules`, lit/TanStack external) + CDN build with everything inlined (`vite.cdn.config.ts`) + bundled `.d.ts` (rollup-plugin-dts) + Custom Elements Manifest (`cem analyze`, from JSDoc on the class) + publint/attw.
- `packages/react` (`@argus-table/react`, published): `@lit/react` components for both elements. `src/generated/elements.ts` is generated and committed: after a change to the element's properties or `@fires` tags, build `argus-table` and run `pnpm --filter @argus-table/react generate` (`lint` fails on a stale file). The generic signatures and type re-exports in `src/index.ts` are hand-written. In the versioning `fixed` group with `argus-table`.
- `packages/vue` (`@argus-table/vue`, published): same layout and `generate` script as React. The generated file is a description of each element plus types in vue-tsc's generic-component shape; `src/define.ts` turns a description into a component (sets element properties itself, emits events and `update:*`, exposes methods). Typecheck is `vue-tsc`, and the tests mount SFCs (`src/test/Declarative.vue` also holds `@vue-expect-error` type checks).
- `packages/angular` (`@argus-table/angular`, published): standalone components on the element tags, generated with `@Input()` setters and `@Output()`s (not `input()`/`output()`: the tests run TestBed in JIT mode in Vitest, which can't see signal inputs without the CLI's transform; for the same reason test hosts use `@ViewChild`). `src/set-property.ts` routes strings to attributes. Built by ng-packagr; `typecheck` also runs `ngc` on `src/test/types.ts` with strict templates. Test mounts call `fixture.detectChanges()` right away so bindings land before the elements' first update.
- `tools/generate-wrappers` (private): reads `packages/table/dist/custom-elements.json` and writes each wrapper's generated file. Event detail types come from `@fires {CustomEvent<…>} name` in the element's JSDoc, so every event needs a typed `@fires`. Runs from source with Node's type stripping (`.ts` imports).
- `packages/themes` (`@argus-table/themes`): plain CSS in `src/`, built by Lightning CSS (`scripts/build.mjs`). Themes only set `--argus-*` tokens and `::part()` rules.
- `apps/storybook`: stories double as docs and tests (play functions + axe on every story). Each feature gets a story.
- `apps/playground`: the page that e2e, visual tests and `benchmarks/` drive. With `?bench` it leaves the table unmounted until `__argusBench.mount()`.
- `benchmarks/`: `run.ts` measures, `merge.ts` combines per-engine results into `published/` (committed; the Storybook Benchmarks page imports `published/latest.json`).
- `tests/e2e`, `tests/visual`: Playwright projects.

## Architecture of `<argus-table>`

**TanStack stays internal.** Only `packages/core/src/table/create-table.ts` imports TanStack Table; it exposes `TableModel`, `ColumnView` and `RowView`. `packages/core/src/types.ts` holds the public types with no TanStack types in them, and `argus-table` re-exports them with `TContent` fixed to `CellContent` (`TemplateResult | Node | string | number`). Never leak TanStack types into the public API.

**Shadow DOM structure, light-DOM content (ADR 0001).** The shadow root renders the grid skeleton (header, body rows, cells with `part`s and ARIA). Header and cell _content_ is rendered by `render/cells.ts` (`renderLightDom`, called in `updated()`) into the host's light DOM as direct children with private slot names (`h-{col}`, `c-{poolSlot}-{col}`), so page CSS and the page's own components work inside cells.

**Pooled rows.** `VirtualController` wraps TanStack Virtual and `RowPool`: each rendered row holds a pool slot while in range, freed slots are reused. Body rows and light-DOM content are keyed and ordered by pool slot (not row id), so scrolling updates DOM in place and the node count stays bounded. DOM order is therefore pool order; the logical position is `aria-rowindex` (header = 1, then pinned top rows, then the body; map it with `RowLayout`). The active row is "kept" rendered outside the range so focus survives scrolling.

**Update flow** (`argus-table.ts`): `willUpdate` pushes properties into `TableController` → core model, reconciles the active cell, and configures the virtualizer → `render` computes the virtual window and calls the pure render functions in `render/` (`header.ts`, `body.ts`) → `updated` renders light-DOM content, moves focus, and fires deferred events. Row height is measured from a hidden `.probe` element (ResizeObserver), so density and the `--argus-row-height` token drive the virtualizer.

**Scroll scaling** (`controllers/virtual-controller.ts`, core `virtual/scroll-scale.ts`): engines limit an element's height (`max-height.ts` measures it once per page, again after a zoom), so a taller body renders at that cap and the scroll position maps linearly onto the rows. TanStack Virtual sees a `Proxy` stand-in for the scroller whose `scrollTop`, `scrollHeight` and `scrollTo()` are logical; rows render at `start` less the logical-minus-physical offset. Under the cap it's the identity. Scroll through the controller (`scrollBy`, `reveal`, `scrollToIndex`), never `scrollTop += px`, and a focused body row is revealed by the controller, not `scrollIntoView` (a physical px is several rows once scaled). Tests force a small cap with `setMaxElementHeightForTests()`.

**Infinite loading** (`dataSource`): `DataController` owns a core `PageCache` (pages loaded / in flight / failed, row count, eviction) and passes it to the model as `remote`; `rowAt()` is then `undefined` for unloaded rows, which render as skeletons. Requests are debounced (50 ms) and aborted when they scroll away; a new source, sort order or `refresh()` starts a fresh cache. Sorting happens on the server in this mode.

**Pinned rows** (`pinnedRows`): separate objects, not data rows; the core model reads them (`pinnedRowAt`, `pinnedCellContext`) outside TanStack's row models. `render/pinned-rows.ts` puts them in two sticky row groups, not pooled. Row positions go through core's `RowLayout` (header, top, body, bottom), so `aria-rowindex` is no longer "row index + 2": use the layout, not arithmetic. The active cell carries its `section`.

**Auto widths** (`width: 'auto'`, `controllers/auto-width.ts`): `measureColumns()` sets a private `data-measure` attribute (`inline-size: max-content`) on the rendered cells of a column, reads their widths and removes it again in one synchronous step in `updated()`. An auto column measures once its first loaded rows render, and the widths go to the core model as `autoWidths`, separate from `columnSizing`. A double-click on a handle and `autosizeColumns()` are resizes: they go through `columnSizing`.

**Column order** (`columnOrder`, `controllers/reorder-drag.ts`): core normalizes the order per pin group (`columns/column-order.ts`) and hands it to TanStack as the order of its column defs and pinning arrays (TanStack's ordering feature isn't used: it costs bundle size for nothing). Moves stay within a pin group. A header drag is pointer events on the window (not HTML drag and drop), starts after 4 px, swallows the click that ends it, and changes the order once on drop; Alt+Shift+Arrow moves by one. Headers are keyed by column id, so a moved header loses focus: set `#focusPending`. Announcements go through `announce.ts`, a live region in the document body, because a grid may only own rows.

**`<argus-column>` children** (`argus-column.ts`, `controllers/column-children.ts`): a data-only `ReactiveElement` (no shadow root) that builds a `ColumnDef` from its attributes and properties; a `<template>` child becomes a static cell via Lit's `templateContent`. Columns notify their parent table through a private registry (`watchColumns`) on connect, disconnect and update, so the table has no `MutationObserver` on its children (that would fire on every light-DOM cell render). A non-empty `columns` property wins over the children. `renderLightDom` renders before a private end-marker comment, so children appended later stay outside Lit's part.

**Controlled/uncontrolled state.** `sorting`, `columnSizing` and `columnOrder` use `controllable()` (`core/src/state/controllable.ts`): uncontrolled until the host sets them; once set, user actions only fire the event with the _proposed_ value; setting `undefined` hands ownership back. Follow this pattern for new user-changeable state. When the table applies a change itself, the event fires after the update completes (`#appliedSort`, `#appliedResize`).

**Events** are defined in `events.ts`: `argus-*` names, fired via `fire()` as bubbling, composed `CustomEvent`s, with types added to `HTMLElementEventMap`. Detail types live in core.

**Keyboard and a11y.** WAI-ARIA grid pattern with a single roving tab stop (`#active`). The host gets `role="grid"` via ElementInternals _and_ a `role` attribute (axe can't see the internals role). Arrow directions and resize keys are logical (RTL-aware via computed `direction`). Pinning uses logical `start`/`end`.

**Styling.** No hard-coded colours in components (`styles/base.ts`): every value reads an `--argus-*` token with a neutral fallback (system colours like `Canvas`). Element state is expressed in part names (`cell-sorted`, `cell-pinned-edge`, `row-odd`) because `::part()` can't take attribute selectors. Private CSS variables use the `--_` prefix. Tokens, parts, slots and events are documented in the JSDoc on `ArgusTable` (`@cssprop`, `@csspart`, `@fires`, `@slot`), which feeds the Custom Elements Manifest; keep it in sync.

## Conventions

- Public API (properties, events, `--argus-*` tokens, part names) is a contract; treat additions and changes as API decisions.
- Unit tests sit next to the code (`*.test.ts`); `packages/table/src/test-utils.ts` has `fixture()` (mounts a _sized_ table; virtualization renders nothing in a 0×0 box), `settle()`, `shadow()`, `slotted()`, `scrollTo()`.
- Any change to a published package needs a changeset (CI checks `changeset status`). Write it from the user's point of view; it becomes the changelog entry. Releases go through the "Version packages" PR.
- TypeScript is strict with `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (use `import type`), legacy decorators (`experimentalDecorators`, `useDefineForClassFields: false`), and `.js` extensions in relative imports. ESLint uses `strictTypeChecked` plus lit and wc plugins; template-literal numbers are wrapped in `String()`.
- Project skills live in `.claude/skills/` (managed by faehigkeiten via `.faehigkeiten.lock.yaml`; don't edit them by hand). The `lit3` skill describes how components, controllers, styles and tests are written in this repo.
