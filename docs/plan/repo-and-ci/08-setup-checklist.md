# Setup checklist

[← Back to contents](../README.md)

Do these in order during Phase 0; each step is small, and CI should be green before any table code is written.

- [x] Create the GitHub repo (public, MIT) and reserve the npm scope `@argus-table` (npm org created; `argus-table` placeholder not published yet)
- [x] Root config: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, ESLint, Prettier, `.nvmrc`, `.editorconfig`
- [x] `nx init` (package-based); set `targetDefaults` and named inputs; root scripts as thin aliases
- [x] Empty `packages/table` with one trivial Lit element + one Vitest browser test
- [x] `ci.yml` with `setup`, `lint`, `unit`, `build` jobs using `nx affected`; turn on branch protection (branch protection: maintainer setting)
- [x] Storybook in `apps/storybook` + `docs.yml` deploying to GitHub Pages
- [x] Changesets + `release.yml` (with `--skip-nx-cache`); publish `0.0.1` by hand, then link npm trusted publishing (workflow in place behind `RELEASE_ENABLED`; hand publish and trusted publishing still to do)
- [x] Issue/PR templates, CODEOWNERS, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY (CoC contact email still to fill in)
- [x] Renovate + CodeQL (Renovate app still to install)
- [x] `size` job: size-limit on the CDN build, plus publint, attw and the bundled `.d.ts` in `build`
- [ ] Add `e2e`, `visual`, `a11y`, `examples` jobs as the table grows
- [ ] Wrapper packages + `scripts/generate-wrappers.ts` once the element API is drafted
- [ ] When CI gets slow: connect Nx Cloud (Hobby), read-write token as a `main`-only secret, read-only token for PRs
- [ ] At public launch: apply for the Nx Cloud open-source plan
