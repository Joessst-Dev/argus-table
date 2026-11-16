# Docs Site Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A private Starlight site, `apps/docs`, built in CI on every PR and uploaded as a preview, with the machinery every feature page uses (four-flavour tabs from raw sources, release badges, the completeness check, per-framework type checks, a Playwright harness with axe) and Sorting as the first, reference feature page.

**Architecture:** Astro 7 + Starlight, with React and Vue islands (official integrations) and Angular islands (`@analogjs/astro-angular`), each scoped to its own example files. A feature page uses `<FlavourTabs example="<feature>/<example>">` with four named slots holding the islands; the component reads the example's files raw through `import.meta.glob`, so the code shown is the code that runs. Tests: Vitest (Node) for the pure helpers and the completeness check, Playwright against `astro preview` for the pages.

**Tech Stack:** Astro ^7.4, @astrojs/starlight ^0.43, @astrojs/react ^7.1, @astrojs/vue ^7.1, @analogjs/astro-angular ^2.9, Angular ^22.2, React ^19, Vue ^3.5, TypeScript ~6.0.3, Vitest ^5.1, @playwright/test 1.63.0, @axe-core/playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-docs-site-design.md`

**Scope:** This is plan 1 of 7. Later plans, each written when this one is merged: (2) port the remaining feature pages, in groups; (3) the generated API reference; (4) the migration guides from the integrate skill; (5) the theme creator move and its share links; (6) guides and getting started; (7) the switch-over (deploy, Storybook to PR artifacts, link updates, old-URL redirects).

## Global Constraints

- Node 24 (`.nvmrc`), pnpm workspace; TypeScript `~6.0.3` (Angular 22's build needs TypeScript 6).
- The site depends on `argus-table`, `@argus-table/react`, `@argus-table/vue`, `@argus-table/angular`, `@argus-table/themes` (and later the add-ons) as `workspace:*`, built through Nx (`dependsOn: ['^build']`).
- Nx project name `docs`; package name `@argus-table/docs`; `"private": true`.
- Astro `base: '/argus-table'`, `site: 'https://joessst-dev.github.io'`. Every internal link and test URL includes the base.
- Until the switch-over (plan 7) the site is **not deployed**: CI builds it and uploads it as an artifact named `docs-site`. Storybook stays deployed as today.
- Examples use the packages' public exports only; the one other import allowed is the example's `../data` (or `../data.ts` from the HTML flavour's `main.js`).
- Each framework's code is idiomatic for it: React state and `on*` props; Vue `v-model:<prop>` and `#cell-<id>` slots; Angular standalone components, signals, `[(prop)]`, `ng-template argusCell`; plain DOM properties and `addEventListener` in HTML.
- Feature pages are `src/content/docs/features/*.mdx`; every example on them has all four flavours (spec: "The four-flavour rule covers the feature pages").
- `since` badges: page frontmatter `since: '<major>.<minor>'`; compared with the `version` of `packages/table/package.json`; newer → `Coming in <since>`, else `Since <since>`.
- `CLAUDE.md` conventions apply: strict TypeScript, ESLint (the repo's root config), Prettier, `import type`.

## Review Focus

- A reader switches tabs before an island hydrated, or switches back: the other flavours' tables keep working (tabs hide panels; hidden tables must render once shown). Pinned by the Sorting spec, which opens each tab in turn on one page load.
- The reader's flavour choice persists across reloads and pages (Starlight `syncKey`): after choosing Vue, a reload shows Vue first. Pinned by `tabs.spec.ts` in Task 6.
- An example file that fails to compile in its framework (a wrong prop name in Vue, a template error in Angular) fails CI, not only at runtime. Pinned by Task 5's negative check.
- A feature page with an example missing one flavour, or an example folder no page uses, fails CI with the missing piece named. Pinned by Task 4's tests.
- Dark mode: a table on the site follows Starlight's theme switch (light ↔ dark), so it isn't white on dark. Pinned by Task 7's spec.

---

### Task 1: Scaffold `apps/docs` and build it in CI

**Files:**

- Create: `apps/docs/package.json`, `apps/docs/astro.config.mjs`, `apps/docs/tsconfig.json`, `apps/docs/src/content.config.ts`, `apps/docs/src/content/docs/index.mdx`, `apps/docs/README.md`
- Modify: `.github/workflows/docs.yml` (build and upload the site artifact), `pnpm-lock.yaml`, `CLAUDE.md` (an `apps/docs` entry under Packages and the project list in Commands), `docs/plan/repo-and-ci/01-repo-layout.md`

**Interfaces:**

- Produces: Nx targets `docs:build` (→ `apps/docs/dist`), `docs:preview` (`astro preview --port 4321 --host 0.0.0.0`), `docs:lint`, `docs:typecheck`; the integrations' include globs used by later tasks: React `['**/examples/**/react/**']`, Vue default (`.vue`), Angular `angular()` with `tsconfig.angular.json` (Task 5) covering `src/examples/**/angular/*.ts`.

- [ ] **Step 1:** Create `apps/docs/package.json`: name `@argus-table/docs`, `"private": true`, `"type": "module"`, `"nx": { "name": "docs" }`; scripts `dev` (`astro dev`), `build` (`astro build`), `preview` (`astro preview --port 4321 --host 0.0.0.0`), `lint` (`eslint .`), `typecheck` (`astro check` for now; Task 5 extends it); dependencies as in Tech Stack plus `@angular/{animations,build,common,compiler,compiler-cli,core,language-service,platform-browser,platform-server}` `^22.2.6`, `rxjs ^7.8.0`, `tslib ^2.8.0`, `@astrojs/check`, and the workspace packages from Global Constraints.
- [ ] **Step 2:** Create `astro.config.mjs` with `site`, `base` and the four integrations from Interfaces; Starlight `title: 'argus-table'`, `logo: { src: '../../brand/argus-table-logo.svg', replacesTitle: true }`, sidebar groups `Start here` (index), `Features` (autogenerate `features`). `content.config.ts` uses `docsLoader()` / `docsSchema()` extended with `since: z.string().regex(/^\d+\.\d+$/).optional()`.
- [ ] **Step 3:** Run `pnpm install`, then `pnpm nx run docs:build`. Expected: `apps/docs/dist/index.html` exists; no errors.
- [ ] **Step 4:** In `.github/workflows/docs.yml`'s build job, after building Storybook: `pnpm nx run docs:build`, then upload `apps/docs/dist` with `actions/upload-artifact` as `docs-site` (retention 7 days) on every event. The Pages upload stays Storybook's.
- [ ] **Step 5:** Run `pnpm nx run-many -t lint typecheck build -p docs`. Expected: all pass.
- [ ] **Step 6:** Commit: `feat(docs): scaffold the docs site (apps/docs), built as a CI preview`.

### Task 2: `FlavourTabs`, `Example` and the Sorting page

**Files:**

- Create: `apps/docs/src/lib/sources.ts`, `apps/docs/src/lib/sources.test.ts`, `apps/docs/vitest.config.ts`, `apps/docs/src/components/FlavourTabs.astro`, `apps/docs/src/components/Example.astro`, `apps/docs/src/examples/sorting/data.ts`, `apps/docs/src/examples/sorting/basic/html/{index.html,main.js}`, `apps/docs/src/examples/sorting/basic/react/Sorting.tsx`, `apps/docs/src/examples/sorting/basic/vue/Sorting.vue`, `apps/docs/src/examples/sorting/basic/angular/sorting.component.ts`, `apps/docs/src/content/docs/features/sorting.mdx`
- Modify: `apps/docs/package.json` (`test` script: `vitest run`)

**Interfaces:**

- Produces:
  - `type Flavour = 'html' | 'react' | 'vue' | 'angular'`; `const FLAVOURS: readonly Flavour[]` (that order) in `sources.ts`.
  - `interface ExampleFile { name: string; code: string; lang: 'html' | 'js' | 'tsx' | 'vue' | 'ts' }`.
  - `filesOf(raw: Record<string, string>, example: string): Record<Flavour, ExampleFile[]>`: from glob keys like `/src/examples/sorting/basic/react/Sorting.tsx`, the files of one example by flavour, sorted by name (`index.html` before `main.js`); `lang` from the extension (`.component.ts` → `ts`).
  - `FlavourTabs.astro` props `{ example: string; since?: string }`, named slots `html`, `react`, `vue`, `angular`; throws `Error('FlavourTabs ' + example + ': missing the <flavour> flavour')` when a slot or the example's files for a flavour are missing. Renders Starlight `Tabs` with `syncKey="flavour"` and, per flavour, `<Example>`.
  - `Example.astro` renders `<div class="example not-content" data-example={example} data-flavour={flavour}>` with the slot, then one Starlight `Code` per file (`title` = file name, `wrap`).
  - The HTML flavour's island is the example's `index.html` markup injected (`set:html`) plus its `main.js` imported in a `<script>`; `main.js` finds its table with `document.querySelector('[data-example="sorting/basic"][data-flavour="html"] argus-table')`.

- [ ] **Step 1: Write the failing tests** in `sources.test.ts`:

```ts
const raw = {
  '/src/examples/sorting/basic/html/main.js': 'js',
  '/src/examples/sorting/basic/html/index.html': 'html',
  '/src/examples/sorting/basic/react/Sorting.tsx': 'tsx',
  '/src/examples/sorting/basic/vue/Sorting.vue': 'vue',
  '/src/examples/sorting/basic/angular/sorting.component.ts': 'ts',
  '/src/examples/sorting/other/react/Other.tsx': 'x',
};
test('groups an example’s files by flavour, index.html first', () => {
  const files = filesOf(raw, 'sorting/basic');
  expect(files.html.map((f) => f.name)).toEqual(['index.html', 'main.js']);
  expect(files.react).toEqual([{ name: 'Sorting.tsx', code: 'tsx', lang: 'tsx' }]);
  expect(files.angular[0]?.lang).toBe('ts');
});
test('leaves out other examples', () => {
  expect(filesOf(raw, 'sorting/basic').react).toHaveLength(1);
});
test('an example with no files has empty flavours', () => {
  expect(filesOf(raw, 'nope/none').vue).toEqual([]);
});
```

- [ ] **Step 2:** Run `pnpm --filter @argus-table/docs exec vitest run src/lib/sources.test.ts`. Expected: FAIL (`filesOf` not defined).
- [ ] **Step 3:** Implement `filesOf` and the types in `sources.ts`; `vitest.config.ts` runs `src/**/*.test.ts` and `scripts/**/*.test.ts` in Node.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Write the components and the Sorting example (the spec's Spike section describes what was proven): `data.ts` with `Order` and 200 seeded `orders`; columns `id`, `customer` (sortable, flex), `city` (sortable), `total` (sortable, end-aligned, a framework custom cell rendering `<strong>{total.toFixed(2)}</strong>`), initial sorting `[{ id: 'total', desc: true }]`, controlled, and a `Sorted by: <output>` line showing `"<id> ascending|descending"` or `nothing` (the HTML flavour sets it initially too). Islands use `client:visible`. `sorting.mdx` has `since: '0.1'` and one `<FlavourTabs example="sorting/basic">`.
- [ ] **Step 6:** Run `pnpm nx run docs:build`. Expected: `dist/features/sorting/index.html` exists. Temporarily remove the `vue` slot from `sorting.mdx` and build again: expected FAIL with `FlavourTabs sorting/basic: missing the vue flavour`; restore it.
- [ ] **Step 7:** Commit: `feat(docs): four-flavour examples from raw sources; the Sorting page`.

### Task 3: Release badges

**Files:**

- Create: `apps/docs/src/lib/since.ts`, `apps/docs/src/lib/since.test.ts`, `apps/docs/src/components/Since.astro`, `apps/docs/src/components/PageTitle.astro` (Starlight component override)
- Modify: `apps/docs/astro.config.mjs` (`components: { PageTitle: './src/components/PageTitle.astro' }`), `apps/docs/src/components/FlavourTabs.astro` (renders `<Since>` when given `since`)

**Interfaces:**

- Produces: `releaseBadge(since: string, released: string): { text: string; upcoming: boolean }`; `Since.astro` props `{ since: string }` (reads `released` from `packages/table/package.json` at build time). Pages use `<Since since="1.4" />` for sections.

- [ ] **Step 1: Write the failing tests** in `since.test.ts`:

```ts
test('a released version says since', () => {
  expect(releaseBadge('1.3', '1.3.0')).toEqual({ text: 'Since 1.3', upcoming: false });
  expect(releaseBadge('0.1', '1.3.0')).toEqual({ text: 'Since 0.1', upcoming: false });
});
test('a newer version says coming', () => {
  expect(releaseBadge('1.4', '1.3.0')).toEqual({ text: 'Coming in 1.4', upcoming: true });
  expect(releaseBadge('2.0', '1.12.3')).toEqual({ text: 'Coming in 2.0', upcoming: true });
});
test('compares numerically, not as text', () => {
  expect(releaseBadge('1.10', '1.9.0').upcoming).toBe(true);
});
```

- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement `releaseBadge` (compare major, then minor, as numbers) and the components; `PageTitle.astro` renders Starlight's default title plus `<Since>` when the entry has `since`. Upcoming badges use Starlight's `Badge` with `variant="caution"`, released ones `variant="note"`.
- [ ] **Step 4:** Run the tests and `pnpm nx run docs:build`. Expected: PASS; the Sorting page's HTML contains `Since 0.1`.
- [ ] **Step 5:** Commit: `feat(docs): since badges on pages, sections and examples`.

### Task 4: The completeness check

**Files:**

- Create: `apps/docs/scripts/check-examples.mjs`, `apps/docs/scripts/check-examples.test.ts`, fixtures under `apps/docs/scripts/fixtures/{good,missing-flavour,unused,dangling}/`
- Modify: `apps/docs/package.json` (`lint`: `eslint . && node scripts/check-examples.mjs`)

**Interfaces:**

- Produces: `checkExamples(root: string): string[]` (exported; empty when all is well) and a CLI that prints each problem and exits 1 when any. `root` is an `apps/docs`-like folder with `src/examples` and `src/content/docs/features`.
- Rules (one message each, exact text):
  - `src/examples/<f>/<e>: missing the <flavour> flavour` when `html/index.html`, `html/main.js`, `react/*.tsx`, `vue/*.vue` or `angular/*.component.ts` is missing (exactly one component file per framework folder; more → `src/examples/<f>/<e>/<flavour>: more than one component`).
  - `src/examples/<f>/<e>: not used on any feature page` when no file in `src/content/docs/features/` contains `example="<f>/<e>"`.
  - `<page>: example "<f>/<e>" does not exist` for a `FlavourTabs` naming a missing folder.

- [ ] **Step 1: Write the failing tests:** `checkExamples(fixtures/good)` → `[]`; `missing-flavour` (no `vue/`) → `['src/examples/sorting/basic: missing the vue flavour']`; `unused` → `['src/examples/sorting/extra: not used on any feature page']`; `dangling` → `['src/content/docs/features/sorting.mdx: example "sorting/gone" does not exist']`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement with `node:fs` only (the script runs before any build).
- [ ] **Step 4:** Run the tests, then `pnpm nx run docs:lint` on the real site. Expected: PASS, no problems.
- [ ] **Step 5:** Commit: `feat(docs): CI checks every feature example has all four flavours`.

### Task 5: Type-check each flavour with its framework's checker

**Files:**

- Create: `apps/docs/tsconfig.vue.json`, `apps/docs/tsconfig.angular.json`
- Modify: `apps/docs/tsconfig.json` (React and HTML: `jsx: react-jsx`, `checkJs: true` for `src/examples/**/html/*.js`; exclude `**/vue/**`, `**/angular/**`), `apps/docs/package.json` (`typecheck`: `astro check && tsc -p tsconfig.json --noEmit && vue-tsc -p tsconfig.vue.json --noEmit && ngc -p tsconfig.angular.json`), `apps/docs/astro.config.mjs` (Angular integration reads `tsconfig.angular.json`)

**Interfaces:**

- `tsconfig.angular.json`: includes `src/examples/**/angular/*.ts`; `angularCompilerOptions: { strictTemplates: true, strictInjectionParameters: true }`; `outDir: node_modules/.cache/docs-ngc` (as `packages/angular`'s `tsconfig.types.json` does).

- [ ] **Step 1:** Add the configs and the script. Run `pnpm nx run docs:typecheck`. Expected: PASS.
- [ ] **Step 2: Negative checks** (each made temporarily, then reverted): an unknown prop on `<ArgusTable>` in `Sorting.vue` → `vue-tsc` fails; `row.totl` in the Angular template → `ngc` fails; `table.sortng = []` in `main.js` → `tsc` fails (needs `main.js` to type `table` via `/** @type {import('argus-table').ArgusTable<import('../../data').Order>} */`). Expected: each fails, naming the file.
- [ ] **Step 3:** Commit: `feat(docs): type-check examples with tsc, vue-tsc and ngc`.

### Task 6: Playwright harness with axe, in the e2e matrix

**Files:**

- Create: `apps/docs/e2e/playwright.config.ts`, `apps/docs/e2e/flavours.ts`, `apps/docs/e2e/sorting.spec.ts`, `apps/docs/e2e/tabs.spec.ts`, `apps/docs/tsconfig.e2e.json`
- Modify: `apps/docs/package.json` (`e2e`: `playwright test -c e2e/playwright.config.ts`; `nx.targets.e2e.dependsOn: ['build']`; devDependency `@axe-core/playwright`), `.github/workflows/ci.yml` (the e2e job also uploads `apps/docs/test-results` and `apps/docs/playwright-report`)

**Interfaces:**

- Consumes: `data-example`, `data-flavour` from Task 2; base `/argus-table`.
- Produces (in `flavours.ts`):
  - `FLAVOURS` re-exported from `../src/lib/sources`.
  - `openFlavour(page: Page, example: string, flavour: Flavour): Promise<Locator>`: clicks the flavour's tab (`getByRole('tab', { name })`, names `HTML`, `React`, `Vue`, `Angular`), waits for `argus-table [role="row"][aria-rowindex="2"]` inside `[data-example="…"][data-flavour="…"]`, returns that container.
  - `expectAccessible(page: Page, container: Locator): Promise<void>`: axe on the container (`AxeBuilder.include()`), WCAG 2.2 A/AA tags, expects `violations` to equal `[]`.
- Config: same `BROWSERS` handling as `tests/e2e/playwright.config.ts`; `baseURL: 'http://localhost:4321/argus-table/'`; `webServer` runs `pnpm --filter @argus-table/docs preview`.

- [ ] **Step 1: Write the specs.** `sorting.spec.ts`: one page load; for each flavour in order: `openFlavour`, read `output` (`total descending`), click the `customer` header, expect `output` to read `customer ascending` and the first body row's customer cell to be `Customer 1`, expect the custom total cell to render a `strong` (React, Vue, Angular), `expectAccessible`. `tabs.spec.ts`: choose `Vue` on the Sorting page, reload: the Vue tab is selected.
- [ ] **Step 2:** Run `BROWSERS=chromium pnpm nx run docs:e2e`. Expected: PASS (the build runs first). If a flavour fails, it fails by name.
- [ ] **Step 3:** Run `BROWSERS=all pnpm nx run docs:e2e`. Expected: PASS in Chromium, Firefox and WebKit.
- [ ] **Step 4:** Commit: `test(docs): Playwright and axe for every flavour, in the e2e matrix`.

### Task 7: The site's look and the tables' theme

**Files:**

- Create: `apps/docs/src/styles/site.css`, `apps/docs/src/components/Head.astro`, `apps/docs/e2e/theme.spec.ts`
- Modify: `apps/docs/astro.config.mjs` (`customCss: ['@argus-table/themes/default.css', './src/styles/site.css']`, `components: { Head: './src/components/Head.astro' }`)

**Interfaces:**

- `site.css` sets Starlight's accent variables (`--sl-color-accent`, `-low`, `-high`) from the logo's blue `#168FEF` and violet `#873CF2`, for `:root` and `:root[data-theme='light']`.
- The tables follow the site's light or dark mode through the theme's documented hook, `data-argus-theme` on an ancestor (`packages/themes/src/default.css`), not through `color-scheme` in `site.css` (the theme's comment explains why: a `light-dark()` polyfill only switches where the same stylesheet sets `color-scheme`). A small inline script in a Starlight `Head` override (`src/components/Head.astro`) mirrors `<html data-theme>` into `<html data-argus-theme>`, on load and on change (`MutationObserver`).

- [ ] **Step 1: Write `theme.spec.ts`:** on the Sorting page with React open, set the theme to dark through Starlight's theme select (`starlight-theme-select` select, value `dark`); expect the table's computed `background-color` (its `[part~="table"]`) to have a lightness below 0.3 (parse `rgb()`); set light, expect above 0.8.
- [ ] **Step 2:** Run it. Expected: FAIL before `site.css`.
- [ ] **Step 3:** Add the CSS and the `Head` override. Run `BROWSERS=all pnpm nx run docs:e2e`. Expected: PASS.
- [ ] **Step 4:** Commit: `feat(docs): argus-table's colours, logo and theme on the site`.

### Task 8: Hand-off note for the next plans

**Files:**

- Modify: `apps/docs/README.md` (how to add a feature page: the folder layout, `FlavourTabs`, `since`, the spec helpers, the commands), `CLAUDE.md` (`apps/docs` entry: pointers to the README, the four-flavour rule, the commands)

- [ ] **Step 1:** Write both. Run Prettier on them. Expected: clean.
- [ ] **Step 2:** Run the whole set: `pnpm nx run-many -t lint typecheck test build e2e -p docs` with `BROWSERS=all`. Expected: PASS.
- [ ] **Step 3:** Commit: `docs(docs): how to add a feature page`.
