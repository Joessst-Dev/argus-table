# Setup checklist

[← Back to contents](../README.md)

Do these in order during Phase 0; each step is small, and CI should be green before any table code is written.

- [x] Create the GitHub repo (public, MIT) and reserve the npm scope `@argus-table` (npm org created; `argus-table` and `@argus-table/themes` claimed with 0.0.1)
- [x] Root config: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, ESLint, Prettier, `.nvmrc`, `.editorconfig`
- [x] `nx init` (package-based); set `targetDefaults` and named inputs; root scripts as thin aliases
- [x] Empty `packages/table` with one trivial Lit element + one Vitest browser test
- [x] `ci.yml` with `setup`, `lint`, `unit`, `build` jobs using `nx affected`; turn on branch protection (branch protection: maintainer setting)
- [x] Storybook in `apps/storybook` + `docs.yml` deploying to GitHub Pages
- [x] Changesets + `release.yml` (with `--skip-nx-cache`); publish `0.0.1` by hand, then link npm trusted publishing
- [x] Issue/PR templates, CODEOWNERS, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY (CoC contact email still to fill in)
- [x] Renovate + CodeQL (Renovate app still to install)
- [x] `size` job: size-limit on the CDN build, plus publint, attw and the bundled `.d.ts` in `build`
- [x] `e2e`, `visual` and `a11y` jobs
- [x] Before v0.1 (maintainer): hand-publish `argus-table@0.0.1` and `@argus-table/themes@0.0.1`, link trusted publishing for both, set `RELEASE_ENABLED=true`, and create the release GitHub App (`RELEASE_APP_CLIENT_ID`, `RELEASE_APP_KEY`). Steps: [First release](05-release-pipeline.md#first-release-v01)
- [x] Before v0.1 (maintainer): the real-Safari checks and the [screen-reader check](../../a11y/screen-reader-check.md) from ADR 0001 (VoiceOver only; NVDA skipped for v0.1)
- [ ] `examples` job, with the wrappers
- [x] Wrapper packages + `tools/generate-wrappers` (React, Vue and Angular)
- [ ] Before the first release with a new wrapper (maintainer): hand-publish it as `0.0.1` and link trusted publishing (`@argus-table/react`, `@argus-table/vue` and `@argus-table/angular`)
- [ ] When CI gets slow: connect Nx Cloud (Hobby), read-write token as a `main`-only secret, read-only token for PRs
- [ ] At public launch: apply for the Nx Cloud open-source plan
