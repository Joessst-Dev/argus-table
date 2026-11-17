# Docs site: migration guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The docs site renders the integrate skill's migration guides (`skills/argus-table-integrate/references/migrate/*.md` and `gaps.md`) as a Migration section, from the files as they are.

**Architecture:** An Astro content collection with the `glob` loader reads the files where they live. A remark plugin, run on those files only, drops each file's own `# ` title (the page shows it) and rewrites relative links: to the site for rendered files, to GitHub (`main`) for the rest, anchors kept, a link to a missing file failing the build. A dynamic page renders each guide in `StarlightPage` with a note about the skill; an overview page explains the `fit` values and lists the guides; the sidebar group is built from the same list, so a new guide needs no site change.

**Tech Stack:** Astro 7.4 content layer (`glob` loader), Starlight 0.43 (`StarlightPage`, `Aside`), a hand-written remark transformer (no new dependencies), Vitest (Node), Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-11-16-docs-site-design.md`, "Migration guides: one source" (and "Site structure": Migration).

## Global Constraints

- The site renders `skills/argus-table-integrate/references/migrate/*.md` and `gaps.md` **unchanged**: no edits to those files for the site's sake; the skill's tests (`nx test skills`) keep passing untouched.
- "They stay agent-first; the site adds a title and a short note that the guide also serves the integrate skill."
- Links between rendered files resolve on the site; links to references the site doesn't render (some written without `../`) go to the file on GitHub, `https://github.com/Joessst-Dev/argus-table/blob/main/<repo path>`, anchors kept.
- The site's `base` is `/argus-table`; site links carry it (`/argus-table/migration/gaps/#pagination`).
- No new npm dependencies (so no lockfile change).
- Docs-only: the PR gets the `no-changeset` label.
- Existing conventions: `.js`-free relative TS imports inside `apps/docs` as the API reference does; Prettier over the whole repo (`pnpm exec prettier --check .`) before push.

## Review Focus

1. **A link to a file that doesn't exist** (a renamed reference): the build fails naming the guide and the link, instead of shipping a dead link. → Task 1, `rewriteHref` test "throws for a missing file".
2. **A new guide dropped into `migrate/`**: it gets a page and a sidebar entry with no site change; a file without a `# ` first line, or named `index.md` / `gaps.md`, fails with its name. → Task 1, `migrationGuides` fixture tests.
3. **Links written without `../`** (`gaps.md` → `server-data.md`) and links from `gaps.md` to a guide resolve like the others. → Task 1, `rewriteHref` tests; Task 2, e2e "links to other references go to GitHub".
4. **Every site anchor a guide links to exists** on its target page (heading slugs as Astro makes them). → Task 2, e2e "every link into the section lands on an element".
5. **Wide concept tables on a phone**: they scroll inside themselves; the page doesn't scroll sideways, and axe passes. → Task 2, e2e "a guide fits a narrow viewport".

---

### Task 1: The guides list, link rewriting and the remark plugin

**Files:**

- Create: `apps/docs/src/lib/migration.ts`
- Test: `apps/docs/src/lib/migration.test.ts`

**Interfaces:**

- Produces (all exported from `src/lib/migration.ts`):
  - `REFERENCES = 'skills/argus-table-integrate/references'` (repo-relative, posix)
  - `GITHUB_BLOB = 'https://github.com/Joessst-Dev/argus-table/blob/main/'`
  - `interface Guide { id: string; title: string; label: string; file: string }`. `id`: the file's base name (`tanstack`, `gaps`); `file`: repo-relative path (`skills/argus-table-integrate/references/migrate/tanstack.md`); `title`: the first line's text after `# `, backticks removed (`From Vuetify v-data-table`); `label`: the title without a leading `From `, first letter upper-cased (`Vuetify v-data-table`, `A plain <table>`); for `gaps.md` title and label are `Gaps`.
  - `migrationGuides(repoRoot: string): Guide[]`: the `migrate/*.md` guides sorted by `label` (`localeCompare`), then `gaps`. Synchronous (`node:fs`), so `astro.config.mjs` can call it.
  - `guidePath(guide: Guide, base: string): string` → `${base}/migration/${id}/`.
  - `rewriteHref(href: string, from: string, context: { guides: readonly Guide[]; base: string; exists: (repoPath: string) => boolean }): string`, `from` being the repo-relative path of the file the link is in.
  - `remarkMigration(options: { repoRoot: string; base: string }): (tree: MdNode, file: { path?: string }) => void`, a unified plugin (attacher returning a transformer). `MdNode` is a minimal local type `{ type: string; depth?: number; url?: string; children?: MdNode[] }` (no `@types/mdast` dependency).

- [ ] **Step 1: Write the failing tests** (`migration.test.ts`; the real files come from the repo root `fileURLToPath(new URL('../../../../', import.meta.url))`, fixtures from a `mkdtempSync` dir with a `skills/argus-table-integrate/references/{migrate,}` tree, as `types.test.ts` does):

```ts
describe('migrationGuides', () => {
  test('lists the real guides by label, gaps last', () => {
    const guides = migrationGuides(repo);
    expect(guides.map((g) => g.id)).toEqual([
      'html-table',
      'ag-grid',
      'angular-material',
      'antd',
      'element-plus',
      'mui-x',
      'primeng-primevue',
      'tanstack',
      'vuetify',
      'gaps',
    ]);
    expect(guides.find((g) => g.id === 'tanstack')).toEqual({
      id: 'tanstack',
      title: 'From TanStack Table',
      label: 'TanStack Table',
      file: 'skills/argus-table-integrate/references/migrate/tanstack.md',
    });
    expect(guides.find((g) => g.id === 'vuetify')?.title).toBe('From Vuetify v-data-table');
    expect(guides[0]?.label).toBe('A plain <table>');
    expect(guides.at(-1)).toMatchObject({ id: 'gaps', title: 'Gaps', label: 'Gaps' });
  });
  test(
    'a new file in migrate/ is a new guide' /* fixture with migrate/foo.md "# From Foo Grid" + gaps.md → ids ['foo', 'gaps'] */,
  );
  test('a guide without a "# " first line fails, naming it' /* throws /migrate\/bad\.md/ */);
  test('a guide named index or gaps fails' /* migrate/index.md → throws /index\.md/ */);
});

describe('rewriteHref', () => {
  const from = 'skills/argus-table-integrate/references/migrate/tanstack.md';
  const context = { guides: migrationGuides(repo), base: '/argus-table', exists: () => true };
  test('a rendered file goes to its page, anchor kept', () => {
    expect(rewriteHref('../gaps.md#pagination', from, context)).toBe(
      '/argus-table/migration/gaps/#pagination',
    );
    expect(rewriteHref('../gaps.md', from, context)).toBe('/argus-table/migration/gaps/');
    expect(
      rewriteHref('migrate/ag-grid.md', 'skills/argus-table-integrate/references/gaps.md', context),
    ).toBe('/argus-table/migration/ag-grid/');
  });
  test('another file goes to GitHub, anchor kept', () => {
    expect(rewriteHref('../addons.md#cell-editing-argus-tableediting', from, context)).toBe(
      'https://github.com/Joessst-Dev/argus-table/blob/main/skills/argus-table-integrate/references/addons.md#cell-editing-argus-tableediting',
    );
  });
  test('a link written without ../ resolves from its own folder', () => {
    expect(
      rewriteHref('server-data.md', 'skills/argus-table-integrate/references/gaps.md', context),
    ).toBe(
      'https://github.com/Joessst-Dev/argus-table/blob/main/skills/argus-table-integrate/references/server-data.md',
    );
  });
  test('URLs, mailto and same-page anchors are left alone', () => {
    for (const href of ['https://ag-grid.com/', 'mailto:a@b.c', '#concepts'])
      expect(rewriteHref(href, from, context)).toBe(href);
  });
  test('throws for a missing file', () => {
    expect(() => rewriteHref('../nope.md#x', from, { ...context, exists: () => false })).toThrow(
      "migrate/tanstack.md links to ../nope.md, which doesn't exist",
    );
  });
});

describe('remarkMigration', () => {
  // A hand-built mdast tree: heading depth 1, a paragraph with a link, a definition.
  test(
    'drops the title and rewrites links in a guide' /* file.path = <repo>/…/migrate/tanstack.md; afterwards no depth-1 heading, link.url and definition.url rewritten */,
  );
  test(
    'leaves other markdown alone' /* file.path = <repo>/apps/docs/src/content/docs/index.mdx: tree unchanged */,
  );
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @argus-table/docs exec vitest run src/lib/migration.test.ts`
Expected: FAIL, `migration.ts` doesn't exist.

- [ ] **Step 3: Implement `src/lib/migration.ts`**

`rewriteHref`: a href with a scheme (`/^[a-z][a-z+.-]*:/i`) or starting with `#` or `/` is returned as is; else split off `#hash`, `posix.normalize(posix.join(posix.dirname(from), path))`, throw `Error(`${from} links to ${path}, which doesn't exist`)` unless `exists(resolved)`, then a guide whose `file` equals it → `guidePath(guide, base) + hash`, else `GITHUB_BLOB + resolved + hash`. `remarkMigration` acts only when `file.path`, made repo-relative with `/` separators, starts with `REFERENCES + '/'` and is a guide's `file`: it removes the first `heading` of depth 1 from the root's children and walks the tree rewriting `url` on `link` and `definition` nodes, with `exists` = `existsSync(join(repoRoot, p))`. It reads the guides once per attacher call.

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm --filter @argus-table/docs exec vitest run src/lib/migration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/src/lib/migration.ts apps/docs/src/lib/migration.test.ts
git commit -m "docs(site): read and link the migration guides"
```

### Task 2: The Migration section: collection, pages, sidebar, specs

**Files:**

- Modify: `apps/docs/src/content.config.ts` (a `migration` collection)
- Modify: `apps/docs/astro.config.mjs` (remark plugin, sidebar group)
- Create: `apps/docs/src/pages/migration/[guide].astro`, `apps/docs/src/pages/migration/index.astro`
- Modify: `apps/docs/package.json` (Nx: `implicitDependencies`, build input)
- Create: `apps/docs/e2e/migration.spec.ts`
- Modify: `apps/docs/README.md`, `CLAUDE.md` (the `apps/docs` and `skills/` bullets)

**Interfaces:**

- Consumes: `migrationGuides`, `guidePath`, `remarkMigration`, `REFERENCES`, `GITHUB_BLOB` from Task 1.
- Produces: pages `/argus-table/migration/` and `/argus-table/migration/<id>/` for each `Guide`.

- [ ] **Step 1: Write the failing spec** (`e2e/migration.spec.ts`, axe as in `api.spec.ts`; ids and titles from Task 1's list):

```ts
const GUIDES = {
  'ag-grid': 'From AG Grid',
  'angular-material': 'From Angular Material mat-table',
  antd: 'From Ant Design Table',
  'element-plus': 'From Element Plus el-table',
  'html-table': 'From a plain <table>',
  'mui-x': 'From MUI X Data Grid',
  'primeng-primevue': 'From PrimeNG and PrimeVue DataTable',
  tanstack: 'From TanStack Table',
  vuetify: 'From Vuetify v-data-table',
  gaps: 'Gaps',
};

test(
  'every guide has a page with its title and the skill note' /* for each: goto `migration/${id}/`; main h1 has the title; page has exactly one h1; `main` contains 'argus-table-integrate'; axe */,
);
test(
  'a guide keeps its tables and code' /* tanstack: a table whose header row contains 'Fit'; a code block rendered by Expressive Code ('.expressive-code') containing 'useReactTable' */,
);
test(
  'every link into the section lands on an element' /* for each page: collect hrefs of main a[href*="/migration/"]; for each, goto it and, if it has a #hash, expect(page.locator(`[id="${hash}"]`)).toHaveCount(1) */,
);
test(
  'links to other references go to GitHub' /* tanstack: a[href="https://github.com/Joessst-Dev/argus-table/blob/main/skills/argus-table-integrate/references/server-data.md"] count ≥ 1 and an addons.md#cell-editing-argus-tableediting link; gaps: the server-data.md link has that same href; no main a[href$=".md"] that is not on github.com */,
);
test(
  'the overview explains fit and lists every guide' /* goto 'migration/'; main contains 'maps', 'partial', 'builtin', 'gap' definitions; main has a link to each guide's page (10); the sidebar has a "Migration" group with the overview and 10 guides; axe */,
);
test(
  'a guide fits a narrow viewport' /* setViewportSize 390×844; goto tanstack; document.documentElement.scrollWidth <= innerWidth; axe */,
);
```

- [ ] **Step 2: Run it to see it fail**

Run (in the Linux copy): `BROWSERS=chromium pnpm nx run docs:e2e -- e2e/migration.spec.ts`
Expected: FAIL, the pages 404.

- [ ] **Step 3: The collection** in `content.config.ts`: `migration: defineCollection({ loader: glob({ base: '../../skills/argus-table-integrate/references', pattern: ['migrate/*.md', 'gaps.md'], generateId: ({ entry }) => basename(entry, '.md') }) })`, no schema (the files have no frontmatter).

- [ ] **Step 4: Config** in `astro.config.mjs`: `const base = '/argus-table'` and `const repoRoot` (the existing `__REPO_ROOT__` value) shared by `base`, `vite.define`, `markdown: { remarkPlugins: [[remarkMigration, { repoRoot, base }]] }` and a sidebar group after "API reference": `{ label: 'Migration', items: [{ label: 'Overview', link: '/migration/' }, ...migrationGuides(repoRoot).map((g) => ({ label: g.label, link: `/migration/${g.id}/` }))] }`. Check in the build that the plugin sees `file.path` for the collection's files (if Astro passes none, the guides would show their own h1 twice; the spec's one-h1 check catches it).

- [ ] **Step 5: The guide page** `[guide].astro`: `getStaticPaths` from `getCollection('migration')`, params `{ guide: entry.id }`; title from `migrationGuides(__REPO_ROOT__)` by id (throw if missing); `const { Content, headings } = await render(entry)`; `<StarlightPage frontmatter={{ title, description }} headings={headings}>` with, before `<Content />`, Starlight's `<Aside type="tip" title="Also an agent skill">` saying, verbatim: "This page is also a reference of the `argus-table-integrate` agent skill, which reads it when it migrates an app to argus-table. It's written for both: a table per feature with how well it fits, then the code." and a link "About the skills" to `GITHUB_BLOB + 'skills/README.md'`. `description`: `Migrating to argus-table: ${label}.` (`Features argus-table doesn't have, and what to do instead.` for gaps).

- [ ] **Step 6: The overview** `index.astro` (`StarlightPage`, title `Migration`): one paragraph that each guide maps another table's features to argus-table's, column by column, then the code; a definition list of the fit values, verbatim: **maps**: argus-table has it. **partial**: close, with differences the guide names. **builtin**: argus-table does it already; delete that code. **gap**: no equivalent; [Gaps](…/migration/gaps/) says what to do instead. Then a list of the guides (`migrationGuides`, gaps excluded) linking their pages, and the same skill note as Step 5.

- [ ] **Step 7: Nx** in `apps/docs/package.json`: `"implicitDependencies": ["skills"]` under `nx` (a reference change makes the site affected) and `"{workspaceRoot}/skills/argus-table-integrate/references/**/*.md"` in `build.inputs` (the `production` input excludes `*.md`).

- [ ] **Step 8: Run the spec, the unit tests and the checks** (Linux copy)

Run: `pnpm nx run-many -t lint typecheck test -p docs skills && BROWSERS=all pnpm nx run docs:e2e -- e2e/migration.spec.ts --workers=3`
Expected: all pass; `git diff --stat skills/` empty.

- [ ] **Step 9: Docs**: `apps/docs/README.md`, under "How it fits together": the Migration pages are the integrate skill's `references/migrate/*.md` and `gaps.md`, read in place by the `migration` collection; `remarkMigration` drops their `# ` title and rewrites links (site pages for rendered files, GitHub for the rest; a missing file fails the build); a new guide needs no site change. `CLAUDE.md`: the same in one sentence in the `apps/docs` bullet, and in the `skills/` bullet: the migration references are rendered on the docs site, so each keeps a `# From …` first line and relative links to existing files.

- [ ] **Step 10: Commit**

```bash
git add apps/docs CLAUDE.md
git commit -m "docs(site): migration guides from the integrate skill"
```
