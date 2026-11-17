# Tech stack decisions

[← Back to contents](../README.md)

Lit for the component, its own row model and row virtualization, Vite + TypeScript for builds, Storybook for docs.

| Area | Choice | Why | Rejected / alternative |
| --- | --- | --- | --- |
| Component layer | [Lit](https://lit.dev/) 3.x | ~5 KB, native custom elements, reactive controllers, OpenJS Foundation | Stencil: compiler lock-in, v5 still alpha in 2026 |
| Table logic | Own: core's table model, rows as indexes into `data` ([ADR 0010](../../adr/0010-own-row-model.md)) | Core had taken over sorting, filtering, pinning, ordering and visibility one by one; TanStack's row objects were ~280 B per row (297 MB at 1M rows) and ~8.4 kB gzipped | TanStack Table (`@tanstack/table-core` v9): used until 1.3 |
| Virtualization | Own: core's `RowSizes`, `ScrollScale` and `RowPool` in `VirtualController` ([ADR 0008](../../adr/0008-own-row-virtualization.md)) | Measured heights at 1M rows, scroll scaling and the steady window needed it anyway; ~10 kB less gzipped | TanStack Virtual (`@tanstack/lit-virtual`): used until 1.2; `@lit-labs/virtualizer`: lists only, no 2D |
| Language | TypeScript (strict) | Public types are part of the API | — |
| Build | Vite library mode, ESM only | Fast, simple, tree-shakeable | Rollup by hand |
| Monorepo | pnpm workspaces + Nx (package-based) | Separate packages for core, themes, wrappers; Nx orders tasks (core → table → wrappers), caches results and runs only affected work in CI | Turborepo: lighter, but no Angular build support or task inference |
| Unit/component tests | Vitest browser mode (Playwright provider) | Scroll and layout need a real browser | jsdom: no layout |
| Visual tests | Playwright screenshots per theme | Catches styling regressions | Chromatic (optional add-on) |
| Docs | Storybook 10, `@storybook/web-components-vite` | Interactive demos, controls from the manifest | VitePress/Starlight for long guides later |
| API metadata | Custom Elements Manifest analyzer | One source for Storybook, JSX/Vue types, VS Code hints | Hand-written types |
| Framework wrappers | `@argus-table/react` (via `@lit/react`), `@argus-table/vue`, `@argus-table/angular` | Typed props, events and two-way binding in all three; generated from the manifest so they stay in sync | Raw custom elements only: works, but untyped events and no `v-model` / `ngModel` |
| Releases | Changesets | Semver + changelogs per package | semantic-release |

