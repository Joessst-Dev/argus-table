# Quality gates and releases

[← Back to contents](../README.md)

One public GitHub monorepo, MIT license, and a CI pipeline that blocks merges on tests, size, accessibility and visual diffs. Full repo layout and workflows: [Repo and CI](../repo-and-ci/01-repo-layout.md).

## Before the first commit

- [x] Name chosen: Argus Table (npm names `argus-table` and `@argus-table/*` were free on 28 Oct 2026)
- [ ] Check GitHub org and domain availability
- [ ] Reserve the npm scope `@argus-table` and publish a placeholder `argus-table` package
- [x] CODE_OF_CONDUCT, CONTRIBUTING, SECURITY.md (CoC contact email still to fill in)
- [x] Add LICENSE (MIT)
- [x] Issue templates (bug with StackBlitz repro link, feature request)
- [ ] Public roadmap (GitHub Project or issue)

## Quality gates on every pull request

| Check | Tool | Blocks merge |
| --- | --- | --- |
| Types + lint | `tsc`, ESLint, Prettier | Yes |
| Unit/component tests | Vitest browser mode (Chromium, Firefox, WebKit) | Yes |
| Visual diffs per theme | Playwright screenshots | Yes |
| Accessibility | axe via Storybook a11y / Playwright | Yes |
| Bundle size | size-limit with a fixed budget | Yes |
| Scroll performance | Benchmark job | Warns only |
| Storybook preview | Deploy per pull request | No |

## Releases

- Changesets; every pull request that changes behaviour carries a changeset.
- `0.x` until the API was stable; 1.0 (12 November 2026) froze part names, tokens, events and properties. From then on, [ADR 0004](../../adr/0004-api-1-0.md)'s compatibility policy decides what needs a major release.
- npm provenance enabled; GitHub Actions publishes on merge to `main`.
- Browser support: last 2 versions of Chrome, Edge, Firefox, Safari.
