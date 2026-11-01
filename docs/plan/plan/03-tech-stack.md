# Tech stack decisions

[← Back to contents](../README.md)

Lit for the component, TanStack for table logic and virtualization, Vite + TypeScript for builds, Storybook for docs.

| Area | Choice | Why | Rejected / alternative |
| --- | --- | --- | --- |
| Component layer | [Lit](https://lit.dev/) 3.x | ~5 KB, native custom elements, reactive controllers fit TanStack, OpenJS Foundation | Stencil: compiler lock-in, v5 still alpha in 2026 |
| Table logic | [TanStack Table](https://tanstack.com/table/latest/docs/framework/lit/quick-start) (`@tanstack/lit-table`) | Pinning, sizing, sorting, filtering, ordering already solved and tested | Own engine: months of work, no ecosystem |
| Virtualization | [TanStack Virtual](https://tanstack.com/table/latest/docs/framework/lit/guide/virtualization) (`@tanstack/lit-virtual`) | Official Lit adapter, rows and columns, dynamic measuring | `@lit-labs/virtualizer`: lists only, no 2D |
| Language | TypeScript (strict) | Public types are part of the API | — |
| Build | Vite library mode, ESM only | Fast, simple, tree-shakeable | Rollup by hand |
| Monorepo | pnpm workspaces + Nx (package-based) | Separate packages for core, themes, wrappers; Nx orders tasks (core → table → wrappers), caches results and runs only affected work in CI | Turborepo: lighter, but no Angular build support or task inference |
| Unit/component tests | Vitest browser mode (Playwright provider) | Scroll and layout need a real browser | jsdom: no layout |
| Visual tests | Playwright screenshots per theme | Catches styling regressions | Chromatic (optional add-on) |
| Docs | Storybook 10, `@storybook/web-components-vite` | Interactive demos, controls from the manifest | VitePress/Starlight for long guides later |
| API metadata | Custom Elements Manifest analyzer | One source for Storybook, JSX/Vue types, VS Code hints | Hand-written types |
| Framework wrappers | `@argus-table/react` (via `@lit/react`), `@argus-table/vue`, `@argus-table/angular` | Typed props, events and two-way binding in all three; generated from the manifest so they stay in sync | Raw custom elements only: works, but untyped events and no `v-model` / `ngModel` |
| Releases | Changesets | Semver + changelogs per package | semantic-release |

Pin TanStack Table to v9; check whether it is on the stable or beta npm tag when starting.
