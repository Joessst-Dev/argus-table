# Packages

[← Back to contents](../README.md)

Six packages are published to npm; `@argus-table/core` stays private and is bundled into `argus-table`, so its API can change freely. The main package is unscoped so the install line stays short: `npm i argus-table`.

| Package | Build | Published | Depends on |
| --- | --- | --- | --- |
| `@argus-table/core` | `tsc` only (consumed from source) | No (`"private": true`) | TanStack Table, TanStack Virtual |
| `argus-table` | Vite library mode, ESM, `.d.ts` via `tsc` | Yes | `lit`, TanStack (as `dependencies`, not bundled) |
| `@argus-table/themes` | Lightning CSS (minify, nesting) | Yes | — |
| `@argus-table/react` | Vite library mode, `.d.ts` via `tsc`; bindings generated from the manifest | Yes | `argus-table`, `@lit/react`; `react` as peer |
| `@argus-table/vue` | Vite library mode, `.d.ts` via `tsc`; bindings generated from the manifest | Yes | `argus-table`; `vue` as peer |
| `@argus-table/angular` | ng-packagr (Angular Package Format, partial compilation); bindings generated from the manifest | Yes | `argus-table`; `@angular/core` 20–22 as peer |
| `@argus-table/header-menu` (Phase 3) | Vite library mode, `.d.ts` via `tsc` | Yes | `argus-table` and `lit` as peers (a plugin: it imports only types from `argus-table`) |
| `@argus-table/formulas` (Phase 3) | Vite library mode, `.d.ts` via `tsc`; engine tests in Node, plugin tests in the browser | Yes | `argus-table` and `lit` as peers (a plugin, like the header menu); its own size budget (8 kB) |

## Generated wrappers

`tools/generate-wrappers` (private, Nx project `generate-wrappers`) reads `packages/table/dist/custom-elements.json` and writes `packages/<framework>/src/generated/elements.ts`: the element properties, one handler or output per `@fires` event (typed from `@fires {CustomEvent<…>}`), and two-way binding for `sorting`, `columnSizing`, `columnOrder` and `selection`. It fails when a property or event it binds is missing, when an event has no type, or when an event's Angular output takes the name of a two-way output (`selectionChange` for `[(selection)]`).

- The generated file is committed, so an API change shows up in the wrapper's diff. Each wrapper's `lint` runs the generator with `--check` and fails when the file is stale; `pnpm --filter @argus-table/<framework> generate` rewrites it.
- The generator runs from source with Node's type stripping. Wrappers depend on it through Nx `implicitDependencies`, not a package dependency, so nothing private lands in a published `package.json`.
- Framework glue that isn't derived from the manifest is hand-written: the type re-exports in each wrapper's `src/index.ts`, and in Vue the runtime (`src/define.ts`) that turns the generated description of an element into a component.
- Angular publishes from its own folder like the others: `exports` points into ng-packagr's `dist/`, and `scripts/clean-dist.mjs` removes the `dist/package.json` ng-packagr writes (it still holds `workspace:*`). Template types are checked by `ngc` with strict templates (`tsconfig.types.json`); it only checks templates when it emits, so it writes to `node_modules/.cache`. The build is linked and type-checked by Angular 20 and 21 too, which is why the peer range starts at 20.

## Publishing rules

- `"type": "module"`, explicit `exports` map per entry point, `"sideEffects"` listing only the files that call `customElements.define`.
- `argus-table` also ships a pre-bundled CDN build (`dist/cdn/argus-table.js`) for `<script type="module">` users via jsDelivr/unpkg.
- Wrapper packages, add-ons (`@argus-table/header-menu`, `@argus-table/formulas`) and `argus-table` are versioned together (Changesets `fixed` group) so `@argus-table/vue@0.3.0` always means `argus-table@0.3.0`, and an add-on's `argus-table` peer range follows each release. Themes version independently. A new wrapper is hand-published once as `0.0.1` and linked to npm trusted publishing before its first release, like the other packages.
- `scripts/check-exports.ts` runs [publint](https://publint.dev/) and [Are the Types Wrong](https://arethetypeswrong.github.io/) on every build.
