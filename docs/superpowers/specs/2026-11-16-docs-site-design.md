# Docs site with every feature in four flavours

- **Date:** 16 November 2026
- **Status:** Design, approved for planning

## Intent

argus-table's public docs are its Storybook (`joessst-dev.github.io/argus-table`). Every live example there is written with Lit's `html`, because Storybook's web-components renderer runs them. The React, Vue and Angular "recipes" are static code blocks in MDX: nothing runs them, type-checks them or notices when they drift from the API. Real framework code exists only in the four StackBlitz starters (`apps/examples`). Most long-form writing (the package READMEs, about 1,200 lines; the integrate skill's migration guides) isn't on the site at all.

The maintainer wants a docs site where **every feature runs in all four flavours** (plain HTML with the web component, React, Vue, Angular), each through that framework's real wrapper, **next to the exact source that runs**: copyable for readers, reviewable in PRs, and impossible to drift because what is shown is what runs. CI enforces all four for every feature. The site becomes the public docs; Storybook stays behind the scenes as the test bench.

## Goals

- A public docs site with: getting started, a page per feature with four live flavours and their source, guides, an API reference, the theme creator, and the migration guides.
- The four-flavour rule covers the **feature pages**: every example on a feature page has all four flavours. A feature page shows what a reader needs to use the feature (about 120 examples across the site), not a port of every Storybook story. Test-setup stories stay in Storybook only: right-to-left variants, stress tests (`MillionRows`, `HundredThousandRows`), stories that open in a set state (`header-menu` `Open`, `formulas` `EditorOpen`) and the like. The Themes pages and the Tailwind page are about CSS and show one flavour (HTML); they are not feature pages.
- Every feature page has all four flavours, each written the way that framework's users write code (React state and `on*` props, Vue `v-model` and slots, Angular signals, `[(…)]` and `ng-template`, plain DOM and events), using the published wrappers' public API only.
- CI fails when a feature page lacks a flavour, when a flavour exists without a page, when an example doesn't type-check in its framework, or when an example doesn't render and respond in Chromium, Firefox and WebKit (with axe).
- The site follows `main`; pages for features newer than the last release say so ("Coming in 1.4"), released ones say "Since 1.3".
- One source for the migration guides, shared with the `argus-table-integrate` skill.

## Non-goals

- Replacing Storybook as the test bench, or porting its stories' play functions. Storybook keeps running its stories with axe in CI; whether its Lit stories become redundant is a later question.
- Versioned docs (a site per release). One site, at `main`, with badges.
- Translations of the docs.
- Editable, in-browser playgrounds (Sandpack, StackBlitz embeds). The StackBlitz starters stay where they are; pages may link to them.
- Generating the four flavours from one source.

## Anti-goals (failure even if it technically works)

- Examples that aren't idiomatic for their framework (wrapper-shaped code nobody would write), or that reach around the wrappers to the element.
- Shown source that differs from what runs (snippets pasted next to a demo).
- A site that goes public with features missing: readers would lose docs that Storybook has today (what a reader needs per feature; Storybook's test-setup stories aren't reader docs).
- Breaking existing links: theme-creator share links (the theme skill hands them out), README and npm links, and old Storybook URLs people bookmarked.
- Pages so heavy that opening a feature loads four frameworks.

## Constraints

- pnpm + Nx monorepo, Node 24, TypeScript ~6.0 (Angular 22's build needs TypeScript 6; the repo already uses it). The site uses the workspace packages (`workspace:*`), built through Nx (`^build`), like Storybook today.
- GitHub Pages at `https://joessst-dev.github.io/argus-table/` (base path `/argus-table/`), deployed by `.github/workflows/docs.yml`.
- Wrapper peer ranges: React 18.3/19, Vue 3.5, Angular 20–22.
- The CDN size budget and the packages are unaffected: the site is a private app.
- `CLAUDE.md` conventions apply to the site's own code (strict TypeScript, ESLint, Prettier, `.js` import extensions where the toolchain needs them).
- The integrate skill's references are written for agents and checked by `skills/test/integrate-sync.test.mjs`; rendering them on the site must not change that contract.

## Approaches

**A. Starlight (Astro) with framework islands. Chosen.** One site, one build. Each example is a real component file imported twice: as an island that runs, and raw (`?raw`) for its code panel. React and Vue islands are official Astro integrations; Angular runs through Analog's `@analogjs/astro-angular`; the HTML flavour is markup plus a module script on the page. Guides and migration guides are Markdown in Astro content collections. _Trades off:_ the best reading experience and a single site, against reliance on a third-party Angular integration.

**B. A docs site plus four example apps embedded as iframes.** Each framework builds in its native toolchain (Vite, Angular CLI), and the site embeds them. _Trades off:_ full isolation and native toolchains, against five builds, iframe sizing and theme or dark-mode syncing across frames, and slower pages. Kept as the fallback for Angular alone, if the integration ever fails.

Ruled out: four composed Storybooks (keeps Storybook as the public face; poor for long-form reading) and VitePress (Vue-first; React and Angular islands would be workarounds).

**Spike (16 November 2026), throwaway:** a Starlight page "Sorting" with the four flavours against the published 1.3.0 packages (Astro 7.4, Starlight 0.43, `@astrojs/react` 7.1, `@astrojs/vue` 7.1, `@analogjs/astro-angular` 2.9, Angular 22.2). All four rendered, sorted on a header click, updated their own framework state (`useState`, `v-model:sorting`, an Angular signal through `[(sorting)]`) and rendered a framework custom cell (JSX, a `#cell-total` slot, an `argusCell` template) in Chromium, Firefox and WebKit, with no console errors. Analog server-rendered the Angular island at build time and hydrated it. Build: about 4 s. Seen: a 35 kB gzipped Angular "debug node" chunk (to check: production mode), React and Vue loading on page load with `client:only` (to change, below), and long code lines scrolling sideways.

## Decisions

### Where it lives

- A new private app, `apps/docs` (Nx project `docs`), Astro + Starlight, with `@astrojs/react`, `@astrojs/vue` and `@analogjs/astro-angular`. Its dependencies on `argus-table`, the wrappers, the add-ons and `@argus-table/themes` are `workspace:*`.
- Each framework integration is scoped to its own files (React to `**/react/**`, Vue to `.vue`, Angular to `**/angular/**`), so their compilers don't see each other's code.

### Site structure

- **Getting started**: install, a first table in each flavour (the four-flavour pattern), themes.
- **Features**: one page per feature, about 30, from today's stories: Rendering, Sorting, Filtering, Resizing, Auto width, Column reorder, Column groups, Pinned columns, Column pinning and visibility, Column virtualization, Declarative columns, Density, Row height, Pinned rows, Row selection, Keyboard, Scrolling, Infinite loading, Saved state, Labels; the add-ons Header menu, Formulas, Export, Editing; Styling: Tokens, Parts, Slotted content. Each page: a short explanation, its examples (one or a few, as many as a reader needs), each in four flavours in tabs, notes. The Tailwind page sits with the guides, in one flavour.
- **Guides**: controlled and uncontrolled state, server data (`dataSource`), styling and themes, plugins and writing one, accessibility, performance and scaling (the benchmarks, read from `benchmarks/published/`), and the add-on guides (from the add-on READMEs).
- **API reference**, generated (below).
- **Themes**: the shipped themes (one flavour each, with their variants), and the theme creator.
- **Migration**: the guides from the integrate skill.
- Search: Starlight's built-in Pagefind.

### Examples

- Location: `apps/docs/src/examples/<feature>/<example>/{html,react,vue,angular}/` plus a shared `data.ts` per feature (rows and content-free column settings), so the four differ only where the frameworks do.
- Files: `html/index.html` and `html/main.js` (the HTML flavour on the page: its markup as written, its script bundled); `react/<Name>.tsx`; `vue/<Name>.vue`; `angular/<name>.component.ts` (standalone).
- An `Example` component renders one flavour: the island in a slot and the flavour's files read raw, shown with Starlight's code component (titles = file names, long lines wrapped). Pages use Starlight `Tabs` with a shared `syncKey`, so a reader's flavour choice holds across pages.
- Islands hydrate when visible (`client:visible`), so only the open tab's framework loads. If server rendering a wrapper fails, that flavour uses `client:only` and must still load lazily (only when its tab opens).
- Examples use only the packages' public exports. A shared `data.ts` import is the only non-package import.

### Release badges

- A feature page's frontmatter has `since: '1.3'`. At build time the site compares it with the version in `packages/table/package.json` (the last released version; it changes only at a release): newer → "Coming in 1.x", else "Since 1.x". No registry lookup.
- Below page level, marking is docs-only: an example (a prop on the `Example` usage or the example's own metadata) and a section (a small badge component in the page's Markdown) can carry their own `since`, compared the same way. So a new example or option on a released page says "Coming in 1.4".
- The API reference is not marked per member (no `@since` tags in the packages). Its page says it documents `main`, and links the changelogs.

### API reference

- Generated at build time from `packages/table/dist/custom-elements.json` (properties, attributes, events, methods, parts, tokens, slots) and from core's public types, so it can't drift. Wrapper binding names (React props, Vue events and `v-model`, Angular inputs and outputs) come from the same data the wrapper generator uses (`tools/generate-wrappers`).

### Migration guides: one source

- The site renders `skills/argus-table-integrate/references/migrate/*.md` (and `gaps.md`) through an Astro content loader. They stay agent-first; the site adds a title and a short note that the guide also serves the integrate skill. The skill's sync test keeps checking them; the site must build from them unchanged.
- Links between the rendered files resolve on the site. Links to references the site doesn't render (`server-data.md`, `addons.md`, `styling.md`, `testing.md`, …; some written without `../`) are rewritten by the loader to the file on GitHub (`main`), anchors kept. _(Designer's call.)_

### Theme creator

- Moves out of `apps/storybook/theme-creator/` into the docs app (or a private workspace package both can import; the builder decides), with its unit tests (the `theme-creator` Vitest project) and `skill.test.ts`. It's a self-contained element, embedded on a Themes page.
- Share links change from `…/argus-table/iframe.html?id=themes-theme-creator--creator&viewMode=story#theme=…` to the new page's URL with the same `#theme=` hash: `shareLink()` in the creator and `themeLink()` / `DEFAULT_BASE_URL` in `skills/argus-table-theme/scripts/draft.mjs` change together, with their tests.

### CI enforcement

- **Completeness check** (a script, run in `lint`): every example folder has all four flavours with their expected files, every example is used on a page, and every page's examples exist. Fails with the missing piece named.
- **Type checks** per flavour with its framework's checker: `tsc` for HTML (`checkJs`) and React, `vue-tsc` for Vue, Angular's compiler with strict templates for Angular. Part of `nx run docs:typecheck`.
- **Browser tests**: Playwright against the built site (`astro build` then `astro preview`), in Chromium, Firefox and WebKit. Each feature page has one spec that runs the same interaction against each of its flavours (render, the feature's interaction, a state assertion) plus axe. The project joins the existing e2e matrix (`BROWSERS`).
- The site's build, typecheck, lint and tests run in CI on every PR, through `nx affected` like the other projects.

### Storybook

- Keeps running its stories as tests in CI. After the switch it is no longer published: `docs.yml` builds it on PRs and uploads it as an artifact only.

### Rollout

- Until every feature has its four flavours, the site is built on PRs and uploaded as a preview artifact; Storybook stays published as it is.
- One switch-over PR: `docs.yml` deploys the site to GitHub Pages; Storybook becomes a PR artifact only; links in the README, the package READMEs, `apps/examples/*/README.md`, `skills/README.md`, `.claude-plugin/marketplace.json` and the theme skill point to the site.
- **Old URLs keep working** after the switch: a static `iframe.html` that redirects theme-creator links (keeping the `#theme=` hash) to the new page, and a small script on the site's root page that maps Storybook `?path=/docs/…` and `?path=/story/…` URLs to their new pages (falling back to the home page).
- The site's look: Starlight's default theme with argus-table's colours and the logo from `brand/`; tables on the site use `@argus-table/themes` and follow the site's light and dark mode.

## Calls made in writing this up

These weren't discussed; they're the designer's calls, open to change:

- Migration-guide links to unrendered references go to GitHub (above).
- The Tailwind page moves to the guides, in one flavour.
- Islands hydrate when visible; a flavour that can't server-render uses `client:only` but still loads only when its tab opens.
- The site's tests join the existing e2e browser matrix rather than a separate workflow.
- Old Storybook URLs are mapped by a root-page script plus a static `iframe.html` redirect, not by keeping Storybook deployed.

## Left to the builder

- Package versions and integration options (Angular production mode, Analog settings), confirming the debug chunk goes away.
- Whether the theme creator moves into `apps/docs` or a private shared package.
- The exact page grouping and order in the sidebar, page prose, and how existing story JSDoc becomes page text.
- The interaction each feature's spec performs, the axe rules (as strict as Storybook's), and how the specs share helpers across flavours.
- How the completeness check finds examples (folder convention, or a manifest per page).
- The order in which features are ported, and how many per PR.
- The URL map for old Storybook links.
- Whether `apps/storybook/stories/recipes/*.mdx` and `getting-started.mdx` are retired at the switch or before.
