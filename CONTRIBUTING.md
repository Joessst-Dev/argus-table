# Contributing to Argus Table

Thanks for your interest in helping. This guide explains how to propose changes and what a good pull request looks like.

> **Status:** v0.1. The table has virtualized rows, pinned columns, sorting, resizing, keyboard navigation and the default theme. Bug reports against v0.1 are the most useful contributions right now, along with feedback on the [public API](docs/plan/plan/07-public-api.md) before it freezes at 1.0. The [roadmap](docs/plan/plan/12-roadmap.md) lists what comes next.

## Ways to help

- **Report bugs** with the bug template and a minimal reproduction (a StackBlitz link is ideal).
- **Suggest features** with the feature template. Check the [goals and non-goals](docs/plan/plan/02-goals-and-non-goals.md) first: the core stays small on purpose, and some ideas fit better as plugins.
- **Improve docs and themes.** Typos, clearer examples and new theme ideas are always welcome.
- **Pick up an issue** labelled `good first issue` or `help wanted`. Comment on it first so nobody duplicates work.

For anything bigger than a small fix, open an issue or discussion before writing code, so we can agree on the approach.

## Development setup

The repository is a pnpm + Nx monorepo:

```bash
corepack enable          # gives you the pinned pnpm version
pnpm install
pnpm dev                 # Storybook with hot reload
pnpm lint                # ESLint + type check (pnpm format:check for Prettier)
pnpm test                # Vitest browser tests (Chromium; BROWSERS=all for all three)
pnpm build               # build every package
pnpm test:e2e            # Playwright e2e against the playground (BROWSERS=chromium for one engine)
pnpm test:visual         # screenshots in the Playwright Docker image (needs Docker)
pnpm affected            # what CI will run for your branch
```

The full command list is in [Local development commands](docs/plan/repo-and-ci/07-local-development.md).

## Making a change

1. Fork the repository and create a branch from `main` (for example `fix/resize-handle-rtl` or `feat/row-selection`).
2. Make your change with tests. Unit tests sit next to the code; browser-level tests live in `tests/`.
3. Add a changeset with `pnpm changeset` if the change affects a published package. Describe it from a user's point of view; it becomes the changelog entry.
4. Run `pnpm lint` and `pnpm test` locally.
5. Open a pull request and fill in the template.

### What CI checks

Every pull request runs Prettier, lint and type checks, unit and e2e tests in Chromium, Firefox and WebKit, the package build with export checks, the bundle size budget, axe on every Storybook story, and visual screenshot tests of the default theme. All checks must pass before merging. See [GitHub Actions workflows](docs/plan/repo-and-ci/03-github-actions.md).

### Visual changes

If your change intentionally alters how the table looks, the visual tests will fail. Add the `update-snapshots` label (a maintainer can do this for you) and CI commits the new screenshots to your branch. Please don't update snapshots on your own machine: fonts render differently outside the CI image.

## Guidelines

- **Public API is a contract.** Properties, events, CSS custom properties (`--argus-*`) and part names are hard to change once released. Discuss new ones in an issue first.
- **Styling stays in CSS.** No hard-coded colours in components; every value reads a token with a neutral fallback.
- **Accessibility is not optional.** New interactive behaviour needs keyboard support and correct ARIA roles, following the WAI-ARIA grid pattern.
- **Keep TanStack internal.** TanStack types must not leak into the public API; go through `@argus-table/core`.
- **Each feature gets a Storybook story.** Stories double as documentation and tests.

## Reviews and merging

A maintainer reviews every pull request. Pull requests are squash-merged, so the pull request title becomes the commit message. Releases are batched through a "Version packages" pull request; your change ships with the next release after it's merged.

## Code of Conduct and security

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Please report security issues privately as described in [SECURITY.md](SECURITY.md), never in a public issue.

## License

Argus Table is released under the [MIT license](LICENSE). By contributing, you agree that your contributions are licensed under the same terms.
