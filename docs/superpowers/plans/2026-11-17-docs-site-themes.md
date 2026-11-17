# Docs site: themes and the theme creator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The docs site gets a Themes section: an overview, a page per shipped theme with its variants, and the theme creator, which moves out of Storybook into a private package both apps import.

**Architecture:** `apps/storybook/theme-creator/` (and the shared `stories/theme-orders.ts`) becomes `packages/theme-creator` (`@argus-table/theme-creator`, private, Nx `theme-creator`), with its unit tests and `skill.test.ts`; Storybook's story imports it, so the published creator keeps working until the switch-over. The creator gets a `shareUrl` property: share links open the page that embeds it (Storybook sets its iframe URL; the site leaves the default, its own page). Theme pages preview each theme in a shadow root (`<argus-theme-preview>`), so the site's global `default.css` and the other themes can't reach it.

**Tech Stack:** Lit 3, Vitest browser mode (Playwright provider), Astro 7.4 + Starlight 0.43, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-11-16-docs-site-design.md`: "Theme creator", "Site structure" (Themes: "the shipped themes (one flavour each, with their variants), and the theme creator"), "Rollout".

## Global Constraints

- The creator "moves out of `apps/storybook/theme-creator/` into the docs app (or a private workspace package both can import; the builder decides), with its unit tests (the `theme-creator` Vitest project) and `skill.test.ts`. It's a self-contained element, embedded on a Themes page." Decision: a private package, because Storybook stays published (with the creator the theme skill links to) until the switch-over.
- **Sequencing:** the theme skill's links (`themeLink()` / `DEFAULT_BASE_URL` / `STORY_ID` in `skills/argus-table-theme/scripts/draft.mjs`, `SKILL.md`'s Python one-liner, `skills/test/scripts.test.mjs`) and the README links keep pointing at Storybook in this plan. The spec's Rollout puts "the theme skill point[s] to the site" in the switch-over PR (plan 7), with the old-URL redirect; changing them now would link to a page that isn't deployed.
- The `#theme=` format (deflate-raw, base64url, `share.ts`) doesn't change: a link made by the skill or either creator opens in both.
- `@argus-table/theme-creator` is `private: true`, never published, no changeset; its source is consumed through Vite (`?raw` imports), like now.
- Theme pages: one flavour each (no four-flavour examples; `check-examples.mjs` doesn't apply). Tables on the site follow its light and dark mode (spec "Rollout").
- Dependencies: the docs app adds `@argus-table/theme-creator` (`workspace:*`), `@fontsource/roboto` and `@fontsource/instrument-sans` (Storybook's versions, already in the lockfile). Run `pnpm install` only in the Linux copy and copy `pnpm-lock.yaml` back.
- Prettier over the whole repo before push; docs-only PR (`no-changeset`).

## Review Focus

1. **A share link opened on the site's creator page** (`…/themes/creator/#theme=…`, typed or pasted into a fresh tab) opens that theme and clears the hash; an unreadable one keeps the current theme and says so. → Task 3, creator spec.
2. **The site's light/dark switch** flips previews that follow it (`scheme="auto"`) and leaves forced ones alone; no preview shows the site's own `default.css` instead of its theme. → Task 2, themes spec.
3. **Storybook's creator after the move** still makes links to its own iframe (the skill and READMEs link there until the switch), in the production build too. → Task 1, `shareBase` unit test and the Storybook prod check.
4. **The creator page at 390 px and at 1440 px**: no sideways page scroll on a phone; on a desktop the creator gets the full width (its two-column layout). → Task 3, creator spec.
5. **Theme fonts**: the Material-inspired and Minimal previews render in Roboto and Instrument Sans, not the fallback. → Task 2, themes spec.

---

### Task 1: `packages/theme-creator`, used by Storybook

**Files:**

- Move (`git mv`): `apps/storybook/theme-creator/*` → `packages/theme-creator/src/*`; `apps/storybook/stories/theme-orders.ts` → `packages/theme-creator/src/orders.ts`
- Create: `packages/theme-creator/{package.json,tsconfig.json,vitest.config.ts,eslint.config.js,src/index.ts}` (copy the shape of a sibling private package, e.g. `packages/core`, and Storybook's vitest browser setup)
- Modify: `apps/storybook/{package.json,vitest.config.ts,tsconfig.json}`, `apps/storybook/stories/theme-creator.stories.ts`, `apps/storybook/stories/themes-*.stories.ts`, `src/share.ts`, `src/theme-creator.ts`, `src/contrast-share.test.ts`, `CLAUDE.md`

**Interfaces:**

- Produces (`@argus-table/theme-creator`, `exports: { ".": "./src/index.ts", "./orders": "./src/orders.ts" }`):
  - `.`: registers `<argus-theme-creator>`; exports `ArgusThemeCreator`, `newDraft`, `clearDraft`, `encodeDraft` (what the Storybook test uses).
  - `./orders`: `Order`, `orders`, `orderColumns`, `totals`, `getOrderId` (unchanged).
  - `ArgusThemeCreator.shareUrl: string | undefined` (a plain property, no attribute): the page share links open.
  - `shareBase(shareUrl: string | undefined, href: string): string`: `shareUrl` if set, else `href` without its hash; `shareLink(draft: ThemeDraft, base: string): Promise<string>` → `base` with `#theme=<encoded>` (replacing any hash `base` has).
- Storybook's story sets `.shareUrl=${new URL('iframe.html?id=themes-theme-creator--creator&viewMode=story', location.href).href}`, which is today's link.

- [ ] **Step 1: Move the files** with `git mv` (history kept), fix every relative import (`grep -rn "\.\./\.\./\.\./\|\.\./stories" packages/theme-creator/src`: `../../themes/src/*.css?raw`, `../../header-menu/src/**`, `../../../skills/…`, `./orders.js`), and write the package files: deps `argus-table`, `@argus-table/header-menu`, `@argus-table/formulas`, `lit` (`workspace:*` / Storybook's ranges); devDeps vitest, `@vitest/browser-playwright`, `playwright` 1.63.0, typescript; scripts `test` (`vitest run`), `typecheck`, `lint`; `nx.implicitDependencies: ["skills", "themes"]` and a `test` input `{workspaceRoot}/skills/argus-table-theme/**/*` (the skill test reads them). The Vitest config: one browser project, `include: ['src/**/*.test.ts']`, `BROWSERS` as in Storybook's config. Storybook: drop its `theme-creator` Vitest project, depend on `@argus-table/theme-creator: workspace:*`, import from it. `pnpm install` in the copy.

- [ ] **Step 2: Write the failing tests** in `src/contrast-share.test.ts` (replacing the old `shareLink(…, location)` cases):

```ts
it('share links open the page that embeds the creator', async () => {
  const link = await shareLink(draft, 'https://x.dev/argus-table/themes/creator/');
  expect(link).toMatch(/^https:\/\/x\.dev\/argus-table\/themes\/creator\/#theme=[\w-]+$/);
  expect(await decodeDraft(hashDraft(link) ?? '')).toEqual(draft); // the round trip, as before
  expect(await shareLink(draft, 'https://x.dev/p?a=1#theme=old')).toMatch(
    /^https:\/\/x\.dev\/p\?a=1#theme=/,
  );
});
it('shareBase: the set URL, else the page without its hash', () => {
  expect(shareBase(undefined, 'https://x.dev/argus-table/themes/creator/#theme=abc')).toBe(
    'https://x.dev/argus-table/themes/creator/',
  );
  expect(
    shareBase(
      'https://sb.dev/iframe.html?id=themes-theme-creator--creator&viewMode=story',
      'https://sb.dev/iframe.html?id=x&args=y',
    ),
  ).toBe('https://sb.dev/iframe.html?id=themes-theme-creator--creator&viewMode=story');
});
```

- [ ] **Step 3: Run them to see them fail**: `pnpm nx test theme-creator` → FAIL (`shareBase` doesn't exist, `shareLink` takes a `Location`).

- [ ] **Step 4: Implement** `shareBase`, the new `shareLink`, and `shareUrl` on the element (its copy-link handler calls `shareLink(this.draft, shareBase(this.shareUrl, location.href))`); set `shareUrl` in the Storybook story; add `src/index.ts`.

- [ ] **Step 5: Run everything that moved or changed**

Run (Linux copy): `pnpm nx run-many -t lint typecheck test -p theme-creator storybook skills` and `pnpm nx run storybook:test-storybook` (twice: the memory note says the first run after an install can fail).
Expected: all pass; the `theme-creator` tests (≈ the same count as before the move, plus the two new ones) and `CreatorTest` among them.

- [ ] **Step 6: Storybook production check**: `pnpm nx run storybook:build`, serve `apps/storybook/dist`, and in Playwright (Chromium, clipboard granted) open `iframe.html?id=themes-theme-creator--creator&viewMode=story`, pick a preset, click "Copy link", and check the clipboard reads `…/iframe.html?id=themes-theme-creator--creator&viewMode=story#theme=…`; open it in a new page and see "Opened the theme from the link." (A throwaway script in the scratchpad, not committed.)

- [ ] **Step 7: CLAUDE.md**: the `apps/storybook` bullet points to `packages/theme-creator` for the creator; a new `packages/theme-creator` bullet (private, what moved, `shareUrl`, the `theme-creator` Vitest project, used by Storybook and the docs site); the Nx project list gains `theme-creator`; the `skills/` bullet's `apps/storybook/theme-creator/skill.test.ts` becomes `packages/theme-creator/src/skill.test.ts`. Grep the repo (`.claude/skills`, `docs/`, `skills/`, READMEs) for `apps/storybook/theme-creator` and fix each path that describes where the code lives (not the published Storybook URLs).

- [ ] **Step 8: Commit**: `refactor(theme-creator): move the creator into a private package`

### Task 2: Themes pages with previews

**Files:**

- Create: `apps/docs/src/components/themes/theme-preview.ts` (the element), `apps/docs/src/components/themes/ThemePreview.astro` (renders the tag and loads the element's script), `apps/docs/src/content/docs/themes/{index,default,material,fluent,bootstrap,minimal}.mdx`, `apps/docs/e2e/themes.spec.ts`
- Modify: `apps/docs/package.json` (deps), `apps/docs/astro.config.mjs` (sidebar group "Themes" after "Features": Overview, Default, Material-inspired, Fluent-inspired, Bootstrap-inspired, Minimal, Theme creator → `/themes/creator/`)

**Interfaces:**

- Consumes: `@argus-table/theme-creator/orders` (Task 1).
- Produces: `<argus-theme-preview theme="material" scheme="auto|light|dark" density="compact|comfortable|spacious" selection label="…">`: a 320 px orders table (`orderColumns`, `orders`, `totals` pinned at the bottom, `getOrderId`; `selection` adds `selection-mode="multi"` and `selection-checkboxes`; `label` is the table's `aria-label`) in its own shadow root, which adopts the theme's shipped CSS (`@argus-table/themes/<theme>.css?raw`, not `?inline`, which a production build minifies and lowers) and wraps the table in an element carrying `data-argus-theme`: the forced scheme, or for `auto` the document's `data-argus-theme`, kept in sync with a `MutationObserver` (Head.astro already mirrors the site's mode there). `ThemePreview.astro` takes the same props.

- [ ] **Step 1: Write the failing spec** (`e2e/themes.spec.ts`, axe as in `api.spec.ts`; the light/dark `--argus-bg` values come from `packages/themes/src/*.css`):

```ts
const THEMES = {
  material: ['rgb(254, 247, 255)', 'rgb(20, 18, 24)'],
  fluent: ['rgb(255, 255, 255)', 'rgb(41, 41, 41)'],
  bootstrap: ['rgb(255, 255, 255)', 'rgb(33, 37, 41)'],
  minimal: ['rgb(255, 255, 255)', 'rgb(15, 16, 18)'],
};
// the preview's table, through its shadow root: page.locator('argus-theme-preview').nth(i).locator('argus-table')
test(
  '<theme>: the preview follows the site, forced variants stay' /* site light (Starlight's theme select) → main preview bg = light value; select dark → dark value; a scheme="light" preview stays light; axe */,
);
test('default: follows the site too' /* bg light ≠ bg dark (Canvas differs per engine) */);
test(
  'variants: compact rows are shorter, selection has checkboxes' /* material page: compact preview's first body row height < main's; selection preview has a checkbox in its header */,
);
test(
  'Material-inspired and Minimal load their fonts' /* table computed font-family starts with Roboto / "Instrument Sans"; await page.evaluate(() => document.fonts.ready); document.fonts.check('400 14px Roboto') is true */,
);
test('the overview links every theme page and the creator' /* 6 links; axe */);
```

- [ ] **Step 2: Run it to see it fail**: `BROWSERS=chromium pnpm exec playwright test -c e2e/playwright.config.ts themes.spec.ts` (after a build) → 404s.

- [ ] **Step 3: The element and component**, as in Interfaces. The element's tables get distinct `label`s per preview (axe: unique accessible names).

- [ ] **Step 4: The pages.** Each theme page, from its Storybook story's JSDoc and `packages/themes/README.md`'s section (prose is the builder's): what the theme is; how to load it (`import '@argus-table/themes/<theme>.css'` and the `<link>` form), fonts it expects (Material: Roboto 400 and 500; Minimal: Instrument Sans) with the `@fontsource` imports; a main preview (`scheme="auto"`) with a note that it follows the site's light/dark switch; a "Variants" section with `scheme="dark"` (and `scheme="light"` for the default theme's page), `density="compact"` and `selection` previews. The material and minimal pages import their fonts' CSS in the MDX (so only those pages load them). `since` from `packages/themes/CHANGELOG.md` (the release that added each theme). The overview: the table of themes (name, file, feel, fonts) linking each page; loading a theme; light/dark with `data-argus-theme` on the table or an ancestor; density; overriding one token after the theme (`argus-table { --argus-border-radius: 0; }`); links to the Styling feature pages and the creator.

- [ ] **Step 5: Run the spec and the site's checks** (Linux copy): build, then `BROWSERS=all pnpm exec playwright test -c e2e/playwright.config.ts themes.spec.ts --workers=3`, and `pnpm nx run-many -t lint typecheck test -p docs`. Expected: all pass.

- [ ] **Step 6: Commit**: `docs(site): theme pages`

### Task 3: The theme creator page

**Files:**

- Create: `apps/docs/src/content/docs/themes/creator.mdx`, `apps/docs/src/components/themes/ThemeCreator.astro`, `apps/docs/e2e/creator.spec.ts`
- Modify: `apps/docs/README.md`, `CLAUDE.md` (the `apps/docs` bullet)

**Interfaces:**

- Consumes: `@argus-table/theme-creator` (Task 1): `<argus-theme-creator>` with `shareUrl` left unset (links open this page).

- [ ] **Step 1: Write the failing spec** (`e2e/creator.spec.ts`), a port of Storybook's `CreatorTest` against `themes/creator/`, each test starting with `localStorage` cleared (`page.addInitScript` before the first load):

```ts
test(
  'a preset reaches both previews' /* #preset → material: creator.css contains '--argus-border-radius: 12px;'; the two argus-table.main backgrounds are ['rgb(254, 247, 255)', 'rgb(20, 18, 24)'] */,
);
test(
  'the accent changes the focus ring' /* #accent-light = #0a7d5a, 'input' → --argus-focus-ring of the first preview contains '#0a7d5a' */,
);
test(
  'a link opens its theme and leaves the URL' /* the hash of `await themeLink({ name: 'Linked', preset: 'bootstrap' })` from `skills/argus-table-theme/scripts/draft.mjs` (run in the spec, in Node: the skill's own encoder, so this also proves the skill's links open on the site); goto `themes/creator/${hash}`: text 'Opened the theme from the link.', css contains 'Linked: an argus-table theme, based on the Bootstrap-inspired theme.', location.hash '' */,
);
test(
  'an unreadable link keeps the theme' /* '#theme=not-a-theme' → 'The link’s theme couldn’t be read; kept the current theme.' */,
);
test(
  'copy link points at this page' /* chromium only (clipboard permission): click "Copy link"; clipboard matches new RegExp(`/argus-table/themes/creator/#theme=[\\w-]+$`); open it in a new page → 'Opened the theme from the link.' */,
);
test(
  'fits a phone and fills a desktop' /* 390×844: documentElement.scrollWidth <= innerWidth; 1440×900: the creator's width > 1000; axe at 1440 */,
);
```

- [ ] **Step 2: Run it to see it fail** → 404.

- [ ] **Step 3: The page**: `creator.mdx` (`title: Theme creator`, `template: splash`, `tableOfContents: false`; one paragraph from the Storybook story's JSDoc, including the `argus-table-theme` skill), with `ThemeCreator.astro` rendering `<argus-theme-creator></argus-theme-creator>` and a `<script>` importing `@argus-table/theme-creator`. If the splash layout still caps the creator's width below its two-column layout (the spec's 1440 check), widen that page's content container in `site.css`, scoped to the page.

- [ ] **Step 4: Run the specs, the full docs e2e and the checks** (Linux copy): `BROWSERS=all … playwright test --workers=3` (whole suite: the sidebar changed on every page), `pnpm nx run-many -t lint typecheck test -p docs theme-creator storybook skills`, `pnpm exec prettier --check .`. Expected: all pass.

- [ ] **Step 5: Docs**: `apps/docs/README.md`: the Themes pages (previews in shadow roots, so the site's `default.css` can't reach them; fonts loaded per page) and the creator page (`@argus-table/theme-creator`; share links open this page; the skill links to Storybook until the switch-over). `CLAUDE.md`'s `apps/docs` bullet: one sentence each.

- [ ] **Step 6: Commit**: `docs(site): the theme creator page`
