# Splitting `argus-table.ts` and `create-table.ts` (design)

Status: draft, 18 November 2026.

## Why

`packages/table/src/argus-table.ts` is the file every feature touches: 56 of this month's commits changed it. Refactors #148–#150 took it from 2,933 to 1,724 lines; detail rows, fit-to-content and `stretchColumns` brought it back to 2,073. Core's `create-table.ts` is 1,059 lines, most of it one closure. The next features (formula syntax trees in `getRows`, the context menu and filter row add-ons, row dragging) will land in both.

The goal is that these files are **easier and safer to change**: each concern in a module of its own that can be read and tested alone, so a change to keyboard handling doesn't mean reading the virtualizer setup. Freeing bundle space is not the goal.

## Goals

- `argus-table.ts` keeps the class JSDoc, the public properties and methods (the Custom Elements Manifest reads them from the class), the controllable state, the Lit lifecycle (`willUpdate`, `render`, `updated`; shorter, but still holding the conditions that decide what to push where), and the wiring of controllers. Logic that only reads state moves out.
- `create-table.ts` keeps `createTableModel` and its returned object; the types, the row pipeline and the column views move to modules of their own.
- Each move preserves behaviour exactly. The existing tests are the safety net and pass unchanged after every commit (a test may change only its import path).

## Non-goals

- No change to any public API: properties, methods, events, parts, tokens, slots, the `PluginHost` members, `TableModel`'s members, core's exports from `index.ts`.
- No behaviour change and no fixes folded in. A bug found on the way is noted in the PR and fixed separately.
- No change to who owns state: the controllables (`#sorting`, `#pinning`, `#visibility`, `#filters`, `#expanded`) stay on the element.
- No rework of the existing controllers (navigation, resize, reorder, selection, …) or their constructor signatures, beyond what a moved caller needs.
- No shared "table context" object (approach 3 below).

## Anti-goals

- A split that makes the code harder to follow: a module whose dependencies take more lines to wire than the code it holds, or logic spread across files that must always be read together.
- A bigger CDN bundle with nothing to show for it (see Constraints).
- A slower table: memoized identities (`rowOrder`, `display`, views, `headerGroups`) must keep their identity exactly when they do today.

## Constraints

- **Minification.** The CDN build (`vite.cdn.config.ts`, full minify) renames `#private` members and module-level functions, but not public method or property names, nor the keys of object literals. So: give moved code few public members; pass dependencies as constructor or function arguments (stored in `#private` fields), not as option objects with named keys; prefer module-level functions over methods on objects. Checked in the current `dist/cdn/argus-table.js`: `#onKeydown` is gone, `.configure(` and `.computeWindow(` are there.
- **Budget.** The CDN bundle is 46.11 of 47 kB. The whole refactor may add at most 0.15 kB gzipped (my call); each PR states the before and after (`pnpm size`), as #148–#150 did. Ideally it shrinks, as those did.
- **Docs and JSDoc.** The CEM is built from the class's JSDoc (`@fires`, `@csspart`, …) and the public members' JSDoc: none of it moves. The wrappers' generated files must not change (`pnpm --filter @argus-table/react generate` etc. give the same output).
- **Core is DOM-free** and its tests run in Node; the new core modules stay that way.
- Repo conventions: strict TS, `.js` import extensions, `import type`, comments that say why.

## Approaches considered

1. **Stateless logic into modules (chosen).** Code that only reads the element's state moves into functions or small classes next to `grid.ts`, `render/` and `controllers/`; the one piece with state of its own (the scroll target) becomes a controller. The element keeps the state, so ownership doesn't change. Bytes roughly flat.
2. **Everything into controllers.** The element becomes properties plus wiring (~900 lines). Each controller needs getters into the element's private state (as `NavigationController` takes today), their public names survive minification (~0.5 kB), and the diff is larger. Rejected: more risk for a "safer to change" goal.
3. **A shared internal context first.** One object (model, data, navigation, selection, labels, scroller) all controllers read instead of getter bundles. Cleanest end state, but it rewires about ten existing controllers. Rejected for the same reason.

The maintainer picked 1, followed by the `create-table.ts` split.

## Part 1: `argus-table.ts`

What moves (line numbers as of `8523ab5`). Names are proposals; the builder may pick better ones.

| From the element                                                                                                                                            | To                                                 | Shape                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#onKeydown`, `#groupKey`, `#panelBack` (1650–1800, ~150 lines)                                                                                             | `controllers/keyboard.ts`                          | A class taking its collaborators in the constructor (nav, resize, reorder, plugins, data, and callbacks for toggle, sort, activate, cell target, direction), one public member: the keydown handler. Routing order unchanged.                                         |
| `#onClick`, `#activate` (1802–1863)                                                                                                                         | `activate.ts` (or `grid.ts`)                       | A function `activate(element, root, model, path)` firing `argus-cell-click` / `argus-row-click`.                                                                                                                                                                      |
| `getState`/`setState` internals: `#restore`, `#scrollTarget`, `#dropScrollTarget` and its listeners, `#chaseScrollTarget`; the target part of `scrollToRow` | `controllers/scroll-target.ts`                     | A controller owning the pending scroll target: set, chase on a new row count, drop on user input / new source / sort / filter. `#restore` becomes a module function. `getState()` / `setState()` stay on the element as public methods with their JSDoc and delegate. |
| The virtualizer setup in `willUpdate` (1293–1340: `rowIdAt`, `positionOf`, `keepTop`, the token, `configure`'s argument)                                    | `controllers/virtual-config.ts`                    | A function returning the `configure()` argument and the next `#laidOut`.                                                                                                                                                                                              |
| `#loading()`, `#toggles()` (1599–1625, 1877–1893)                                                                                                           | `render/body-state.ts`                             | Functions building the body's `Loading` and `RowToggles` from the cache, window, model and labels.                                                                                                                                                                    |
| `#columnInfo` body, `#cellTarget`, the plugin host's `header` / `headerText` closures (721–737, 1963–2022)                                                  | `plugin-host.ts` (helpers)                         | Pure functions: a `ColumnInfo` from a view and its filter, a `CellTarget` from an event path. The host literal itself stays in the element (moving it would need a dozen callbacks wired, about as long as the closures) but shrinks to one line per member.          |
| `#requestPin`, `#requestHide`, `#requestFilter`, `#requestSort`, `#setSort`, `#applySorting`, `#toggle` (1865–1961)                                         | stay                                               | They're the controllables' rules, and the controllables stay on the element. Builder may group them together in the file.                                                                                                                                             |
| `scrollToColumn`'s body, `#scrollColumnTo`, `#scrollRowTo`, `#settled` (1006–1095)                                                                          | `controllers/scroll-target.ts`, with the row above | The public `scrollToRow` / `scrollToColumn` stay on the element with their JSDoc and delegate. (Added after the builder check: same concern as the scroll target.)                                                                                                    |
| Row-height probe: `#observeProbe`, `#measureRowHeight`, `#rowPx`, `#pinnedPx`, `#headerAndPinnedPx` (2024–2066)                                             | optional: `controllers/row-height.ts`              | Only if it reads better; `#rowPx` is read in many places. Builder's call.                                                                                                                                                                                             |
| `render()`'s style map (1359–1389)                                                                                                                          | optional: `render/table-style.ts`                  | Builder's call.                                                                                                                                                                                                                                                       |

Expected result: `argus-table.ts` at about 1,600 lines, of which ~640 are imports, JSDoc and properties (the builder check counted ~1,650 for the rows above without the scroll methods). The line count is a by-product, not the measure: the series is judged by whether each concern above lives in one module. Moving more (`#syncDetails`, `#keptColumns`, `#headerHandlers`, the conditions in `willUpdate` / `updated`) is out of scope (the maintainer accepted ~1,600 lines on 18 November).

## Part 2: `create-table.ts`

| From                                                                                                                                     | To                      | Shape                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Constants and interfaces (`SortDirection` … `TableModel`, lines 41–430)                                                                  | `table/model-types.ts`  | Moved as is. `core/src/index.ts` and `table-controller.ts` import from the new place (or `create-table.ts` re-exports; builder's call, but core's public exports must not change). |
| `pinOf`, `hiddenOf`, `sizingState`, `widthOf`, `view`, `systemView`, `stretchedWidths`, `buildViews`, `buildAllViews` (452–491, 624–783) | `table/column-views.ts` | Module-level functions taking what they read as arguments.                                                                                                                         |
| `allRows`, `filteredRows`, `rows`, `rowIdOf`, `indexOfId`, `displayRows` and their memo state (523–622)                                  | `table/row-pipeline.ts` | A small class with `#private` memo fields (renamed by the minifier) and a few public methods; same memo keys as today.                                                             |
| `update()` and the returned object                                                                                                       | stay                    | `createTableModel` becomes the wiring.                                                                                                                                             |

The memo keys must stay identical: `rowOrder`, `display`, `columns`, `allColumns` and `headerGroups` keep their identity in exactly the same cases (the virtualizer, `RowMeasure`, selection's select-all cache and formulas' universes rely on it). `create-table.test.ts` covers most of this; add a test for any identity case it doesn't (the builder lists them in the PR).

## Delivery

Like #148–#150: a series of PRs into `main`, each self-contained and green, each moving one or two rows of the tables above.

- PR body: what moved where, `argus-table.ts` (or `create-table.ts`) lines before → after, CDN bundle before → after.
- A patch changeset for `argus-table` per PR: "Internal: … moved out of the element into their own modules. Nothing changes for apps." (`.changeset/split-argus-table-4.md` and on).
- `CLAUDE.md` updated in the same PR wherever it names a moved member (`#groupKey`, `#activate` line 99; `#panelBack` 83; `#measureAutoWidths`, `#pinnedPx` 73, 81; `#restore`, `#scrollTarget` in Saved state), and the `lit3` skill if an example shows moved code. ADRs and old specs are history: leave them.
- Order: Part 1 first (keyboard, then activation and scroll target, then the rest), Part 2 after Part 1 has merged.
- One PR at a time against `main` (no stacks: they share imports and constructor fields). The builder merges each PR itself (squash, delete branch) once CI is green, then starts the next from the new `main`; the maintainer agreed to this.

## Tests

Moves are covered by the existing tests, which drive the element through the DOM (keys, clicks, `setState`, scrolling), so a pure move needs no new tests (#149 and #150 added none). New tests only where a moved piece turns out to be uncovered (the builder checks coverage of each moved function before moving it and writes the missing test first, on `main`'s code), and in Part 2 for memo identity cases `create-table.test.ts` doesn't pin. My call, so PRs stay pure moves of about 500–700 lines.

## Verification per PR

- `pnpm lint`, `pnpm format:check` (whole repo, per memory), `pnpm test` (all projects), `pnpm nx run storybook:test-storybook`, e2e in Chromium locally (all engines in CI), `pnpm size`.
- The wrappers' `generate` gives no diff; `nx test skills` passes (it checks the manifest).
- Part 2: a local benchmark spot check in Chromium at 100k rows (`ROWS=100000 BROWSERS=chromium pnpm bench`) shows no regression against `main`.

## Left to the builder

- Exact module and function names, and whether a piece is a function or a small class, within the minification rule above.
- The optional rows (row-height probe, style map).
- How many PRs, as long as each is reviewable on its own (under ~700 changed lines, like #148–#150).
- Whether `create-table.ts` re-exports the moved types.
