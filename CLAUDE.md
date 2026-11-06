# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`<argus-table>`: a framework-agnostic, virtualized data table web component built with Lit 3, TanStack Table v9 (`@tanstack/table-core`) and TanStack Virtual. pnpm + Nx monorepo, Node ≥ 22.12 (`.nvmrc`), pnpm via Corepack. Currently v0.1 (virtualized rows, pinned columns, sorting, resizing, keyboard nav, default theme); infinite loading, pinned rows, auto widths, column reordering and framework wrappers are v0.2.

`docs/plan/` is the design plan (public API draft, roadmap, architecture diagrams). It describes intended features too, so check the source before assuming something exists (for example `<argus-column>` is planned but not implemented). `docs/adr/0001-shadow-vs-light-dom.md` explains the rendering model below.

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
pnpm size                # CDN bundle min+gzip vs packages/table/.size-limit.json (41 kB)
pnpm affected            # what CI runs for the branch (base: main)
pnpm changeset           # add a release note
```

Single project / single test:

```bash
pnpm nx test argus-table                                   # Nx project names: argus-table, core, themes, storybook, playground, e2e, visual, benchmarks
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
- `packages/themes` (`@argus-table/themes`): plain CSS in `src/`, built by Lightning CSS (`scripts/build.mjs`). Themes only set `--argus-*` tokens and `::part()` rules.
- `apps/storybook`: stories double as docs and tests (play functions + axe on every story). Each feature gets a story.
- `apps/playground`: the page that e2e, visual tests and `benchmarks/` drive.
- `tests/e2e`, `tests/visual`: Playwright projects.

## Architecture of `<argus-table>`

**TanStack stays internal.** Only `packages/core/src/table/create-table.ts` imports TanStack Table; it exposes `TableModel`, `ColumnView` and `RowView`. `packages/core/src/types.ts` holds the public types with no TanStack types in them, and `argus-table` re-exports them with `TContent` fixed to `CellContent` (`TemplateResult | Node | string | number`). Never leak TanStack types into the public API.

**Shadow DOM structure, light-DOM content (ADR 0001).** The shadow root renders the grid skeleton (header, body rows, cells with `part`s and ARIA). Header and cell *content* is rendered by `render/cells.ts` (`renderLightDom`, called in `updated()`) into the host's light DOM as direct children with private slot names (`h-{col}`, `c-{poolSlot}-{col}`), so page CSS and the page's own components work inside cells.

**Pooled rows.** `VirtualController` wraps TanStack Virtual and `RowPool`: each rendered row holds a pool slot while in range, freed slots are reused. Body rows and light-DOM content are keyed and ordered by pool slot (not row id), so scrolling updates DOM in place and the node count stays bounded. DOM order is therefore pool order; the logical position is `aria-rowindex` (header = 1, so row index = `aria-rowindex - 2`). The active row is "kept" rendered outside the range so focus survives scrolling.

**Update flow** (`argus-table.ts`): `willUpdate` pushes properties into `TableController` → core model, reconciles the active cell, and configures the virtualizer → `render` computes the virtual window and calls the pure render functions in `render/` (`header.ts`, `body.ts`) → `updated` renders light-DOM content, moves focus, and fires deferred events. Row height is measured from a hidden `.probe` element (ResizeObserver), so density and the `--argus-row-height` token drive the virtualizer.

**Controlled/uncontrolled state.** `sorting` and `columnSizing` use `controllable()` (`core/src/state/controllable.ts`): uncontrolled until the host sets them; once set, user actions only fire the event with the *proposed* value; setting `undefined` hands ownership back. Follow this pattern for new user-changeable state. When the table applies a change itself, the event fires after the update completes (`#appliedSort`, `#appliedResize`).

**Events** are defined in `events.ts`: `argus-*` names, fired via `fire()` as bubbling, composed `CustomEvent`s, with types added to `HTMLElementEventMap`. Detail types live in core.

**Keyboard and a11y.** WAI-ARIA grid pattern with a single roving tab stop (`#active`). The host gets `role="grid"` via ElementInternals *and* a `role` attribute (axe can't see the internals role). Arrow directions and resize keys are logical (RTL-aware via computed `direction`). Pinning uses logical `start`/`end`.

**Styling.** No hard-coded colours in components (`styles/base.ts`): every value reads an `--argus-*` token with a neutral fallback (system colours like `Canvas`). Element state is expressed in part names (`cell-sorted`, `cell-pinned-edge`, `row-odd`) because `::part()` can't take attribute selectors. Private CSS variables use the `--_` prefix. Tokens, parts, slots and events are documented in the JSDoc on `ArgusTable` (`@cssprop`, `@csspart`, `@fires`, `@slot`), which feeds the Custom Elements Manifest; keep it in sync.

## Conventions

- Public API (properties, events, `--argus-*` tokens, part names) is a contract; treat additions and changes as API decisions.
- Unit tests sit next to the code (`*.test.ts`); `packages/table/src/test-utils.ts` has `fixture()` (mounts a *sized* table; virtualization renders nothing in a 0×0 box), `settle()`, `shadow()`, `slotted()`, `scrollTo()`.
- Any change to a published package needs a changeset (CI checks `changeset status`). Write it from the user's point of view; it becomes the changelog entry. Releases go through the "Version packages" PR.
- TypeScript is strict with `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (use `import type`), legacy decorators (`experimentalDecorators`, `useDefineForClassFields: false`), and `.js` extensions in relative imports. ESLint uses `strictTypeChecked` plus lit and wc plugins; template-literal numbers are wrapped in `String()`.
- Project skills live in `.claude/skills/` (managed by faehigkeiten via `.faehigkeiten.lock.yaml`; don't edit them by hand). The `lit3` skill describes how components, controllers, styles and tests are written in this repo.
