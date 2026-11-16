# Docs Site API Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The docs site gets an API reference generated at build time: one page per element (`<argus-table>`, `<argus-column>`, `<argus-column-group>`) and one page of the public types, so it can't drift from the code.

**Architecture:** Two pure readers in `apps/docs/src/lib/api/` turn sources into page models: `elements.ts` reads `argus-table/custom-elements.json` through the wrapper generator's `readElement()` (so binding names are the ones the wrappers really have) plus the manifest's parts, tokens, slots and method signatures; `types.ts` reads the types `argus-table` exports with the TypeScript compiler API, from source. Astro pages in `src/pages/api/` render the models inside `StarlightPage`, descriptions through Astro's Markdown processor, type texts linked to the types page.

**Tech Stack:** Astro 7 + Starlight 0.43 (`StarlightPage`), TypeScript 6 compiler API (`typescript`, already a dev dependency), `@astrojs/markdown-remark`, Vitest (Node), Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-11-16-docs-site-design.md` ("API reference", "Release badges"). Plans 1 and 2 (`docs/superpowers/plans/2026-11-16-docs-site-foundation.md`, `…-feature-pages.md`) built `apps/docs` and every feature page; read `apps/docs/README.md` first.

## Global Constraints

- "Generated at build time from `packages/table/dist/custom-elements.json` (properties, attributes, events, methods, parts, tokens, slots) and from core's public types, so it can't drift."
- "Wrapper binding names (React props, Vue events and `v-model`, Angular inputs and outputs) come from the same data the wrapper generator uses (`tools/generate-wrappers`)."
- "The API reference is not marked per member (no `@since` tags in the packages). Its page says it documents `main`, and links the changelogs."
- The site isn't deployed yet (plan 7); CI builds it on PRs. One PR for this plan, branch `docs/site-api`, label `no-changeset` (no published package changes: `tools/generate-wrappers` is private).
- Work in the scratchpad Linux copy (`$S/sync.sh`, `. $S/env.sh`), never `pnpm install` in the mounted repo; copy `pnpm-lock.yaml` back after an install; `pnpm exec prettier --check .` before every push.

## Review Focus

- **JSDoc with Markdown** (code spans, links, lists, line breaks inside a paragraph): rendered as Markdown, not shown raw. Pinned in Task 3's `renderDoc` tests.
- **Type texts with `<`, `>`, `|`, `=>`, `&`**: escaped, and still linked where they name a public type (`readonly ColumnDef<T>[]` links `ColumnDef`, not `T`). Pinned in Task 3's `linkTypes` tests.
- **A member without a description or type** (the manifest omits `description` for some members): renders `—`, never `undefined`. Pinned in Task 1's tests.
- **A public type that is an alias of a core interface** (`ColumnDef<T, TContent> = CoreColumnDef<T, TContent>`): documented with the core interface's members under the public name, not as a one-line alias. Pinned in Task 2's tests.
- **Long type texts on a narrow screen**: they wrap inside their cell instead of widening the page. Pinned in Task 4's e2e (no horizontal page overflow at 390 px).

---

### Task 1: Element reference model

**Files:**

- Modify: `tools/generate-wrappers/package.json` (add `"exports": { "./manifest": "./src/manifest.ts" }`)
- Modify: `apps/docs/package.json` (devDependency `"@argus-table/generate-wrappers": "workspace:*"`)
- Create: `apps/docs/src/lib/api/elements.ts`
- Test: `apps/docs/src/lib/api/elements.test.ts`

**Interfaces:**

- Consumes: `readElement(manifest: Manifest, tag: Tag): ElementInfo`, `Manifest`, `Tag` from `@argus-table/generate-wrappers/manifest`.
- Produces:

  ```ts
  export const ELEMENT_TAGS: readonly Tag[]; // ['argus-table', 'argus-column', 'argus-column-group']
  export interface PropertyRef {
    name: string;
    attribute?: string;
    type: string;
    description: string;
    react: string; // the prop: same as name
    vue: string; // `:column-sizing` or `v-model:column-sizing`
    angular: string; // `[columnSizing]` or `[(columnSizing)]`
  }
  export interface EventRef {
    name: string;
    type: string;
    description: string;
    react: string;
    vue: string /* '@sorting-change' */;
    angular: string /* '(sortingChange)' */;
    from?: string; // the add-on package for add-on events
  }
  export interface MethodRef {
    name: string;
    signature: string;
    description: string;
  }
  export interface NamedDoc {
    name: string;
    description: string;
    default?: string;
  }
  export interface ElementRef {
    tag: Tag;
    className: string;
    description: string;
    properties: PropertyRef[];
    events: EventRef[];
    methods: MethodRef[];
    slots: NamedDoc[];
    parts: NamedDoc[];
    tokens: NamedDoc[];
  }
  export function elementReference(manifest: unknown, tag: Tag): ElementRef;
  ```

  `signature` is `name(param: Type, param = default: Type): Return`, built from the manifest's `parameters` and `return`. `description` of a missing doc is `''` (the page shows `—`, Task 4).

- [ ] **Step 1: Write the failing tests** in `elements.test.ts`, against a fixture manifest written in the test (one `argus-table` declaration with: a field `columnSizing` with attribute-less type `ColumnSizingState | undefined`, a field `density` with attribute `density`, events `argus-column-sizing-change` (`CustomEvent<ColumnSizingChangeDetail>`) and `argus-row-click`, a method `scrollToRow` with parameters `target: RowTarget` and `options = {}: ScrollToRowOptions` returning `Promise<boolean>`, a member without `description`, one slot, one part, one token with `default`):
  - `test('properties carry their bindings in each wrapper')`: `columnSizing` → `{ react: 'columnSizing', vue: 'v-model:column-sizing', angular: '[(columnSizing)]' }`; `density` → `{ attribute: 'density', vue: ':density', angular: '[density]' }`.
  - `test('events carry their names in each wrapper')`: `argus-row-click` → `{ react: 'onRowClick', vue: '@row-click', angular: '(rowClick)' }`; add-on events from `ADDON_EVENTS` have `from` set.
  - `test('methods get a signature')`: `'scrollToRow(target: RowTarget, options = {}: ScrollToRowOptions): Promise<boolean>'`.
  - `test('slots, parts and tokens keep their docs and defaults')`: the token's `default` comes through.
  - `test('a member without a description has an empty one')`: `description` is `''`.
  - `test('the real manifest reads for every element')`: `elementReference` on `argus-table/custom-elements.json` (import it) for each of `ELEMENT_TAGS` returns properties, and `argus-table` has more than 20 parts.

- [ ] **Step 2: Run them and see them fail.** In the copy: `pnpm install --offline`, then `pnpm --filter @argus-table/docs exec vitest run src/lib/api` (after `pnpm nx build argus-table`). Expected: FAIL, `elements.ts` missing.

- [ ] **Step 3: Implement `elementReference()`** in `elements.ts`: `readElement()` for properties, events (names from `ElementEvent.react/vue/angular`) and models (a property in `models` gets `v-model:`/`[( )]`); the raw declaration (found by `tagName`) for the class description, method parameters and return types, slots, `cssParts` and `cssProperties`. Vue property bindings use the kebab-case of the name.

- [ ] **Step 4: Run the tests and see them pass.** Same command. Expected: PASS. Also `pnpm nx run-many -t lint typecheck -p docs generate-wrappers`.

- [ ] **Step 5: Commit** `feat(docs): element reference model from the manifest`.

### Task 2: Types reference model

**Files:**

- Create: `apps/docs/src/lib/api/types.ts`
- Test: `apps/docs/src/lib/api/types.test.ts`

**Interfaces:**

- Produces:

  ```ts
  export interface TypeMember {
    name: string;
    optional: boolean;
    type: string;
    description: string;
  }
  export interface TypeRef {
    name: string; // the exported name, e.g. 'ColumnDef'
    kind: 'interface' | 'type';
    typeParameters: string; // '<T = unknown, TContent = CellContent>' or ''
    description: string;
    members: TypeMember[]; // interfaces, and aliases of an interface
    definition?: string; // other aliases: the type text, e.g. "'asc' | 'desc'"
  }
  export function readTypes(entry: string, tsconfig: string): TypeRef[];
  ```

  `entry` is the module whose exports are documented (`packages/table/src/index.ts`), `tsconfig` the config to compile it with (`packages/table/tsconfig.json`). Only type-only exports (interfaces and type aliases) are listed, sorted by name. An alias whose type is a reference to an interface (`CoreColumnDef<T, TContent>`) is documented with that interface's members and its own name and type parameters. Member types are printed as written in the source (`declaration.type.getText()`), descriptions from JSDoc (`ts.getJSDocCommentsAndTags` / `symbol.getDocumentationComment`), `@param`-style tags dropped.

- [ ] **Step 1: Write the failing tests** in `types.test.ts` with fixture sources in a temp folder (as `scripts/check-examples.test.ts` does): `core.ts` with `/** A row's column. */ export interface CoreDef<T, C = unknown> { /** Stable key. */ id: string; header?: C | ((t: boolean) => C); }` and `export type Sort = 'asc' | 'desc';`; `index.ts` with `import type { CoreDef } from './core.js'; export type Def<T = unknown, C = string> = CoreDef<T, C>; export type { Sort } from './core.js'; export const notAType = 1; interface Private { x: number }`; and a `tsconfig.json`.
  - `test('documents an alias of an interface with its members')`: `Def` has `kind: 'interface'`, `typeParameters: '<T = unknown, C = string>'`, description `"A row's column."`, members `id` (`type: 'string'`, `optional: false`, description `'Stable key.'`) and `header` (`optional: true`, `type: 'C | ((t: boolean) => C)'`).
  - `test('documents other aliases by their definition')`: `Sort` has `definition: "'asc' | 'desc'"` and no members.
  - `test('lists only exported types, sorted')`: names are `['Def', 'Sort']`.
  - `test('the real argus-table types include ColumnDef and DataSource')`: `readTypes` on the repo's `packages/table/src/index.ts`; `ColumnDef` has a member `accessor`; every name in the `export type { … }` list of `packages/table/dist/index.d.ts` is there (read the list with a regex).

- [ ] **Step 2: Run them and see them fail.** `pnpm --filter @argus-table/docs exec vitest run src/lib/api/types.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `readTypes()`** with `ts.createProgram([entry], parsed tsconfig options)`, `checker.getExportsOfModule()`, following aliases (`checker.getAliasedSymbol`) to the declaration.

- [ ] **Step 4: Run the tests and see them pass,** plus lint and typecheck for `docs`.

- [ ] **Step 5: Commit** `feat(docs): types reference model from the sources`.

### Task 3: Rendering helpers

**Files:**

- Modify: `apps/docs/package.json` (dependency `@astrojs/markdown-remark`, the version `astro` depends on)
- Create: `apps/docs/src/lib/api/render.ts`
- Test: `apps/docs/src/lib/api/render.test.ts`

**Interfaces:**

- Produces:

  ```ts
  export function renderDoc(markdown: string): Promise<string>; // HTML; '' for ''
  export function linkTypes(
    type: string,
    known: ReadonlySet<string>,
    href: (name: string) => string,
  ): string; // escaped HTML
  export function anchorOf(name: string): string; // 'ColumnDef' → 'columndef'
  ```

  `renderDoc` uses one `createMarkdownProcessor()` instance (created on first use). `linkTypes` HTML-escapes the text and wraps each whole-word occurrence of a known type name in `<a href="…">`; the row type parameter `T` and names not in `known` stay plain.

- [ ] **Step 1: Write the failing tests:**
  - `test('renders code spans, links and lists')`: ``renderDoc('Use `sorting`. See [ADR](https://x.y).\n\n- a\n- b')`` contains `<code>sorting</code>`, `<a href="https://x.y">ADR</a>` and `<li>a</li>`.
  - `test('an empty doc renders nothing')`: `renderDoc('')` is `''`.
  - `test('escapes type text and links known types')`: `linkTypes('readonly ColumnDef<T>[] | undefined', new Set(['ColumnDef']), (n) => '/api/types/#' + anchorOf(n))` is `'readonly <a href="/api/types/#columndef">ColumnDef</a>&lt;T&gt;[] | undefined'`.
  - `test('leaves unknown names and T alone')`: `linkTypes('(row: T) => Node', new Set(['ColumnDef']), …)` is `'(row: T) =&gt; Node'`.

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run and see them pass** (lint and typecheck too).
- [ ] **Step 5: Commit** `feat(docs): markdown and type links for the API reference`.

### Task 4: The pages

**Files:**

- Create: `apps/docs/src/pages/api/index.astro`, `apps/docs/src/pages/api/[tag].astro`, `apps/docs/src/pages/api/types.astro`
- Create: `apps/docs/src/components/api/RefTable.astro` (a table of name / details / description rows, used by every section)
- Modify: `apps/docs/astro.config.mjs` (sidebar group "API reference": Overview, `<argus-table>`, `<argus-column>`, `<argus-column-group>`, Types)
- Modify: `apps/docs/src/styles/site.css` (type cells wrap: `overflow-wrap: anywhere`)
- Modify: `apps/docs/README.md` (a line under "How it fits together")
- Test: `apps/docs/e2e/api.spec.ts`

**Interfaces:**

- Consumes: `elementReference`, `ELEMENT_TAGS` (Task 1), `readTypes` (Task 2), `renderDoc`, `linkTypes`, `anchorOf` (Task 3).
- Pages are wrapped in `StarlightPage` (`@astrojs/starlight/components/StarlightPage.astro`) with `frontmatter.title`. `[tag].astro`'s `getStaticPaths` returns `ELEMENT_TAGS`; its sections, in order: the class description, Properties (columns: name with attribute, React / Vue / Angular binding, type, description), Events (name, React / Vue / Angular, detail type, description, "from `@argus-table/…`" for add-on events), Methods (signature, description), Slots, Parts, Tokens (name, default, description). Each row has an `id`, `` `${section}-${name.toLowerCase()}` `` with `section` one of `property`, `event`, `method`, `slot`, `part`, `token` (`property-columnsizing`, `event-argus-sorting-change`, `token---argus-fg`), so it can be linked. Empty sections are left out; empty descriptions show `—`.
- `types.astro` lists every `TypeRef` with an `h2` whose `id` is `anchorOf(name)`, its description, type parameters, and its members as a table (or its definition). A note says the wrappers widen content types (`ReactColumnDef`, `VueColumnDef`, `AngularColumnDef`).
- `index.astro` says the reference documents `main`, generated from the sources, and links each package's `CHANGELOG.md` on GitHub (`main`): `argus-table`, the three wrappers, the four add-ons, `@argus-table/themes`.
- Paths: the manifest is imported as `argus-table/custom-elements.json`; `readTypes` gets absolute paths built from `fileURLToPath(new URL('../../../../packages/table/…', import.meta.url))` resolved at build time in the page's frontmatter, or from `process.cwd()` (the docs folder when Astro builds); use whichever survives `astro build` (Task 4 Step 3 checks it).

- [ ] **Step 1: Write the failing e2e spec** `api.spec.ts` (no flavours: one test per page):
  - `test('the element page lists bindings in every wrapper')`: `/api/argus-table/`: the row `#property-columnsizing` contains `v-model:column-sizing` and `[(columnSizing)]`; `#event-argus-sorting-change` contains `onSortingChange`, `@sorting-change` and `(sortingChange)`; `#token---argus-fg` contains `CanvasText`; the `columnSizing` type links to `/argus-table/api/types/#columnsizingstate`; axe passes on `main`.
  - `test('the types page documents ColumnDef')`: `/api/types/`: `#columndef` exists, and its table has a row for `accessor`; axe passes.
  - `test('the overview says it documents main and links the changelogs')`: `/api/` contains "main" and nine links ending in `CHANGELOG.md`.
  - `test('long types wrap on a narrow screen')`: at 390×844, `/api/argus-table/` has `document.documentElement.scrollWidth <= 390`.
- [ ] **Step 2: Run it and see it fail** (`BROWSERS=chromium pnpm nx run docs:e2e -- e2e/api.spec.ts --workers=3`).
- [ ] **Step 3: Implement the pages,** then `pnpm nx run-many -t lint typecheck test build -p docs`.
- [ ] **Step 4: Run the spec in all engines** (`BROWSERS=all … --workers=3`) and the whole docs e2e.
- [ ] **Step 5: Commit** `docs(site): generated API reference`.

- [ ] **Plan done:** a fresh reviewer reads the branch (as in plan 2's batches), fixes, then push `docs/site-api`, open the PR with `--label no-changeset`, merge when green.
