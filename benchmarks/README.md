# Benchmarks

The scroll benchmark, carried over from the Phase 0 rendering spike ([ADR 0001](../docs/adr/0001-shadow-vs-light-dom.md)) and pointed at `apps/playground` (100,000 rows × 20 columns).

```sh
pnpm bench                                       # Chromium, 5 runs
BROWSERS=chromium,firefox,webkit RUNS=3 pnpm bench
```

- `run.ts` builds nothing itself: `pnpm bench` first builds the playground through Nx, then `run.ts` serves `apps/playground/dist`, drives each scenario with Playwright and writes medians plus a gate verdict to `results/` (git-ignored) and, in CI, the job summary.
- The in-page side (scenarios, frame timing, long tasks, blank-row and wrong-content checks) is `apps/playground/src/bench-hooks.ts`, loaded with `?bench`.
- **Gate:** p95 ≤ 20 ms and no long task over 50 ms. It is advisory: `.github/workflows/benchmark.yml` runs nightly, on demand and on PRs labelled `perf`, and never fails a PR.
- Headless numbers on shared runners are noisy and WebKit's are bound to the runner; compare runs from the same machine, and confirm absolute numbers in real Safari before a release (ADR 0001 follow-ups).
