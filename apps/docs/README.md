# @argus-table/docs

The docs site: Astro with Starlight, every feature shown in plain HTML, React, Vue and Angular, each running next to the code that runs it. Design: `docs/superpowers/specs/2026-11-16-docs-site-design.md`.

Not deployed yet: CI builds it on every pull request and uploads it as the `docs-site` artifact. Storybook stays the published docs until every feature is here.

```bash
pnpm nx run docs:build                    # apps/docs/dist
pnpm nx run docs:preview                  # http://localhost:4321/argus-table/
pnpm nx run docs:lint                     # ESLint, and every example has its four flavours
pnpm nx run docs:typecheck                # astro check, tsc, vue-tsc, ngc (strict templates)
pnpm nx run docs:test                     # Vitest: the site's helpers and scripts
BROWSERS=chromium pnpm nx run docs:e2e    # Playwright + axe against the built site
```

## Adding a feature page

Every example on a feature page has all four flavours; `lint` and the build fail otherwise.

1. **The example's files**, in `src/examples/<feature>/<example>/`:
   - `html/index.html` (the markup; every `id` starts with `<feature>-<example>-`, e.g. `sorting-basic-table`, and no two examples share one) and `html/main.js` (`import 'argus-table'`, typed with JSDoc: `checkJs` is on);
   - `react/<Name>.tsx` (a default-exported component; `ReactColumnDef` for columns with React content);
   - `vue/<Name>.vue` (`<script setup lang="ts">`, `v-model:<prop>`, `#cell-<id>` slots; `vue-tsc` checks templates strictly);
   - `angular/<name>.component.ts` (a standalone component, signals, `[(prop)]`, `ng-template argusCell`).

   Shared rows go in `src/examples/<feature>/data.ts`, shown after each flavour's files. Write each flavour the way that framework's users write code, with the packages' public API only.

2. **The page**, `src/content/docs/features/<feature>.mdx`, with `since: '<major>.<minor>'` in its frontmatter (the release the feature arrived in: "Since 1.3", or "Coming in 1.4" until that release):

   ```mdx
   import FlavourTabs from '../../../components/FlavourTabs.astro';
   import ReactX from '../../../examples/x/basic/react/X.tsx';
   import VueX from '../../../examples/x/basic/vue/X.vue';
   import { XComponent } from '../../../examples/x/basic/angular/x.component.ts';

   <FlavourTabs example="x/basic">
     <ReactX slot="react" client:visible />
     <VueX slot="vue" client:visible />
     <XComponent slot="angular" client:visible />
   </FlavourTabs>
   ```

   `FlavourTabs` mounts the HTML flavour itself; the three islands are imported from the example's own folders and load `client:visible` (`lint` checks both). It takes `since` for an example newer than its page; `<Since since="1.4" />` marks a section.

3. **The spec**, `e2e/<feature>.spec.ts` (`lint` fails for an example no spec opens): a test per flavour (`for (const flavour of FLAVOURS) test(...)`, each in a fresh page, so saved state starts empty) that opens it with `openFlavour(page, '<feature>/<example>', flavour)`, does the feature's interaction, asserts on the flavour's own state, and ends with `expectAccessible(page, example)`. `e2e/flavours.ts` has helpers to read the table: `cellText`, `bodyCell`, `bodyRows`, `headerTexts`, `headerOrder`, `truncated`. See `e2e/sorting.spec.ts`.

## How it fits together

- `FlavourTabs` reads the example's files raw (`import.meta.glob`, `filesOf()` in `src/lib/sources.ts`) and shows them under each running flavour, so what is shown is what runs. Its tabs share `syncKey="flavour"`: a reader's choice holds across pages.
- Islands hydrate when visible (`client:visible`), so only the open tab's framework loads. `HtmlExample` loads the HTML flavour's `main.js` the same way.
- Each framework's integration sees only its files: React `**/examples/**/react/**`, Vue `.vue`, Angular through `tsconfig.angular.json` (Analog), which is also what `ngc` checks.
- The API reference (`src/pages/api/`) is generated at build time: the elements from `argus-table/custom-elements.json` through the wrapper generator's reader (`src/lib/api/elements.ts`, so the React, Vue and Angular binding names are the wrappers' own), the types from the TypeScript sources with the compiler API (`src/lib/api/types.ts`). A new property, event, part, token or exported interface or type alias appears there with no change to the site; an exported enum fails the build (`readTypes` can't show it), and an add-on event needs its package named in its description (the generator's `ADDON_EVENTS`).
- The Migration pages are the integrate skill's `skills/argus-table-integrate/references/migrate/*.md` and `gaps.md`, read where they are by the `migration` collection (`src/content.config.ts`) and rendered unchanged, so the skill and the site share one source. `src/lib/migration.ts` lists them (the sidebar and the overview, so a new guide needs no page or config change; `migration.test.ts` and `e2e/migration.spec.ts` list the guides by name, so add it there) and adds two plugins to Astro's Markdown processor (Sätteri) for those files only: they drop the file's `# ` title (the page shows it), rewrite links (to the page for a rendered file, else to the file on GitHub, anchors kept; a link to a missing file fails the build), wrap code blocks' long lines and make tables focusable (they scroll sideways). Astro caches rendered Markdown by file: after changing the plugins, or deleting or renaming a file a guide links to, delete `node_modules/.astro` before building (CI builds fresh).
- The Themes pages (`src/content/docs/themes/`) preview each shipped theme with `<ThemePreview>` (`src/components/themes/theme-preview.ts`): the orders table from `@argus-table/theme-creator/orders` in a shadow root that adopts the theme's shipped file (`@argus-table/themes/<theme>.css?raw`), so the site's own `default.css` can't reach it; `scheme="auto"` follows the site's light and dark mode. Pages whose theme needs a font import it from `@fontsource` in the MDX, so only they load it.
- The theme creator page (`themes/creator.mdx`) embeds `@argus-table/theme-creator` (`packages/theme-creator`, shared with Storybook). Its "Copy a link" links open this page (`shareUrl` unset); the theme skill's links still open Storybook's creator until the site replaces Storybook.
- The site's tables use `@argus-table/themes`; `src/components/Head.astro` mirrors Starlight's `data-theme` into `data-argus-theme`, so they follow the site's light and dark mode.
