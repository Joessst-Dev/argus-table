# Benchmarks

The scroll benchmark from the Phase 0 rendering spike ([ADR 0001](../docs/adr/0001-shadow-vs-light-dom.md)), kept for Phase 1.

- `run.ts` serves a built page, drives each scenario in Chromium, Firefox and WebKit with Playwright, and writes medians plus a gate verdict (p95 ≤ 20 ms, no long task over 50 ms).
- `page-hooks.ts` runs inside the page: the scenarios (steady, fast, jumps, horizontal), frame timing, long tasks and the blank-row and wrong-content checks.

**Parked:** both files still target the deleted `apps/spike` and are not built, linted or run in CI. The rendering PR (P3) points them at `apps/playground`, adds `pnpm bench` and a `benchmark.yml` workflow that runs nightly and on PRs labelled `perf`. Until then, the last spike results are in ADR 0001 and in the `spike-bench` workflow artifacts.
