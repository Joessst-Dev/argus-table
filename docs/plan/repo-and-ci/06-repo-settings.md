# Repo settings and governance

[← Back to contents](../README.md)

`main` is always releasable: nothing lands without green CI and a review, and nobody (including you) pushes to it directly.

## Branch protection on `main`

- Require pull requests, 1 approving review (you, as CODEOWNER, while solo)
- Required checks: all `ci.yml` jobs + CodeQL
- Require branches to be up to date; squash merge only; delete branch after merge
- Block force pushes and deletions

## Publishing security

- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) from `release.yml`: no long-lived `NPM_TOKEN`, provenance attached automatically. The workflow needs `id-token: write`.
- Each package's npm settings point at this repo and `release.yml`; then set "require 2FA and disallow tokens". The very first publish of a new package name may need to be done by hand before the trusted publisher can be linked.
- Workflow permissions default to read-only; third-party actions pinned to a commit SHA (Renovate keeps them updated).

## Contributor experience

- Issue forms: bug (requires a StackBlitz repro link + browser), feature request, and a `config.yml` that routes questions to GitHub Discussions.
- Pull request template: what/why, screenshots for visual changes, "changeset added" checkbox.
- Labels: `good first issue`, `help wanted`, `theme`, `a11y`, `perf`, `breaking`, `no-changeset`.
- Renovate: weekly grouped updates (dev deps auto-merge when CI is green; Lit and TanStack get their own PRs).
- SECURITY.md pointing to GitHub private vulnerability reporting.
- ADRs in `docs/adr/` for decisions contributors will ask about (shadow vs. light DOM, TanStack wrapping, versioning).
