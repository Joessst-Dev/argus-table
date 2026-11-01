# GitHub Actions workflows

[← Back to contents](../README.md)

Five workflows; `ci.yml` and CodeQL gate merges, the rest publish docs, releases and reports.

| Workflow | Trigger | Jobs | Blocks merge |
| --- | --- | --- | --- |
| `ci.yml` | Pull request, push to `main` | See job list below | Yes |
| `docs.yml` | Push to `main`; pull request | Build Storybook; deploy to GitHub Pages on `main`, preview deploy per pull request | No |
| `release.yml` | Push to `main` | Changesets: open/refresh "Version packages" PR; when merged, publish to npm and create GitHub releases | — |
| `benchmark.yml` | Nightly; pull request with `perf` label | Run benchmarks, compare with `main`, post results as a PR comment | No (warns) |
| `codeql.yml` | Weekly; pull request | CodeQL scan + dependency review | Yes, for high severity |

## `ci.yml` jobs

Run in parallel after one shared install job with the pnpm store cached.

| Job | What it runs | Matrix |
| --- | --- | --- |
| `setup` | Install with the pnpm store cached; `nrwl/nx-set-shas` sets the base/head commits for `affected` | — |
| `lint` | `nx affected -t lint typecheck` (ESLint, Prettier, `tsc --noEmit`) | — |
| `unit` | `nx affected -t test` — Vitest browser mode | Chromium, Firefox, WebKit |
| `build` | `nx affected -t build` — packages, manifest, generated wrappers, publint/attw, size-limit budget | — |
| `e2e` | `nx affected -t e2e` — Playwright tests in `tests/e2e` against the playground | Chromium, Firefox, WebKit |
| `visual` | `nx affected -t visual` inside the official Playwright Docker image so fonts match | Chromium |
| `a11y` | `nx affected -t test-storybook` — axe on every story | Chromium |
| `examples` | `nx affected -t smoke` — build and smoke-test the HTML, React, Vue and Angular example apps | Framework |
| `changeset` | `changeset status` — fails if a package changed without a changeset (skippable with a `no-changeset` label for docs/CI-only PRs) | — |

Every job always runs and reports success when nothing is affected, so required checks in branch protection never hang waiting for a skipped job.

Visual snapshots are updated by a `workflow_dispatch` (or `/update-snapshots` label) that commits new images back to the PR branch, never by hand on a laptop.
