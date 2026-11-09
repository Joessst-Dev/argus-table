# Benchmarks

The benchmark behind the Storybook [Benchmarks](https://joessst-dev.github.io/argus-table/?path=/docs/benchmarks--docs) page. It started as the Phase 0 rendering spike's scroll test ([ADR 0001](../docs/adr/0001-shadow-vs-light-dom.md)) and is pointed at `apps/playground`: 10k / 100k / 1M rows × 20 columns.

```sh
pnpm bench                                         # Chromium, 5 runs, 10k / 100k / 1M rows
BROWSERS=chromium,firefox,webkit RUNS=3 pnpm bench
ROWS=100000 pnpm bench                             # one row count
VARIANTS=pin=,pin=none BROWSERS=webkit pnpm bench  # compare playground variants
pnpm --filter @argus-table/benchmarks merge results/   # write published/ from the newest result per browser
```

- `ROWS` is a comma list of row counts (the playground's `rows=` parameter). `VARIANTS` is a comma list of playground query strings. Each run goes through every row count and variant in rotating order on the same browser. Use variants to compare two versions: CI runners differ too much between jobs for separate runs to be comparable. `pin=` stands for the default page; `pin=none` drops the pinned columns. `VARIANTS="cols=500,cols=500&vcols"` compares a 500-column table without and with column virtualization (`columns` in the results stays the default page's 20; the variant says how many). On GitHub, run `benchmark.yml` by hand with the `rows` and `variants` inputs.
- `run.ts` builds nothing itself: `pnpm bench` first builds the playground through Nx, then `run.ts` serves `apps/playground/dist`, drives each page with Playwright and writes medians plus a gate verdict to `results/` (git-ignored) and, in CI, the job summary. `markdown.ts` writes the summary, and `types.ts` is the results file's shape.
- The in-page side is `apps/playground/src/bench-hooks.ts`, loaded with `?bench`. With it, the playground generates the data but leaves the table unmounted until the runner calls `mount()`.

## What each page measures

In this order, per browser, row count and run:

1. **Memory baseline** (Chromium only): the JS heap with the data alone, after a forced GC through the DevTools protocol (`HeapProfiler.collectGarbage`, `Performance.getMetrics`). Firefox and WebKit expose nothing comparable, so they report `n/a`.
2. **Load:** `mount()` appends the table and times it up to the frame that paints its rows. Then the heap again: **table heap** is the difference.
3. **Scroll scenarios:** steady (60 px/frame for 10 s), fast (240 px/frame), jumps (20 seeded random jumps held 500 ms, with a check that each row shows its own content), horizontal (60 px/frame for 5 s, turning back at each end, so the speed is the same whatever the table's width; until argus-table 0.2.2 it was "the full width and back over 5 s", about 8 px/frame on the default page), and in Chromium a real-input wheel run. They record frame times, long tasks, blank frames and how far the body scrolled: a vertical scenario that didn't move it at all fails, because its frame times would look perfect.
4. **Reach the end:** scrolls to the very bottom, then calls `scrollToRow(last)`, and records the highest row rendered each time. Engines limit an element's height (Chromium and WebKit clamp it at about 33.5M px, row 838,866 of 1M at 40 px; Firefox drops anything over about 17.9M px to 0), so past that the table renders a shorter body and scales its scroll position. This check makes sure the last row is still reached at 1M rows.
5. The heap again: **heap growth** over the scrolling is a leak signal.
6. **Sort:** sets `sorting` (by amount) and times it up to the frame that paints the sorted rows. A sort still running after `SORT_TIMEOUT` ms (default 60,000) is abandoned: the page is closed and the sort reported as `> 60000`.

**Gate:** p95 ≤ 20 ms and no long task over 50 ms in each scroll scenario, and the last row reached. It is advisory: `.github/workflows/benchmark.yml` runs nightly, on demand, on PRs labelled `perf` and on argus-table releases, and never fails a PR.

## Publishing

On an `argus-table@*` release (or a manual run with `publish` ticked), the workflow's `publish` job merges the three engines' results with `merge.ts` into `published/latest.json` and `published/argus-table@<version>.json`, and opens a pull request with them. Once that is merged, the docs deploy shows the new numbers. The release event only starts the workflow when the release was created with the GitHub App token (see `release.yml`); otherwise, run the workflow by hand.

Headless numbers on shared runners are noisy and WebKit's are bound to the runner; compare runs from the same machine, and confirm absolute numbers in real Safari before a release (ADR 0001 follow-ups).
