# Docs Site Feature Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every feature page of the docs site, about 58 reader examples in four flavours each (plain HTML, React, Vue, Angular), each with its e2e spec, ported from the Storybook stories a reader needs.

**Architecture:** Each feature page follows the pattern plan 1 established and `apps/docs/README.md` documents: `src/examples/<feature>/<example>/{html,react,vue,angular}/`, a feature-level `data.ts`, a page `src/content/docs/features/<feature>.mdx` with one `<FlavourTabs>` per example, and `e2e/<feature>.spec.ts` running each example's interaction in every flavour with axe. `lint` (`scripts/check-examples.mjs`), `typecheck` and `e2e` already enforce the rule; this plan adds pages, not machinery, except CSS files in code panels (Task 23).

**Tech Stack:** As plan 1: Astro 7 + Starlight, React 19, Vue 3.5, Angular 22 (Analog), `@argus-table/*` workspace packages, Playwright 1.63 with `@axe-core/playwright`.

**Spec:** `docs/superpowers/specs/2026-11-16-docs-site-design.md`; foundation: `docs/superpowers/plans/2026-11-16-docs-site-foundation.md` (PR #157).

**Scope:** Plan 2 of 7. Five batches, **one PR each, merged before the next starts** (stacked PRs get closed when the base is squash-merged). Not here: the Rendering story's table becomes `getting-started` (plan 6); themes (one flavour, plan 5 with the theme creator); Tailwind (a guide, plan 6).

## Global Constraints

- Source of truth for what each example shows: the Storybook story named in its task (`apps/storybook/stories/<file>`): same data shape, columns, options and behaviour. Its `play` function is what the e2e spec repeats. Test-only stories (RTL variants, stress tests, preset-open states, `Empty`) are not ported.
- Example ids, file layout, `since`, page structure and spec helpers (`openFlavour`, `expectAccessible`, `cellText`) as in `apps/docs/README.md`. Each page's `since` is the release the feature arrived in (`packages/*/CHANGELOG.md`).
- Each feature's `data.ts` is self-contained (no imports from other features): readers see it under every flavour and copy it.
- Idiomatic per framework, using only the packages' public exports:
  - React: state with `useState`; `ReactColumnDef` for columns with JSX; `useRef` for element methods.
  - Vue: `<script setup lang="ts">`; `v-model:<prop>` for state the app accepts as proposed; `#cell-<id>`, `#header-<id>` and `#group-<id>` slots; template `ref` for methods.
  - Angular: standalone components with signals; `[(prop)]` for accepted state; `ng-template argusCell` / `argusHeader` / `argusGroupHeader`; `viewChild` for methods.
  - HTML: element properties, `addEventListener`, ids prefixed `<feature>-<example>-`, JSDoc types.
- **Stable instances.** Plugins (`headerMenu()`, `formulas()`, `tableExport()`, `cellEditing()`) and `dataSource` objects are created once: at module scope in React and Vue (`markRaw` if kept in reactive state), as a class field in Angular. A new instance reconnects, or reloads a data source.
- **Vetoing controlled state.** Examples that refuse some proposals (a sort, a selection over five rows) don't use `v-model` or `[(…)]`, which accept every proposal. They bind the value one way and apply the change event themselves.
- **No `<template>` children in the framework flavours.** `<argus-column>`'s `<template>` child is HTML-only. The others use `#cell-<id>` slots, `argusCell` templates or a `cell` function.
- Storybook-only scaffolding (args, globals, `render()` into a controls div) becomes real UI in the example: a checkbox, a select, a button, an `<output>` or a `<pre>` log.
- Each example's spec: one page load, every flavour in turn, the story's interaction, an assertion on the example's own visible state (an `<output>`, a log, a cell's text, an attribute), then `expectAccessible`.
- Each batch ends with `BROWSERS=all pnpm nx run-many -t lint typecheck test build e2e -p docs` passing, Prettier on the changed files, and the PR merged when CI is green.

## Review Focus

- **The four flavours must behave the same, not just render.** A spec that asserts only in the HTML flavour lets a broken React flavour through. Every spec runs its assertions inside the `for (const flavour of FLAVOURS)` loop. Pinned in each task's spec step.
- **Several examples on one page.** Ids, tab persistence and `openFlavour` scoping must hold when a page has three or four examples. The specs open every example on the page in turn on the same page load (Selection: four examples).
- **Plugin or data-source identity across re-renders.** A React or Vue example that recreates `headerMenu()` or its `dataSource` on every render looks fine at first but reloads or closes the menu on the next state change. Specs for add-on and data-source examples change state after the plugin is in use: Header menu sorts through the menu, then opens it again; Infinite loading sorts, then scrolls.
- **Wrapper gaps.** Some APIs may not be expressible in a wrapper: `{ pinned }` in Vue and Angular cell slots, header text mode for slot and template headers, custom editor content. Task 17 checks them before any page needs them. A gap is fixed in the wrapper, with a test and a changeset, never worked around in the example.
- **Global CSS from one example leaking into another flavour or page.** Styling examples scope their CSS to their own example (Task 24).

---

## Batch A: core columns (PR 1)

Each task in this batch has the same steps; only the examples differ.

- [ ] **Step 1:** Write `e2e/<feature>.spec.ts` with the checks listed. Run `BROWSERS=chromium pnpm nx run docs:e2e -- e2e/<feature>.spec.ts`. Expected: FAIL, because the page isn't there yet.
- [ ] **Step 2:** Write `data.ts`, the four flavours of each example, and the page.
- [ ] **Step 3:** Run `pnpm nx run-many -t lint typecheck build -p docs`, then the spec in all three engines. Expected: PASS.
- [ ] **Step 4:** Commit `docs(site): <feature> in four flavours`.

### Task 1: Sorting, controlled

Files: `src/examples/sorting/controlled/`, `src/content/docs/features/sorting.mdx` (a second section), `e2e/sorting.spec.ts`. From `sorting.stories.ts` `Controlled`.

| Example              | Shows                                                                                                                            | Spec checks                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `sorting/controlled` | `sorting` held by the app and `argus-sorting-change` applied, except a sort by `id`, which is refused and named in an `<output>` | A click on Customer sorts it. A click on Order leaves `aria-sort` unchanged and the output reads `Refused: id`. |

### Task 2: Declarative columns

From `declarative-columns.stories.ts` `Markup` and `Dynamic`. Each framework uses its own `ArgusColumn` component, `<argus-column>` with `@Input`s, and slot or template cells (see Global Constraints).

| Example                       | Shows                                                    | Spec checks                                        |
| ----------------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| `declarative-columns/markup`  | Columns as children, a cell given as content, `getRowId` | Header texts in order; one action button per row   |
| `declarative-columns/dynamic` | A column shown by a checkbox (the story's arg)           | City is absent, then present after ticking the box |

### Task 3: Density

From `density.stories.ts` `AllThree`.

| Example       | Shows                                                 | Spec checks                                     |
| ------------- | ----------------------------------------------------- | ----------------------------------------------- |
| `density/all` | Three tables, `compact`, `comfortable` and `spacious` | Their first body rows are 32, 40 and 52 px tall |

### Task 4: Resizing

From `resizing.stories.ts`.

| Example               | Shows                                                                    | Spec checks                                                                   |
| --------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `resizing/basic`      | `resizable: false`, `minWidth` and `maxWidth`                            | Three resize handles; dragging Customer's handle by +40 px widens it by 40 px |
| `resizing/controlled` | `columnSizing` and `argus-column-sizing-change`, saved to `localStorage` | After a drag and a reload, the width is kept                                  |

### Task 5: Auto width

From `auto-width.stories.ts`.

| Example                     | Shows                                                                                    | Spec checks                                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `auto-width/auto-columns`   | `width: 'auto'` with `maxWidth`                                                          | SKU and Category cells aren't cut off (`scrollWidth <= clientWidth`)                                                                        |
| `auto-width/fit-to-content` | `autosizeColumns()` from a button through an element ref, and a double-click on a handle | After a double-click on Price's handle, Price isn't cut off. The button fits every column, and a sizing-change count `<output>` increments. |

### Task 6: Column reorder

From `column-reorder.stories.ts`. The PinnedGroups rule becomes a sentence of prose.

| Example                     | Shows                                                                  | Spec checks                                                                    |
| --------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `column-reorder/basic`      | Alt+Shift+Arrow and dragging; `reorderable: false`                     | Alt+Shift+ArrowLeft on Owner moves it one place left; ArrowRight moves it back |
| `column-reorder/controlled` | `columnOrder` and `argus-column-order-change`, saved to `localStorage` | After a keyboard move and a reload, the order is kept                          |

### Task 7: Pinned columns

From `pinned-columns.stories.ts` `StartAndEnd`.

| Example                | Shows                                                                      | Spec checks                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `pinned-columns/basic` | `pin: 'start'` and `'end'`, `--argus-pinned-shadow`, an action button cell | Three pinned cells per row, two `cell-pinned-edge` cells; after scrolling 400 px, the start-pinned cell's left edge is unchanged |

### Task 8: Column pinning and visibility

From `column-pinning-visibility.stories.ts`.

| Example                         | Shows                                                                                                                  | Spec checks                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `column-visibility/controls`    | `columnPinning` and `columnVisibility` driven by a form: a select per column and a "shown" checkbox; `hideable: false` | Choosing "start" for Owner pins it. Unticking Title hides it, and ticking it again shows it. Title's checkbox for an unhideable column is disabled. |
| `column-visibility/declarative` | `hidden`, `hideable` and `pin` on column children                                                                      | Toggling Owner's hidden state from a button hides and shows it                                                                                      |

- [ ] **Batch A done:** the full run from Global Constraints. Push `docs/site-features-a`, open the PR, merge when green.

## Batch B: rows, data and scrolling (PR 2)

Same steps per task as batch A.

### Task 9: Row height

From `row-height.stories.ts`.

| Example                   | Shows                                                           | Spec checks                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `row-height/wrapped-text` | `wrap: true`, `row-height="56"`                                 | First body row is 56 px; the wrapped cell has `data-wrap`                                                                                                          |
| `row-height/auto`         | `row-height="auto"`, a bar cell of varying height, `pinnedRows` | Body rows have different heights with no gap between consecutive rows (`bottom` of one equals `top` of the next ±1); the header is no taller than the shortest row |

### Task 10: Pinned rows

From `pinned-rows.stories.ts` `Totals` and `TopAndBottom`. `Totals` needs `{ pinned }` in the cell context in every flavour; Task 17 checks the wrappers in batch D; run its pinned-rows check now, before this page.

| Example                      | Shows                                                                       | Spec checks                                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pinned-rows/totals`         | `pinnedRows.bottom` with a bold totals cell (`context.pinned`)              | The totals row is the last `aria-rowindex` and stays put after scrolling the body; its total cell renders `strong`        |
| `pinned-rows/top-and-bottom` | Top and bottom pinned rows; `argus-row-click` with `pinned`, shown in a log | ArrowDown from the header lands in the top pinned row; Ctrl+End reaches the bottom row; Enter there logs `pinned: bottom` |

### Task 11: Scrolling

From `scrolling.stories.ts`.

| Example               | Shows                                                                                                                              | Spec checks                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `scrolling/scroll-to` | `scrollToRow({ id }, { align: 'center' })` and `scrollToColumn()` from buttons through an element ref; the result in an `<output>` | "Go to o50000" shows o50000's row in view and outputs `true`; "Go to column" scrolls sideways (`scrollLeft > 0`); an unknown id outputs `false` |

### Task 12: Column virtualization and infinite loading

From `column-virtualization.stories.ts` `WideTable` and `infinite-loading.stories.ts`.

- **Server:** `infinite-loading/data.ts` holds the story's fake server as `createSource({ total, failOnce }): DataSource<Order>`. It's async, honours `signal`, sorts, and fails the first request of a page once when `failOnce` is set.
- **Stable sources:** each flavour creates its source once (Global Constraints).

| Example                            | Shows                                                           | Spec checks                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `column-virtualization/wide-table` | `virtualizeColumns` with 503 columns, an end-pinned button cell | Fewer than 30 headers are rendered; End on the first header reaches c500 and its header is in view                         |
| `infinite-loading/known-total`     | `dataSource` with a total                                       | The first cell becomes `o1`. After sorting by Total, it holds the largest total. Scrolling to the end loads the last page. |
| `infinite-loading/unknown-total`   | No total: the table grows                                       | Scrolling twice to the end adds rows each time (`aria-rowcount` is -1, then the row count grows)                           |
| `infinite-loading/failed-page`     | `argus-load-error` (logged), Retry                              | The log shows the failed range; Retry's label is "Retry rows 1–100"; clicking it loads the rows                            |

### Task 13: Filtering

From `filtering.stories.ts`. `filtering/data-source` reuses the fake-server pattern from Task 12, but its `data.ts` is the filtering feature's own.

| Example                    | Shows                                                        | Spec checks                                                                                             |
| -------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `filtering/quick-filter`   | `quickFilter` from a search box                              | Typing "oslo 777" leaves only matching rows; clearing restores the count                                |
| `filtering/column-filters` | `columnFilters` (set and number) from a form; `filter` kinds | Rows match the form; filtered headers have `header-cell-filtered`; changing the select changes the rows |
| `filtering/data-source`    | Filters sent to `getRows`, `filterOptions`                   | Rows match within 3 s, and the request log shows the filter                                             |
| `filtering/declarative`    | `filter` on column children                                  | Only Quito rows                                                                                         |

- [ ] **Batch B done:** the full run. PR `docs/site-features-b`, merged when green.

## Batch C: selection, keyboard, state and groups (PR 3)

### Task 14: Selection

From `selection.stories.ts`. Keyboard's play folds into `selection/multi`'s spec.

| Example                | Shows                                                  | Spec checks                                                                                                      |
| ---------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `selection/multi`      | `selectionMode: 'multi'`, `selection` in an `<output>` | Click, Shift+click, Ctrl+click select o2, o3, o4 and o7. Space, Shift+ArrowDown and Ctrl+A work as in the story. |
| `selection/single`     | `selectionMode: 'single'`                              | Clicking o5 selects o5 only                                                                                      |
| `selection/checkboxes` | `selectionCheckboxes`                                  | One row makes select-all indeterminate; select-all selects every row                                             |
| `selection/controlled` | Selections over five rows refused (one-way binding)    | A Shift-range of 10 leaves the selection unchanged, and the output says it was refused                           |

### Task 15: Keyboard and saved state

From `keyboard.stories.ts` `Navigation` and `saved-state.stories.ts` `SaveAndRestore`.

| Example                    | Shows                                                                                        | Spec checks                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `keyboard/navigation`      | Focus moves; `argus-cell-click` from Enter, logged                                           | ArrowDown, ArrowRight and PageDown move focus as the story asserts; Enter logs the cell     |
| `saved-state/save-restore` | `getState()` and `setState()` through an element ref, kept in `localStorage`; `headerMenu()` | Sort and scroll, then save. Change the sort, then restore: the sort and the top row return. |

### Task 16: Column groups

From `column-groups.stories.ts`. The Reorder and Keyboard plays fold into `column-groups/basic`'s spec; WideGroup stays in Storybook.

| Example                      | Shows                                                                                                | Spec checks                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `column-groups/basic`        | `columnGroups`                                                                                       | The group header has `aria-colspan` 2. Alt+Shift+Arrow moves the group. ArrowUp, ArrowRight and ArrowDown move between group and column headers. |
| `column-groups/nested`       | Nested groups                                                                                        | Two group rows; the column headers are `aria-rowindex` 3                                                                                         |
| `column-groups/declarative`  | Group components around column components; a custom group header (`#group-<id>`, `argusGroupHeader`) | The group label text; the column order                                                                                                           |
| `column-groups/pinned-split` | A group across pinned and scrolling columns                                                          | The start part has `data-pin`, the centre part has colspan 1                                                                                     |
| `column-groups/resize`       | A group resize, `reorderable: false`                                                                 | Alt+ArrowRight on the group header sets `columnSizing` for both columns (shown in an `<output>`)                                                 |

- [ ] **Batch C done:** PR `docs/site-features-c`.

## Batch D: add-ons (PR 4)

### Task 17: Wrapper capability checks

**Files:**

- Test: `packages/vue/src/test/content.test.ts` (or the closest existing content test), `packages/angular/src/test/content.test.ts`, `packages/react/src/content.test.tsx`
- Modify: whichever wrapper lacks the capability; add a changeset per fixed package

Add a test to each wrapper, where it's missing, for each of these:

- **Pinned rows in cell content:** a pinned row's cell slot or template gets `pinned: 'bottom'` in its context.
- **Header text mode:** a column whose header is a slot or template (`#header-x`, `argusHeader`) gets its name from the definition's `header` string in text mode (`host.headerText`), so header-menu and export name it.
- **Custom editor content:** a custom `meta.edit.editor` returning framework content (JSX, a VNode, `argusTemplate()`) renders in the cell and can call `commit`.

Steps:

- [ ] Write the tests and run each wrapper's `test`. A failing test is a wrapper gap: fix it in that wrapper, add a patch changeset, and run the wrapper's tests and `typecheck`.
- [ ] Commit `fix(<wrapper>): …` per fix, or `test(wrappers): …` when all three pass as they are.

Tasks 18 to 22 follow batch A's steps.

### Task 18: Header menu

From `header-menu.stories.ts`. The Keyboard and PinAndHide plays fold into `header-menu/basic`'s spec.

| Example                          | Shows                                                        | Spec checks                                                                                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `header-menu/basic`              | `headerMenu()`                                               | Opening the menu doesn't sort. Sort descending works, and focus returns to the header. Opening the menu again still works (instance stability). Pin, hide, "Show Customer" and "Don't pin" work as in PinAndHide. |
| `header-menu/controlled-sorting` | `sorting` bound one way; the proposal shown in an `<output>` | The menu's Sort descending shows the proposal, and the table stays unsorted                                                                                                                                       |
| `header-menu/template-headers`   | Framework-content headers named in text mode                 | Hide Customer, then the "Show Customer" item exists                                                                                                                                                               |
| `header-menu/filter`             | `filter` kinds, the set form                                 | Choosing Oslo leaves only Oslo rows; `header-cell-filtered`; Clear filter restores the rows                                                                                                                       |

### Task 19: Editing

From `editing.stories.ts`.

| Example                | Shows                                                                        | Spec checks                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `editing/basic`        | `cellEditing()` with `meta.edit`; `argus-cell-edit` applied with `applyEdit` | Enter, type, Enter: the cell shows the new value; the editor's `aria-label` is "Customer, row 1" |
| `editing/validation`   | `validate`                                                                   | Typing -5 shows the message and `aria-invalid`; Escape cancels                                   |
| `editing/more-editors` | Date and checkbox editors, a custom editor (three buttons)                   | Clicking a checkbox toggles it; the custom editor commits 3                                      |

### Task 20: Export

From `export.stories.ts`. Downloads are checked with Playwright's `page.waitForEvent('download')`.

| Example              | Shows                                                                                                                 | Spec checks                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `export/basic`       | `tableExport()`, buttons calling `downloadTable()` through an element ref, a quick filter, a "selected rows only" box | The CSV download under a filter has the header plus the matching rows; with "selected only", only the selected rows |
| `export/column-meta` | `meta.export` (`header`, `value`, `exclude`)                                                                          | The CSV's header row matches the story                                                                              |

### Task 21: Formulas

From `formulas.stories.ts`. EditorOpen stays in Storybook.

| Example                     | Shows                                                                | Spec checks                                                               |
| --------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `formulas/basic`            | `formulas()`, `formula`                                              | Computed values as in the story; Gross sorts descending                   |
| `formulas/whole-columns`    | `[[col]]` functions, with `headerMenu()`                             | The story's values; a filter change recomputes them                       |
| `formulas/errors`           | Error values                                                         | The story's error texts and titles                                        |
| `formulas/custom-functions` | The `functions` option                                               | Net and VAT values                                                        |
| `formulas/editing`          | `editing: 'edit'`; the `argus-formula-column-*` events set `columns` | Adding "Net" through the dialog shows the preview and then the new column |

### Task 22: Labels

From `labels.stories.ts` `German`. It uses all four plugins, so it comes last.

| Example         | Shows                                                      | Spec checks                                                                                              |
| --------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `labels/german` | The table's `labels` and each plugin's `labels`, in German | The German `aria-label`s, the editor label, the menu items, and a sort through the menu, as in the story |

- [ ] **Batch D done:** PR `docs/site-features-d`. Its changesets come from Task 17's wrapper fixes, if any.

## Batch E: styling (PR 5)

### Task 23: CSS files in code panels

**Files:**

- Modify: `apps/docs/src/lib/sources.ts`, `apps/docs/src/lib/sources.test.ts`, `apps/docs/src/components/FlavourTabs.astro` (glob also matches `css`)

**Interfaces:**

- `ExampleFile['lang']` gains `'css'`.
- A feature-level `styles.css` is shown after `data.ts` in every flavour, as `data.ts` is.

Steps:

- [ ] **Test:** `filesOf` with `'/src/examples/styling/styles.css': 'css'` lists `styles.css` last in each flavour, with `lang: 'css'`. Run it: FAIL.
- [ ] Implement the change; the test passes. Commit `feat(docs): CSS files in code panels`.

### Task 24: Styling

From `styling/parts.stories.ts`, `styling/slotted-content.stories.ts` and `styling/tokens.stories.ts`. Playground stays in Storybook.

- **CSS lives in the feature's `styles.css`.** Each flavour imports it with `import '../../styles.css'`; HTML imports it from `main.js`.
- **Every rule is scoped to its example's table,** by a class the example sets on it (`.styling-parts`), so rules don't leak across examples or flavours.
- **Same steps as batch A.**

| Example                   | Shows                                                                | Spec checks                                                                  |
| ------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `styling/parts`           | `::part()` rules                                                     | Header text is `uppercase` (computed style)                                  |
| `styling/slotted-content` | Page CSS styling cell content; a header with a visually hidden label | The `.badge` border radius is 999px; the hidden label exists and has no size |
| `styling/striped`         | Tokens for striped rows                                              | The first body row is 44 px; odd rows' background differs from even rows'    |
| `styling/rounded`         | Tokens for a rounded, bordered table                                 | The border radius is 12px and the border is 1px                              |

- [ ] **Batch E done:** PR `docs/site-features-e`. After it, every feature page exists; plan 7 (the switch-over) can follow plans 3–6.
