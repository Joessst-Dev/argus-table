# Columns that fill the table's width: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `stretchColumns` property (attribute `stretch-columns`, default `false`) makes the scrolling columns fill the table's width whenever they are narrower than it, computed in px by core.

**Architecture:** Core's model gets a `stretch` option (the scroller's width and the column resized last) and gives each `ColumnView` its rendered `width` (own width plus a share of the free space) and its `ownWidth`. The element measures the scroller through `PinScrollController`, passes `stretch` while the property is on, and resizes start from rendered widths. Tracks stay plain px, so virtualization, offsets and resizing need no other change.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Lit 3, Vitest (core in Node, table in browser mode), pnpm/Nx, the wrapper generator.

**Spec:** `docs/superpowers/specs/2026-11-18-stretch-columns-design.md`

## Global Constraints

- With `stretchColumns` off (`stretch` undefined), views, widths, events and every existing test are unchanged.
- Only shown scrolling (unpinned) data columns stretch; pinned, checkbox and chevron columns never.
- No stretching while an unresized `{ flex }` column is among the shown scrolling columns (it takes the free space through its track).
- Stretching columns: scrolling columns without a `columnSizing` entry; if none, the last shown scrolling column, or the one before it when the last is `stretch.keep`. `stretch.keep` never stretches.
- Shares are in proportion to own widths, capped at `maxWidth` (excess to the others), whole px, rounding leftovers one each from the last stretching column backwards; the sum equals the free space unless every stretching column is capped.
- `columnSizing`, `getState()`, `argus-column-sizing-change`, `argus-column-resize-end` carry own widths. `ColumnInfo.width` (plugins) is the rendered width.
- No state writes or events on a window resize; an update only when the floored scroller width changes.
- **Clarification of the spec (to tell the maintainer):** the spec's `stretch.resizing` ("the column being resized") becomes `stretch.keep`, the column the user resized **last**, kept until another one is resized. With "being resized" only, narrowing the last column (when it is the one taking the free space) would spring back on release.
- Run tests in the scratchpad Linux copy. `pnpm size` for `argus-table`; a budget raise (CDN 46 kB) only with the maintainer's approval.

## Review Focus

1. A vertical scrollbar that appears once rows overflow narrows `clientWidth`: widths recompute and no horizontal scrollbar appears (`scrollWidth <= clientWidth`). (Task 2.)
2. A table with no layout yet (hidden, `clientWidth` 0): no stretching, no `NaN`, stretches once shown. (Task 2.)
3. `virtualizeColumns` on with stretched columns: the rendered columns sit at their stretched offsets. (Task 2.)
4. Turning `stretchColumns` off restores own widths. (Task 2.)
5. Right-to-left: stretched columns fill the width the same way. (Task 2.)

---

### Task 1: Core: rendered and own widths

**Files:** Modify `packages/core/src/table/create-table.ts`, `packages/core/src/types.ts` only if `ColumnView` lives there (else in `create-table.ts`). Test: `packages/core/src/table/create-table.test.ts` (`describe('stretched columns', …)`).

**Interfaces:**

- Produces: `TableOptions.stretch?: { width: number; keep?: string | undefined } | undefined`; `ColumnView.ownWidth: number` (system views: their width); `ColumnView.width` = rendered width. `totalWidth` sums rendered widths. Memoization of views includes `stretch.width` and `stretch.keep`.
- Uses `spreadWidth(columns: SpreadColumn[], total)` from `columns/spread-width.ts` for capped proportional shares (pass `minWidth: 0`, `maxWidth: maxWidth − own`, `width: own`), then the rounding rule.

- [ ] **Step 1: Write the failing tests** with columns `a`, `b`, `c` (150 px each unless said), selection column off:
  - `'leaves widths alone without stretch'`: `width`/`ownWidth` both 150.
  - `'stretches scrolling columns in proportion to fill the width'`: `a` 100, `b` 200, `c` 300, `stretch: { width: 1200 }` → widths `[200, 400, 600]`, `ownWidth`s `[100, 200, 300]`, `totalWidth` 1200.
  - `'puts rounding leftovers on the last columns'`: three 150s, width 1000 → `[333, 333, 334]`.
  - `'keeps pinned and system columns, and fills with the scrolling ones'`: `a` pinned start 150, `selectionColumn: true` (its width `w`), `b`, `c` 150, width 1000 → `a` 150, `b` + `c` = 1000 − 150 − w.
  - `'does not stretch while an unresized flex column is shown'`: `b` `{ flex: 1 }` → no change from today.
  - `'stretches only unresized columns'`: `columnSizing: { a: 120 }`, width 1000 → `a` 120, `b` + `c` = 880 in equal shares (440, 440).
  - `'gives the space to the last column when all are resized, else the one before it if it is keep'`: all three in `columnSizing` at 150, width 600 → `[150, 150, 300]`; with `keep: 'c'` → `[150, 300, 150]`.
  - `'caps stretching at maxWidth'`: `a` `maxWidth: 160`, width 900 → `a` 160, `b` + `c` = 740 (370 each); all capped (`maxWidth: 160` on all) → `[160, 160, 160]`.
  - `'does nothing when the columns are wider than the width'`: width 300 → all 150.
  - `'offsets follow rendered widths'`: stretched `b`'s `offset` = rendered width of `a`.
- [ ] **Step 2: Run** `pnpm --filter @argus-table/core exec vitest run src/table/create-table.test.ts -t "stretched columns"`. Expected: FAIL.
- [ ] **Step 3: Implement** in `buildViews()`: compute own widths as today, then (when `options.stretch` and the conditions hold) the shares for the stretching columns, and build views and offsets from rendered widths; `ownWidth` on every view.
- [ ] **Step 4: Run** the whole core suite: `pnpm --filter @argus-table/core exec vitest run`. Expected: PASS, existing tests unchanged.
- [ ] **Step 5: Commit** `feat(core): stretched column widths`.

### Task 2: The element: `stretchColumns`, measuring and resizing

**Files:** Modify `packages/table/src/argus-table.ts`, `packages/table/src/controllers/pin-scroll-controller.ts`, `packages/table/src/controllers/column-resize.ts`. Test: create `packages/table/src/stretch-columns.test.ts`.

**Interfaces:**

- Consumes: Task 1's `stretch` option and `ownWidth`.
- Produces: `@property({ type: Boolean, reflect: true, attribute: 'stretch-columns' }) stretchColumns = false` with JSDoc (manifest). `PinScrollController` gets a third constructor parameter `onWidth: (width: number) => void`, called from `measure()` with `Math.floor(clientWidth)`. The element keeps `#viewWidth` and `#keep` (the id of the column resized last; set by `ColumnResize` when a resize of one column starts, kept until another column is resized) and passes `stretch: this.stretchColumns && this.#viewWidth > 0 ? { width: this.#viewWidth, keep: this.#keep } : undefined` in the `update()` call that passes `columnSizing`. `ColumnResize` starts a key resize from `view.width` unless the column is `#keep` (then the requested width in state, as today); drags already start from the cell's rendered width.

- [ ] **Step 1: Write the failing tests** (fixture 800 px wide; columns `a`, `b`, `c` at 150, unpinned; `widths(el)` reads the header cells' rendered widths):
  - `'fills the width with stretch-columns'`: widths sum to the scroller's `clientWidth` (±1), each > 150; `hasAttribute('stretch-columns')` after setting the property.
  - `'follows the table's width, back down to own widths, then scrolls'`: resize the host to 1000 → sum 1000-ish; to 300 → each 150 and `scrollWidth > clientWidth`; no `argus-column-sizing-change` fired.
  - `'a dragged column lands at the pointer, the others share the rest'`: drag `a`'s handle left by 100 px (the existing drag helper in `argus-table.test.ts`) → `a`'s rendered width = start − 100 (±1), `b` + `c` absorb it (sum still fills), `columnSizing.a` equals `a`'s rendered width, event `width` the same.
  - `'narrowing the last column when all are resized keeps it narrow'`: `columnSizing` for all three, drag `c` narrower → after `pointerup` and a settle, `c` keeps the dragged width and `b` took the space.
  - `'Alt+Arrow starts from the rendered width'`: focus `b`'s header, Alt+ArrowLeft → `b` = previous rendered − 10.
  - Review Focus 1: 100 rows in a 300 px tall fixture (vertical scrollbar) → `scrollWidth <= clientWidth`.
  - Review Focus 2: a table in a `display: none` box → no error, widths 150; shown → fills.
  - Review Focus 3: `virtualizeColumns: true` with 6 columns fitting → every header cell's left = the previous one's right (±1).
  - Review Focus 4: `stretchColumns = false` again → widths 150.
  - Review Focus 5: `dir="rtl"` → fills the width (sum ±1).
- [ ] **Step 2: Run** `BROWSERS=chromium pnpm --filter argus-table exec vitest run src/stretch-columns.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the property, the measuring callback (request an update only when the floored width changed and `stretchColumns` is on), `#keep`, the `stretch` option and the start-width rule in `ColumnResize` (`#currentWidth` / `#groupWidths`). `ColumnInfo.width` already comes from views (rendered).
- [ ] **Step 4: Run** the file in `BROWSERS=all`, then the whole table suite in all engines, `pnpm nx run argus-table:lint`, `pnpm nx run argus-table:typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: stretchColumns fills the table's width`.

### Task 3: Wrappers, docs, story, skill, changeset, size

**Files:**

- Regenerate: `packages/react/src/generated/elements.ts`, `packages/vue/src/generated/*`, `packages/angular/src/generated/*` (`pnpm nx build argus-table`, then each wrapper's `generate`).
- Modify: `apps/docs/src/content/docs/features/resizing.mdx` (a "Columns that fill the width" section with `FlavourTabs ... since="1.4"`), `apps/docs/e2e/resizing.spec.ts`, `apps/storybook/stories/resizing.stories.ts` (story `StretchColumns`), `skills/argus-table-integrate/scripts/lib/api.mjs` (property list, attribute `stretch-columns`), `skills/argus-table-integrate/references/api.md` (properties table row), `CLAUDE.md` (a paragraph after "Auto widths"), `packages/table/README.md` if it lists properties.
- Create: `apps/docs/src/examples/resizing/stretch/{html/index.html,html/main.js,react/StretchColumns.tsx,vue/StretchColumns.vue,angular/stretch-columns.component.ts}` (four fixed-width columns with `stretchColumns`, resizable), `.changeset/stretch-columns.md` (`argus-table`: minor; user-facing text).

- [ ] **Step 1: Write the e2e** per flavour `'${flavour}: columns fill the table's width'`: the header cells' widths sum to the table's scroller width (±2) and `scrollWidth <= clientWidth`; `expectAccessible`.
- [ ] **Step 2: Add the story** with a play function asserting the same, then shrinking the host to 300 px → scrolls.
- [ ] **Step 3: Write the examples, docs section, skill entries, CLAUDE.md paragraph, changeset; regenerate the wrappers.**
- [ ] **Step 4: Verify** in the copy: `pnpm nx run-many -t lint typecheck test` (all projects), `pnpm nx run storybook:test-storybook`, the docs e2e for `resizing.spec.ts` in `BROWSERS=all` (`-c e2e/playwright.config.ts`, `--workers=3`), `pnpm --filter argus-table size`, `pnpm exec prettier --check .`. Expected: all pass; over budget → trim, then ask with numbers.
- [ ] **Step 5: Commit** `docs: columns that fill the table's width`.
