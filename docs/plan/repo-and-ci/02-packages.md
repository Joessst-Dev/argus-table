# Packages

[← Back to contents](../README.md)

Five packages are published to npm; `@argus-table/core` stays private and is bundled into `argus-table`, so its API can change freely. The main package is unscoped so the install line stays short: `npm i argus-table`.

| Package | Build | Published | Depends on |
| --- | --- | --- | --- |
| `@argus-table/core` | `tsc` only (consumed from source) | No (`"private": true`) | TanStack Table, TanStack Virtual |
| `argus-table` | Vite library mode, ESM, `.d.ts` via `tsc` | Yes | `lit`, TanStack (as `dependencies`, not bundled) |
| `@argus-table/themes` | Lightning CSS (minify, nesting) | Yes | — |
| `@argus-table/react` | Vite library mode, generated from manifest | Yes | `argus-table`; `react` as peer |
| `@argus-table/vue` | Vite library mode, generated from manifest | Yes | `argus-table`; `vue` as peer |
| `@argus-table/angular` | ng-packagr (Angular Package Format) | Yes | `argus-table`; `@angular/core` as peer |
| `@argus-table/formulas` (Phase 3) | Vite library mode | Yes | `argus-table` as peer |

## Publishing rules

- `"type": "module"`, explicit `exports` map per entry point, `"sideEffects"` listing only the files that call `customElements.define`.
- `argus-table` also ships a pre-bundled CDN build (`dist/cdn/argus-table.js`) for `<script type="module">` users via jsDelivr/unpkg.
- Wrapper packages and `argus-table` are versioned together (Changesets `fixed` group) so `@argus-table/vue@0.3.0` always means `argus-table@0.3.0`. Themes version independently.
- `scripts/check-exports.ts` runs [publint](https://publint.dev/) and [Are the Types Wrong](https://arethetypeswrong.github.io/) on every build.
