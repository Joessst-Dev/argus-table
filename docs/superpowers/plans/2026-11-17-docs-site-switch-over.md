# Docs site: switch-over Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The docs site replaces Storybook on GitHub Pages: it deploys from `main`, Storybook becomes a PR artifact only, every link and the theme skill point to the site, and old Storybook URLs (story and docs paths, theme-creator share links) land on their new pages.

**Architecture:** `docs.yml` deploys `apps/docs/dist` instead of `apps/storybook/dist`. Old URLs are resolved by one pure function (`oldUrlTarget`, a table from Storybook title ids to site paths), serialized into two tiny inline scripts: a static `iframe.html` (Storybook's story frame, which theme-creator links open) and a script on the site's home page (Storybook's `?path=` URLs land there). The theme skill builds links to `/themes/creator/` with the same `#theme=` hash.

**Tech Stack:** GitHub Actions (Pages), Astro 7.4 endpoints (`src/pages/iframe.html.ts`), Starlight's `Head` override, Vitest, Playwright, `node --test` (skills).

**Spec:** `docs/superpowers/specs/2026-11-16-docs-site-design.md`: "Rollout" ("One switch-over PR: `docs.yml` deploys the site to GitHub Pages; Storybook becomes a PR artifact only; links in the README, the package READMEs, `apps/examples/*/README.md`, `skills/README.md`, `.claude-plugin/marketplace.json` and the theme skill point to the site." / "**Old URLs keep working** after the switch: a static `iframe.html` that redirects theme-creator links (keeping the `#theme=` hash) to the new page, and a small script on the site's root page that maps Storybook `?path=/docs/…` and `?path=/story/…` URLs to their new pages (falling back to the home page)."), "Storybook" ("Keeps running its stories as tests in CI. After the switch it is no longer published: `docs.yml` builds it on PRs and uploads it as an artifact only."), "Theme creator" (share links: `shareLink()` and `themeLink()` / `DEFAULT_BASE_URL` change together, with their tests).

## Global Constraints

- One PR. It deploys on merge: the first `main` build after it replaces Storybook at `https://joessst-dev.github.io/argus-table/`.
- The `#theme=` format doesn't change; a link made before the switch (`…/iframe.html?id=themes-theme-creator--creator&viewMode=story#theme=…`) opens the theme on the new page.
- Storybook keeps running its story tests in CI (`ci.yml` unchanged); `docs.yml` builds it only on pull requests, uploaded as the `storybook` artifact.
- Links that already point at the site root (`https://joessst-dev.github.io/argus-table/`: the README's and packages' "Docs and live examples", `marketplace.json`'s `homepage`, the starters' READMEs) stay as they are: the root is now the site. Only Storybook-specific URLs change.
- `packages/themes/README.md` is published: its link change gets a patch changeset for `@argus-table/themes` (CI checks `changeset status`). The other published READMEs keep their root links (no change, no changeset).
- Prettier over the whole repo before push.

## Review Focus

1. **A theme link from before the switch** (Storybook iframe URL with `#theme=`) opens the theme on `/themes/creator/`, hash intact: → Task 1 spec.
2. **Every Storybook page** (each story file's `title`, and the MDX pages' `<Meta title>`) maps to a page that exists on the site; a title added to Storybook later that isn't mapped falls back to the home page instead of a 404. → Task 1, `old-urls.test.ts` "every Storybook title maps to a page".
3. **A Storybook URL with extra parameters** (`&globals=…`, `&args=…`, `viewMode=docs`) or a different story of a mapped title (`--dark`) lands on the title's page. → Task 1 unit tests.
4. **The home page without `?path=`** never redirects (a reader arriving normally stays put). → Task 1 spec.
5. **The skill's local link** (`--base-url` for a local docs server) builds a creator link under that base, path kept (`http://localhost:4321/argus-table/` → `…/argus-table/themes/creator/#theme=…`). → Task 2, `scripts.test.mjs`.

---

### Task 1: Old URLs land on their new pages

**Files:**

- Create: `apps/docs/src/lib/old-urls.ts` (+ `old-urls.test.ts`), `apps/docs/src/pages/iframe.html.ts`, `apps/docs/e2e/old-urls.spec.ts`
- Modify: `apps/docs/src/components/Head.astro` (the home page's redirect script)

**Interfaces:**

- Produces, `src/lib/old-urls.ts`:
  - `STORYBOOK_PAGES: Readonly<Record<string, string>>`: Storybook title id (the title kebab-cased: `features-auto-width`, `themes-theme-creator`, `add-ons-header-menu`) → site path without base (`features/auto-width/`). Every title in `apps/storybook/stories/**` (41 today): Getting started → `getting-started/`; API → `api/`; Benchmarks → `guides/performance/`; Features/<x> → `features/<x>/`, with Rendering → `getting-started/`, Row selection → `features/selection/`, Column pinning and visibility → `features/column-visibility/`; Add-ons/<x> → `features/<x>/`; Orders (the export stories) → `features/export/`; Styling/Parts, Tokens, Slotted content → `features/styling/`, Styling/Tailwind recipe → `guides/tailwind/`; Themes/Default, Material-inspired, Fluent-inspired, Bootstrap-inspired, Minimal → `themes/default/`, `themes/material/`, `themes/fluent/`, `themes/bootstrap/`, `themes/minimal/`; Themes/Theme creator → `themes/creator/`; Recipes/React, Vue, Angular → `guides/react/`, `guides/vue/`, `guides/angular/`.
  - `oldUrlTarget(href: string, base: string, pages: Readonly<Record<string, string>>): string | undefined`: for a Storybook manager URL (`?path=/docs/<id>` or `?path=/story/<id>`) or story frame URL (`iframe.html?id=<id>`), the new URL: `${base}/${pages[title]}` plus the original hash, where `title` is the id before `--`; an unknown title → `${base}/` (the home page) plus the hash; a URL that is neither (no `path` and not an iframe `id`) → `undefined` (no redirect). Self-contained (no imports, no closure), because its source is serialized into the inline scripts with `Function.prototype.toString()`.
  - `redirectScript(base: string): string`: the inline script text: `(${oldUrlTarget.toString()})(location.href, base, pages)` and, if it returns a URL, `location.replace(it)`.
- `src/pages/iframe.html.ts`: an endpoint (`GET`) returning a minimal HTML page (`<title>`, `<meta name="robots" content="noindex">`, the `redirectScript`, and a `<noscript>` link to the home page), `Content-Type: text/html`.
- `Head.astro`: on the home page only (`Astro.url.pathname` is the base root), `<script is:inline set:html={redirectScript(base)} />`.

- [ ] **Step 1: Unit tests** (`old-urls.test.ts`):

```ts
const base = '/argus-table';
test('a theme-creator link keeps its hash', () => {
  expect(oldUrlTarget('https://x.io/argus-table/iframe.html?id=themes-theme-creator--creator&viewMode=story#theme=abc', base, STORYBOOK_PAGES))
    .toBe('/argus-table/themes/creator/#theme=abc');
});
test('manager URLs for docs and stories', () => {
  expect(oldUrlTarget('https://x.io/argus-table/?path=/docs/features-sorting--docs', base, STORYBOOK_PAGES)).toBe('/argus-table/features/sorting/');
  expect(oldUrlTarget('https://x.io/argus-table/?path=/story/themes-material-inspired--dark&globals=theme:material', base, STORYBOOK_PAGES)).toBe('/argus-table/themes/material/');
  expect(oldUrlTarget('https://x.io/argus-table/?path=/docs/benchmarks--docs', base, STORYBOOK_PAGES)).toBe('/argus-table/guides/performance/');
});
test('an unknown page falls back to the home page', () => {
  expect(oldUrlTarget('https://x.io/argus-table/?path=/story/features-gone--x', base, STORYBOOK_PAGES)).toBe('/argus-table/');
  expect(oldUrlTarget('https://x.io/argus-table/iframe.html?id=nope--x', base, STORYBOOK_PAGES)).toBe('/argus-table/');
});
test('other URLs don\'t redirect', () => {
  for (const href of ['https://x.io/argus-table/', 'https://x.io/argus-table/?q=sorting', 'https://x.io/argus-table/features/sorting/'])
    expect(oldUrlTarget(href, base, STORYBOOK_PAGES)).toBeUndefined();
});
test('every Storybook title maps to a page', () => {
  // titles from apps/storybook/stories/**/*.{ts,mdx} (`title: '…'`, `<Meta title="…" />`), kebab-cased like Storybook (lower case, runs of other characters → '-', '/' → '-')
  // each is a key of STORYBOOK_PAGES, and each value is a page: src/content/docs/<path minus slash>.mdx, …/index.mdx, or a generated path (api/, guides/<package>/, themes/creator/ is content) — check against the built route list: content files plus PACKAGE_GUIDES ids plus 'api/'
});
test('the redirect script runs its function on its own', () => {
  // new Function('location', redirectScript('/argus-table')) with a fake location { href, replace: vi.fn() }: replace called with the creator path for a creator link, not called for the home page
});
```

- [ ] **Step 2: Run, see them fail**: `pnpm --filter @argus-table/docs exec vitest run src/lib/old-urls.test.ts`.

- [ ] **Step 3: Implement** `old-urls.ts`, `iframe.html.ts` and the `Head.astro` script. Check the built `dist/iframe.html` exists (Astro writes an endpoint named `iframe.html.ts` to that file).

- [ ] **Step 4: The spec** `old-urls.spec.ts`:
  - a theme link: build one with the skill's `themeLink` / `encodeDraft` hash, open `iframe.html?id=themes-theme-creator--creator&viewMode=story#theme=<hash>` → URL becomes `…/argus-table/themes/creator/` and the creator shows "Opened the theme from the link." (the creator then clears the hash);
  - `?path=/docs/features-sorting--docs` → `…/features/sorting/`; `?path=/story/recipes-vue--docs` → `…/guides/vue/`;
  - `?path=/story/features-gone--x` → stays on the home page (its `h1`);
  - the home page with no query stays (URL unchanged after load, `h1` visible).

- [ ] **Step 5: Run** unit tests, build, the spec in all engines, `pnpm nx run-many -t lint typecheck -p docs`. Expected: pass.

- [ ] **Step 6: Commit**: `docs(site): old Storybook URLs land on their new pages`

### Task 2: Links and the theme skill point to the site

**Files:**

- Modify: `skills/argus-table-theme/scripts/draft.mjs` (+ `draft.d.mts`), `skills/argus-table-theme/SKILL.md`, `skills/test/scripts.test.mjs`, `skills/README.md` (if it names Storybook), `packages/theme-creator/src/skill.test.ts`, `packages/theme-creator/src/share.ts` (the `STORYBOOK_SHARE_PATH` comment), `README.md`, `packages/themes/README.md`, `benchmarks/README.md`, `benchmarks/types.ts` (comment), `apps/docs/README.md`, `apps/docs/src/content/docs/index.mdx` if it says "not deployed", `CLAUDE.md`
- Create: `.changeset/themes-readme-docs-site.md` (`'@argus-table/themes': patch` — "The README links the theme creator on the new docs site.")

**Interfaces:**

- `draft.mjs`: `DEFAULT_BASE_URL` stays `'https://joessst-dev.github.io/argus-table/'`; `STORY_ID` is removed (and from `draft.d.mts`); new `CREATOR_PATH = 'themes/creator/'`; `themeLink(draft, baseUrl = DEFAULT_BASE_URL)` → `new URL(CREATOR_PATH, base-with-trailing-slash)` with `#theme=<encoded>`.

- [ ] **Step 1: Tests first.**
  - `scripts.test.mjs`: the printed link matches `/^https:\/\/joessst-dev\.github\.io\/argus-table\/themes\/creator\/#theme=[\w-]+$/`; "links to a local docs server": `--base-url http://localhost:4321/argus-table` → stdout matches `/^http:\/\/localhost:4321\/argus-table\/themes\/creator\/#theme=/`.
  - `packages/theme-creator/src/skill.test.ts` "makes the link the creator makes": the skill's link has the same page as the site's creator, `shareLink(newDraft('fluent','Acme'), new URL('themes/creator/', DEFAULT_BASE_URL).href)` (the docs site leaves `shareUrl` unset, so its links are its own page); `themeLink(draft, 'http://localhost:4321/argus-table')` starts `http://localhost:4321/argus-table/themes/creator/#theme=`.
- [ ] **Step 2: Run, see them fail**: `pnpm nx test skills`, `pnpm nx test theme-creator`.
- [ ] **Step 3: Change the skill**: `draft.mjs` / `draft.d.mts` as above (and its header comment: the format is `packages/theme-creator/src/share.ts`'s; links open the docs site's creator page); `SKILL.md`: the `--base-url` line becomes "`--base-url http://localhost:4321/argus-table/` makes a link to a local docs site of the argus-table repo (`pnpm nx run docs:preview`) instead of the public one", and the Python one-liner prints `https://joessst-dev.github.io/argus-table/themes/creator/#theme=`.
- [ ] **Step 4: Links**: `README.md`'s theme-creator link and `packages/themes/README.md`'s → `https://joessst-dev.github.io/argus-table/themes/creator/`; `benchmarks/README.md`: "The benchmark behind the [Performance](https://joessst-dev.github.io/argus-table/guides/performance/) guide's tables on the docs site." (and the comment in `benchmarks/types.ts` names that page). Then `grep -rn "?path=\|iframe.html\|Storybook" README.md packages/*/README.md apps/examples/*/README.md skills .claude-plugin benchmarks/README.md` shows no published-Storybook URL left; mentions of Storybook as the repo's test/dev tool stay.
- [ ] **Step 5: Docs about the docs**: `apps/docs/README.md` (deployed on `main`, previews as the `docs-site` artifact; old URLs: `old-urls.ts`; the theme skill links here), CLAUDE.md (the `apps/docs` bullet: deployed to Pages, old-URL redirects; the `apps/storybook` bullet: stories are tests and PR artifacts, no longer published, the creator story's `shareUrl` is its own iframe; the `skills/` bullet if it says where links open), the `STORYBOOK_SHARE_PATH` comment (no longer "the theme skill's links").
- [ ] **Step 6: Run**: `pnpm nx run-many -t lint typecheck test -p skills theme-creator docs storybook`, `pnpm changeset status`, `pnpm exec prettier --check .`. Expected: pass.
- [ ] **Step 7: Commit**: `docs: point links and the theme skill at the docs site`

### Task 3: Deploy the site, Storybook as an artifact

**Files:**

- Modify: `.github/workflows/docs.yml`

- [ ] **Step 1: The workflow**: the Storybook job (`storybook`, renamed from `build`) runs only on `pull_request` and uploads `apps/storybook/dist` as the `storybook` artifact (no Pages artifact). The `site` job builds the docs site on every event: on pull requests it uploads the `docs-site` artifact as now; on a push it uploads `apps/docs/dist` with `actions/upload-pages-artifact` (same pinned SHA as today). `deploy` `needs: site`, otherwise unchanged. Update the comments (no "until it replaces Storybook").
- [ ] **Step 2: Check it**: `actionlint` if available in the copy, else `npx --yes @action-validator/cli .github/workflows/docs.yml`; read the job graph once more: on `push` to `main` → `site` (Pages artifact) → `deploy`; on `pull_request` → `storybook` + `site` (artifacts).
- [ ] **Step 3: Full checks** (Linux copy): the full docs e2e suite in all engines (`--workers=3`), `pnpm exec prettier --check .`. Expected: pass.
- [ ] **Step 4: Commit**: `ci(docs): deploy the docs site to Pages; Storybook as a PR artifact`
- [ ] **Step 5: After the merge** (not part of the PR): watch the `Docs` run on `main` deploy; then open `https://joessst-dev.github.io/argus-table/` (the site's home), `…/themes/creator/`, an old theme link (`…/iframe.html?id=themes-theme-creator--creator&viewMode=story#theme=…` from `node skills/argus-table-theme/scripts/theme-link.mjs` on `main` before this PR, or the test's hash) and `…/?path=/docs/features-sorting--docs`, and report what each shows.
