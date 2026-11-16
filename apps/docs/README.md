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
   - `html/index.html` (the markup, with ids prefixed by the example, e.g. `sorting-table`) and `html/main.js` (`import 'argus-table'`, typed with JSDoc: `checkJs` is on);
   - `react/<Name>.tsx` (a default-exported component; `ReactColumnDef` for columns with React content);
   - `vue/<Name>.vue` (`<script setup lang="ts">`, `v-model:<prop>`, `#cell-<id>` slots);
   - `angular/<name>.component.ts` (a standalone component, signals, `[(prop)]`, `ng-template argusCell`).

   Shared rows go in `src/examples/<feature>/data.ts`. Write each flavour the way that framework's users write code, with the packages' public API only.

2. **The page**, `src/content/docs/features/<feature>.mdx`, with `since: '<major>.<minor>'` in its frontmatter (the release the feature arrived in: "Since 1.3", or "Coming in 1.4" until that release):

   ```mdx
   import FlavourTabs from '../../../components/FlavourTabs.astro';
   import HtmlExample from '../../../components/HtmlExample.astro';
   import ReactX from '../../../examples/x/basic/react/X.tsx';
   import VueX from '../../../examples/x/basic/vue/X.vue';
   import { XComponent } from '../../../examples/x/basic/angular/x.component.ts';

   <FlavourTabs example="x/basic">
     <HtmlExample slot="html" example="x/basic" />
     <ReactX slot="react" client:visible />
     <VueX slot="vue" client:visible />
     <XComponent slot="angular" client:visible />
   </FlavourTabs>
   ```

   `FlavourTabs` takes `since` for an example newer than its page; `<Since since="1.4" />` marks a section.

3. **The spec**, `e2e/<feature>.spec.ts`: one page load, every flavour in turn with `openFlavour(page, '<feature>/<example>', flavour)`, the feature's interaction, an assertion on the flavour's own state, and `expectAccessible(page, example)`. `cellText(table, rowIndex, columnId)` reads a cell's text. See `e2e/sorting.spec.ts`.

## How it fits together

- `FlavourTabs` reads the example's files raw (`import.meta.glob`, `filesOf()` in `src/lib/sources.ts`) and shows them under each running flavour, so what is shown is what runs. Its tabs share `syncKey="flavour"`: a reader's choice holds across pages.
- Islands hydrate when visible (`client:visible`), so only the open tab's framework loads. `HtmlExample` loads the HTML flavour's `main.js` the same way.
- Each framework's integration sees only its files: React `**/examples/**/react/**`, Vue `.vue`, Angular through `tsconfig.angular.json` (Analog), which is also what `ngc` checks.
- The site's tables use `@argus-table/themes`; `src/components/Head.astro` mirrors Starlight's `data-theme` into `data-argus-theme`, so they follow the site's light and dark mode.
