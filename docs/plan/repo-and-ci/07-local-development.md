# Local development commands

[← Back to contents](../README.md)

Every CI job has a matching root script, so contributors can reproduce any failure locally.

| Command | Runs | Does |
| --- | --- | --- |
| `pnpm install` | — | Install all workspaces (Node version from `.nvmrc`, pnpm via Corepack) |
| `pnpm dev` | `nx run storybook:storybook` | Storybook with hot reload |
| `pnpm play` | `nx run playground:dev` | Vite playground for quick manual tests |
| `pnpm lint` | `nx run-many -t lint typecheck` | ESLint + Prettier + type check |
| `pnpm test` | `nx run-many -t test` | Vitest browser tests (headless Chromium; `--browser=all` for the full matrix) |
| `pnpm test:e2e` | `nx run-many -t e2e` | Playwright e2e |
| `pnpm test:visual` | `nx run-many -t visual` | Visual tests in Docker (same image as CI) |
| `pnpm build` | `nx run-many -t build` | Build every package + manifest + wrappers |
| `pnpm affected` | `nx affected -t lint test build` | What CI will run for your branch |
| `pnpm graph` | `nx graph` | Browse the project and task graph |
| `pnpm size` | `nx run argus-table:build` + `size-limit` | CDN bundle (min+gzip) against the budget in `packages/table/.size-limit.json` |
| `pnpm bench` | `nx run benchmarks:bench` | Run benchmarks locally |
| `pnpm changeset` | `changeset` | Add a release note for your change |
