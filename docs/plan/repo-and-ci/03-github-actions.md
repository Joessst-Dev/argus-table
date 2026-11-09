# GitHub Actions workflows

[← Back to contents](../README.md)

Five workflows; `ci.yml` and CodeQL gate merges, the rest publish docs, releases and reports.

| Workflow | Trigger | Jobs | Blocks merge |
| --- | --- | --- | --- |
| `ci.yml` | Pull request, push to `main` | See job list below | Yes |
| `docs.yml` | Push to `main`; pull request | Build Storybook; deploy to GitHub Pages on `main`, preview deploy per pull request | No |
| `release.yml` | Push to `main` | Changesets: open/refresh "Version packages" PR; when merged, publish to npm and create GitHub releases | — |
| `benchmark.yml` | Nightly; on demand; pull request with `perf` label; argus-table release | Run benchmarks at 10k / 100k / 1M rows in all three engines, results in the job summary; on a release (or on demand with `publish`), open a PR that updates `benchmarks/published/` for the Storybook Benchmarks page. Comparing a PR with `main` and posting a PR comment come later | No (warns) |
| `codeql.yml` | Weekly; pull request | CodeQL scan + dependency review | Yes, for high severity |

## `ci.yml` jobs

Run in parallel after one shared install job with the pnpm store cached.

| Job | What it runs | Matrix |
| --- | --- | --- |
| `setup` | Install with the pnpm store cached; `nrwl/nx-set-shas` sets the base/head commits for `affected` | — |
| `lint` | `nx affected -t lint typecheck` (ESLint, Prettier, `tsc --noEmit`) | — |
| `unit` | `nx affected -t test` — Vitest browser mode | Chromium, Firefox, WebKit |
| `build` | `nx affected -t build` — packages, manifest, generated wrappers, the bundled `.d.ts`, and the export checks (no `@argus-table/core` import left in `dist/`, publint, attw) | — |
| `size` | `pnpm size` — size-limit on the CDN build (`dist/cdn/argus-table.js`, everything inlined, min+gzip). Always runs, because a dependency bump can grow the bundle | — |
| `e2e` | `nx affected -t e2e` — Playwright tests in `tests/e2e` against the playground | Chromium, Firefox, WebKit |
| `visual` | `nx affected -t visual` inside the official Playwright Docker image so fonts match | Chromium |
| `a11y` | `nx affected -t test-storybook` — axe on every story | Chromium |
| `examples` | `nx affected -t smoke` — build and smoke-test the HTML, React, Vue and Angular example apps | Framework |
| `changeset` | `changeset status` — fails if a package changed without a changeset (skippable with a `no-changeset` label for docs/CI-only PRs) | — |

Every job always runs and reports success when nothing is affected, so required checks in branch protection never hang waiting for a skipped job.

Visual snapshots are updated by `visual-update.yml`, never by hand on a laptop. Start it from the Actions tab on the PR branch (Run workflow), or add the `update-snapshots` label to a pull request from this repository. It runs the visual tests with `--update-snapshots` in the same Playwright image, commits `tests/visual/__screenshots__` to the branch, removes the label and starts `ci.yml` on the new commit through `workflow_dispatch` (a push made with `GITHUB_TOKEN` starts no workflows by itself). Fork pull requests can't take that push; a maintainer updates their snapshots. `pnpm test:visual` runs the same image locally through Docker.
