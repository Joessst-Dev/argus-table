# Setup checklist

[← Back to contents](../README.md)

Do these in order during Phase 0; each step is small, and CI should be green before any table code is written.

- [ ] Create the GitHub repo (public, MIT) and reserve the npm scope `@argus-table`
- [ ] Root config: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, ESLint, Prettier, `.nvmrc`, `.editorconfig`
- [ ] `nx init` (package-based); set `targetDefaults` and named inputs; root scripts as thin aliases
- [ ] Empty `packages/table` with one trivial Lit element + one Vitest browser test
- [ ] `ci.yml` with `setup`, `lint`, `unit`, `build` jobs using `nx affected`; turn on branch protection
- [ ] Storybook in `apps/storybook` + `docs.yml` deploying to GitHub Pages
- [ ] Changesets + `release.yml` (with `--skip-nx-cache`); publish `0.0.1` by hand, then link npm trusted publishing
- [x] Issue/PR templates, CODEOWNERS, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY (CoC contact email still to fill in)
- [ ] Renovate + CodeQL
- [ ] Add `e2e`, `visual`, `a11y`, `examples`, `size-limit` jobs as the spike produces something to test
- [ ] Wrapper packages + `scripts/generate-wrappers.ts` once the element API is drafted
- [ ] When CI gets slow: connect Nx Cloud (Hobby), read-write token as a `main`-only secret, read-only token for PRs
- [ ] At public launch: apply for the Nx Cloud open-source plan
