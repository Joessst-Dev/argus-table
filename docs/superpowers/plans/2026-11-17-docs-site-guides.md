# Docs site: getting started and guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The docs site gets a Getting started page with a first table in all four flavours, and a Guides section: written guides (state, server data, styling, Tailwind, plugins, accessibility, performance with the benchmarks) and the add-on and framework guides rendered from the packages' READMEs.

**Architecture:** Plan 4's machinery for rendering repo Markdown in place (a content collection plus Sätteri plugins that drop the `# ` title and rewrite links) is generalized from "migration guides" to "rendered pages", so the add-on and wrapper READMEs render the same way and stay one source with npm. Written guides are MDX pages with code blocks (one flavour, like the Tailwind page in the spec); Getting started uses the four-flavour `FlavourTabs`. The performance guide renders `benchmarks/published/latest.json` through a pure, tested module.

**Tech Stack:** Astro 7.4 + Starlight 0.43, Sätteri plugins (plan 4), React/Vue/Angular islands (plan 1), Vitest (Node), Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-11-16-docs-site-design.md`, "Site structure": "**Getting started**: install, a first table in each flavour (the four-flavour pattern), themes." and "**Guides**: controlled and uncontrolled state, server data (`dataSource`), styling and themes, plugins and writing one, accessibility, performance and scaling (the benchmarks, read from `benchmarks/published/`), and the add-on guides (from the add-on READMEs)." "The Tailwind page sits with the guides, in one flavour."

## Global Constraints

- Add-on guides come **from the add-on READMEs**, unchanged: `packages/{header-menu,formulas,export,editing}/README.md`. My call, same reasoning: the wrappers' READMEs (`packages/{react,vue,angular}/README.md`) render as framework guides, replacing Storybook's Recipes pages, which would otherwise be lost at the switch-over.
- The benchmarks are read from `benchmarks/published/latest.json` at build time (no copy), with the gate verdicts from `benchmarks/markdown.ts` (`scrollVerdict`, `pageVerdict`), as Storybook's Benchmarks page does.
- Written guides draw on what Storybook's `getting-started.mdx`, `api.mdx` (events, controlled/uncontrolled, plugins, header text and meta), `styling/tailwind.mdx` and `benchmarks.mdx` say, the packages' JSDoc and CLAUDE.md; they link the feature pages and the API reference instead of repeating them. Prose is the builder's.
- No new dependencies. Docs-only PR (`no-changeset`). Prettier over the whole repo before push.
- READMEs and migration files stay unchanged; links in them to the published Storybook stay until the switch-over (plan 7).

## Review Focus

1. **A link on a guide page to another site page or anchor that doesn't exist** (a renamed feature page): the spec fails naming page and link. → Task 3 `guides.spec.ts` "every site link on the guide pages lands".
2. **A benchmark size without some browser's results** (a partial `latest.json`): its cells read `n/a` and the gate `FAIL`, nothing throws. → Task 4, `benchmarks.test.ts`.
3. **A README whose first line isn't `# `** or a package without a README: the build fails naming it (as for migration guides). → Task 1, `packages.test.ts`.
4. **The benchmark tables on a phone** (12 columns): they scroll inside a focusable, labelled region; the page doesn't scroll sideways; axe passes. → Task 4 spec.
5. **Markdown rendered from outside `apps/docs` that is no known page** (a new collection, or a checkout path the plugin can't match) fails instead of passing through with unrewritten links. → Task 1, `rendered.test.ts`.

---

### Task 1: Rendered pages, generalized; the package guides

**Files:**

- Create: `apps/docs/src/lib/rendered.ts` (+ `rendered.test.ts`), `apps/docs/src/lib/packages.ts` (+ `packages.test.ts`), `apps/docs/src/pages/guides/[pkg].astro`, `apps/docs/e2e/packages.spec.ts`
- Modify: `apps/docs/src/lib/migration.ts` (+ its test: the generic parts move out), `apps/docs/src/pages/migration/*.astro`, `apps/docs/src/content.config.ts` (a `packages` collection), `apps/docs/astro.config.mjs`, `apps/docs/package.json` (Nx inputs: `{workspaceRoot}/packages/*/README.md` for build, test, e2e: the `production` input excludes `*.md`)

**Interfaces:**

- Produces, `src/lib/rendered.ts` (the generic half of today's `migration.ts`):
  - `GITHUB_BLOB` (moved here, re-exported from `migration.ts` for its callers).
  - `interface RenderedPage { id: string; title: string; label: string; file: string; path: string }`: `file` repo-relative, `path` the site path without base and with a trailing slash (`migration/tanstack/`, `guides/export/`).
  - `pagePath(page: RenderedPage, base: string): string` → `${base}/${page.path}`.
  - `rewriteHref(href, from, { pages, base, exists })` (today's, with `pages` and `pagePath`).
  - `renderedPlugins({ repoRoot, base, pages }: { repoRoot: string; base: string; pages: readonly RenderedPage[] }): { mdast; hast }` (today's `migrationPlugins`); the "no known page" throw becomes: a file outside `apps/docs/` that is no page throws.
  - `renderedMarkdownIntegration(options)` (today's `migrationGuidesIntegration`).
- `src/lib/migration.ts` keeps `REFERENCES`, `migrationGuides(repoRoot): RenderedPage[]` (now with `path: 'migration/<id>/'`) and `titleOf`-style reading (exported as `firstTitle(repoRoot, file): string` from `rendered.ts`, shared).
- `src/lib/packages.ts`: `PACKAGE_GUIDES: readonly { id: string; title: string; label: string; group: 'Add-ons' | 'Frameworks' }[]` = header-menu "Header menu add-on" / "Header menu", formulas "Formulas add-on" / "Formulas", export "Export add-on" / "Export", editing "Editing add-on" / "Editing" (Add-ons); react "React" / "React", vue "Vue" / "Vue", angular "Angular" / "Angular" (Frameworks); `packageGuides(repoRoot): (RenderedPage & { group })[]`: `file: packages/<id>/README.md`, `path: guides/<id>/`; throws naming the file when it's missing or its first line isn't `# `.
- The page `/guides/<id>/` (`StarlightPage`, title from `PACKAGE_GUIDES`) shows a note before the content, verbatim: "This page is the README of `@argus-table/<id>`, the same as on npm." linking `https://www.npmjs.com/package/@argus-table/<id>`.

- [ ] **Step 1: Tests.** Move today's `migration.test.ts` cases for `rewriteHref`, the plugins and the integration into `rendered.test.ts` against `RenderedPage`s (same assertions; the site paths now come from `path`), keep the `migrationGuides` cases in `migration.test.ts` (each entry now also has `path`), and add:

```ts
// rendered.test.ts
test('markdown from outside the site that is no page fails', () => {
  const { mdast } = renderedPlugins({ repoRoot: repo, base: '/argus-table', pages });
  expect(() => mdast({ fileURL: pathToFileURL(join(repo, 'packages/table/README.md')) })).toThrow(
    /packages\/table\/README\.md/,
  );
  expect(
    mdast({ fileURL: pathToFileURL(join(repo, 'apps/docs/src/content/docs/index.mdx')) }),
  ).toBeUndefined();
});
test('a link between rendered pages of different kinds resolves', () => {
  // from a migration guide to an add-on README: ../../../../packages/export/README.md → /argus-table/guides/export/
});
// packages.test.ts
test(
  'lists the seven package guides with their README' /* ids in PACKAGE_GUIDES order; export → { title: 'Export add-on', file: 'packages/export/README.md', path: 'guides/export/', group: 'Add-ons' } */,
);
test(
  'a README without a "# " first line fails, naming it' /* fixture root with packages/export/README.md 'No title' → throws /packages\/export\/README\.md/ */,
);
test('a missing README fails, naming it' /* fixture root without packages/vue/README.md */);
```

- [ ] **Step 2: Run them to see them fail**: `pnpm --filter @argus-table/docs exec vitest run src/lib` → FAIL (`rendered.ts`, `packages.ts` missing).

- [ ] **Step 3: Implement** `rendered.ts` and `packages.ts`, slim `migration.ts`, the `packages` collection (`glob` loader, base `../../packages`, pattern `PACKAGE_GUIDES.map((p) => \`${p.id}/README.md\`)`, `generateId`the folder name),`[pkg].astro`(like`migration/[guide].astro`), and in `astro.config.mjs`one`renderedMarkdownIntegration({ repoRoot, base, pages: [...migrationGuides(repoRoot), ...packageGuides(repoRoot)] })`replacing the migration one. Delete`node_modules/.astro` before building (Astro caches rendered Markdown by file).

- [ ] **Step 4: The spec** `e2e/packages.spec.ts`: for each of the seven, `guides/<id>/` has the title as its only `h1`, the README note with the npm link, a code block from the README's Install section (`npm i @argus-table/<id>` text in an `.expressive-code`), and passes axe; the README's own `# @argus-table/<id>` heading isn't on the page.

- [ ] **Step 5: Run**: `pnpm --filter @argus-table/docs exec vitest run`, build, `BROWSERS=all … playwright test packages.spec.ts migration.spec.ts --workers=3`, `pnpm nx run-many -t lint typecheck -p docs`. Expected: all pass (the migration spec unchanged and green: the refactor keeps its behaviour).

- [ ] **Step 6: Commit**: `docs(site): render the package READMEs as guides`

### Task 2: Getting started

**Files:**

- Create: `apps/docs/src/examples/getting-started/first-table/{html/index.html,html/main.js,react/FirstTable.tsx,vue/FirstTable.vue,angular/first-table.component.ts}`, `apps/docs/src/examples/getting-started/data.ts`, `apps/docs/src/content/docs/getting-started.mdx`, `apps/docs/e2e/getting-started.spec.ts`
- Modify: `apps/docs/src/content/docs/index.mdx` (a "Start with Getting started" link), `apps/docs/astro.config.mjs` (Start here: Introduction, Getting started)

**Interfaces:**

- Consumes: `FlavourTabs`, `openFlavour`, `cellText`, `headerTexts`, `expectAccessible` (plan 1–2 helpers in `e2e/flavours.ts`).

- [ ] **Step 1: The spec** `getting-started.spec.ts`, one test per flavour: open `getting-started/first-table`; headers are `['Order', 'Customer', 'Total']`; clicking Customer sorts (first body row's customer changes to the alphabetically first one from `data.ts`); clicking a row shows "Selected order o…" in the example's own output element (`#getting-started-first-table-output` in HTML; each flavour renders the same text); `expectAccessible`.

- [ ] **Step 2: Run it to see it fail** (after a build): `BROWSERS=chromium … playwright test getting-started.spec.ts` → 404.

- [ ] **Step 3: The example**, the Storybook "A first table" in each flavour: columns `id` (Order, 90, pinned start), `customer` (`customer.name`, flex, sortable), `total` (110, end, sortable); 200 orders from `data.ts`; `getRowId`; a row click shows "Selected order <id>". The flavours don't import a theme (the site loads `default.css` for every example, as on the feature pages); the page's install section shows that import.

- [ ] **Step 4: The page** (`title: Getting started`, no `since`): Install (`npm i argus-table @argus-table/themes`, the wrappers' packages, the CDN script tag); "A first table" with the four flavours; the three rules (bounded height, an accessible name, columns and data as properties); "Themes" (load one, link the Themes pages and the creator); "Next" (Features, Guides, API reference, Migration).

- [ ] **Step 5: Run** the spec in all engines and `pnpm nx run docs:lint` (the four-flavour check covers the new example). Expected: pass.

- [ ] **Step 6: Commit**: `docs(site): getting started`

### Task 3: The written guides

**Files:**

- Create: `apps/docs/src/content/docs/guides/{state,server-data,styling,tailwind,plugins,accessibility}.mdx`, `apps/docs/e2e/guides.spec.ts`
- Modify: `apps/docs/astro.config.mjs` (sidebar group "Guides": Controlled and uncontrolled state, Server data, Styling and themes, Tailwind, Plugins, Accessibility, Performance (Task 4), then sub-groups "Add-ons" and "Frameworks" from `packageGuides()` by `group`)

**Interfaces:**

- Consumes: the `/guides/<id>/` package pages (Task 1) for links.

- [ ] **Step 1: The spec** `guides.spec.ts`:

```ts
const GUIDES = {
  state: 'Controlled and uncontrolled state',
  'server-data': 'Server data',
  styling: 'Styling and themes',
  tailwind: 'Tailwind',
  plugins: 'Plugins',
  accessibility: 'Accessibility',
};
test('<id>: renders with its title' /* h1, axe */);
test(
  'every site link on the guide pages lands' /* collect .sl-markdown-content a[href^="/argus-table/"] on every /guides/ page (written and package ones); group by path; each path loads (status < 400) and each #hash is an element id there (the migration spec's pattern) */,
);
test(
  'the sidebar lists every guide' /* nav[aria-label="Main"] details "Guides": 7 written links + 7 package links */,
);
```

- [ ] **Step 2: Run it to see it fail** → 404s.

- [ ] **Step 3: The pages** (one flavour, code blocks; each links the feature pages and API reference it builds on):
  - `state`: which properties are controllable (`sorting`, `columnSizing`, `columnOrder`, `columnPinning`, `columnVisibility`, `columnFilters`, `selection`), uncontrolled vs controlled (the proposal, applying it, `undefined` hands control back), the `argus-<property>-change` events and their detail shape, two-way binding in the wrappers (`v-model:sorting`, `[(sorting)]`, React's `onSortingChange`), saving a layout with `getState()` / `setState()`.
  - `server-data`: the `DataSource` contract (`getRows({ start, end, sorting, filters, quickFilter, signal })`, `pageSize`, `total`, aligned pages, errors and Retry, `argus-load-error`, `refresh()`, a stable source object, `getRowId` from the server), in prose for people, with one `fetch` example; links Infinite loading.
  - `styling`: the model (shadow skeleton, light-DOM content, tokens, parts named for state, slotted content), themes, overriding tokens, `light-dark()` and `color-scheme`; links the Styling feature page, Themes and the creator.
  - `tailwind`: Storybook's Tailwind recipe (utilities in cells, tokens from the Tailwind theme, `@apply` in `::part()`), one flavour.
  - `plugins`: using add-ons (`plugins`, order), the `ArgusPlugin` hooks, the `PluginHost` members, header text and `meta` (from `api.mdx`), a small plugin written end to end.
  - `accessibility`: the grid pattern and roving focus, the keyboard map (link Keyboard), naming the table (`aria-label`), announcements (sorting, filtering, moves) through a live region, `aria-readonly` and editing, translations (`labels`), what's tested (axe on every story and docs page, all engines).

- [ ] **Step 4: Run** the spec in all engines, `pnpm nx run docs:lint`. Expected: pass.

- [ ] **Step 5: Commit**: `docs(site): guides`

### Task 4: Performance and scaling

**Files:**

- Create: `apps/docs/src/lib/benchmarks.ts` (+ `benchmarks.test.ts`), `apps/docs/src/components/BenchmarkTables.astro`, `apps/docs/src/content/docs/guides/performance.mdx`
- Modify: `apps/docs/e2e/guides.spec.ts`, `apps/docs/package.json` (Nx build inputs: `{workspaceRoot}/benchmarks/published/**/*`, `{workspaceRoot}/benchmarks/markdown.ts`, `{workspaceRoot}/benchmarks/types.ts`, as Storybook's build has), `apps/docs/README.md`, `CLAUDE.md` (the `apps/docs` bullet: Getting started, guides, rendered READMEs, benchmarks)

**Interfaces:**

- Produces, `src/lib/benchmarks.ts` (types from `benchmarks/types.ts`):
  - `sizeLabel(rows: number): string` (`10000` → `10k`, `1000000` → `1M`).
  - `interface BenchmarkRow { browser: string; steady: string; fast: string; jumps: string; longTasks: string; blankWrong: string; load: string; sort: string; heap: string; growth: string; lastRow: string; gate: 'pass' | 'FAIL' }`: display strings, as the Storybook page shows them (`"8.3 ms"`, `"didn’t scroll"`, `"n/a"`, `"> 30 s"`, `"stops at 99,999"`).
  - `benchmarkRows(results: Results, rows: number): BenchmarkRow[]`: one per browser with page stats for that size, the logic of Storybook's `SizeTable` (`benchmarks.mdx`).

- [ ] **Step 1: Tests** (`benchmarks.test.ts`): against the real `latest.json`, one row per browser for each of `meta.rows`, every `gate` is `pass` or `FAIL`; a fixture with a size whose `fast` scroll result is missing for a browser → that row's `fast` is `'n/a'` and `gate` `'FAIL'`; a page with `sortMs: null` → `sort` is `> ${sortTimeoutMs / 1000} s`; `reachable: false` → `lastRow` `stops at <min, en-formatted>`; `sizeLabel` cases.

- [ ] **Step 2: Run, see them fail; implement; run, see them pass**: `pnpm --filter @argus-table/docs exec vitest run src/lib/benchmarks.test.ts`.

- [ ] **Step 3: The page**: what argus-table does for scale (row virtualization and pooled rows, column virtualization, scroll scaling past the engines' height limit, `rowHeight: 'auto'`'s cost, a `dataSource` for server data), what to do in an app (stable `columns` and accessors, `getRowId`, `virtualizeColumns` for wide tables), then "Benchmarks": the version, date and machine line from `meta`, `BenchmarkTables` (an `h3` per size and a table with a caption, inside `<div class="table-scroll" role="region" tabindex="0" aria-label="Benchmarks, <size> rows">`), and "What is measured" from `benchmarks.mdx`.

- [ ] **Step 4: Spec**: add to `guides.spec.ts`: `performance` renders a table per size in `meta.rows` whose caption names it, the intro names `meta.version` (read the JSON in the spec), and at 390 px the page doesn't scroll sideways and axe passes.

- [ ] **Step 5: Run everything** (Linux copy): `pnpm nx run-many -t lint typecheck test -p docs`, the full docs e2e suite in all engines (`--workers=3`), `pnpm exec prettier --check .`. Expected: all pass.

- [ ] **Step 6: Docs and commit**: README's "How it fits together" gains the rendered READMEs (`packages.ts`, one source with npm) and the benchmarks (`benchmarks.ts` reads `latest.json` at build time); CLAUDE.md's `apps/docs` bullet one sentence each. Commit: `docs(site): performance guide with the benchmarks`.
