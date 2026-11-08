# Repo layout

[← Back to contents](../README.md)

One public GitHub monorepo (pnpm workspaces + Nx) with GitHub Actions; every pull request is fully checked in under ~10 minutes, and merges to `main` release through Changesets.

Published code lives in `packages/`; everything that only exists to develop, test or demo it lives in `apps/`, `tests/` and `benchmarks/`.

```text
argus-table/
├─ .github/
│  ├─ workflows/            ci.yml · docs.yml · release.yml · benchmark.yml · codeql.yml
│  ├─ ISSUE_TEMPLATE/       bug.yml · feature.yml · config.yml
│  ├─ PULL_REQUEST_TEMPLATE.md
│  ├─ CODEOWNERS
│  └─ renovate.json
├─ .changeset/              pending release notes (one file per change)
├─ packages/
│  ├─ core/                 @argus-table/core     internal, bundled into table, not published
│  ├─ table/                argus-table           the <argus-table> + <argus-column> elements
│  ├─ themes/               @argus-table/themes   default.css · material.css · …
│  ├─ react/                @argus-table/react    @lit/react components, bindings generated from the manifest
│  ├─ vue/                  @argus-table/vue
│  ├─ angular/              @argus-table/angular  standalone components, built with ng-packagr
│  └─ formulas/             @argus-table/formulas added in Phase 3
├─ apps/
│  ├─ storybook/            docs site (Storybook 10)
│  ├─ playground/           Vite sandbox for quick manual testing
│  └─ examples/
│     ├─ html/  ├─ react/  ├─ vue/  └─ angular/   smoke-test apps, also StackBlitz starters
├─ tests/
│  ├─ e2e/                  Playwright: scroll, resize, keyboard, infinite loading
│  └─ visual/               Playwright screenshots per theme × density × dark mode
├─ benchmarks/              10k / 100k / 1M rows, FPS + memory
├─ tools/
│  └─ generate-wrappers/    reads the manifest, writes each wrapper's src/generated/elements.ts
├─ scripts/                 visual.sh
├─ docs/adr/                architecture decision records (e.g. 0001-shadow-vs-light-dom.md)
├─ .nx/                     local Nx cache + workspace data (git-ignored)
├─ nx.json                  targetDefaults, named inputs, plugins (no access token in here)
├─ custom-elements.json     generated manifest (git-ignored, built in CI)
├─ package.json             thin script aliases for nx + "packageManager": "pnpm@…"
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ eslint.config.js · .prettierrc · .editorconfig · .nvmrc
└─ LICENSE · README.md · CONTRIBUTING.md · CODE_OF_CONDUCT.md · SECURITY.md
```

Unit tests sit next to the code (`packages/table/src/**/*.test.ts`); cross-package browser tests live in `tests/`.
