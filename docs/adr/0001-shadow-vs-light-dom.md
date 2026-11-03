# ADR 0001: Shadow DOM with slotted light-DOM cells, on pooled row DOM

- **Status:** Accepted (3 November 2026). One condition is still open: an absolute frame-time check in real Safari before v0.1. See [Follow-ups](#follow-ups).
- **Decides:** the Phase 0 gate in [the roadmap](../plan/plan/12-roadmap.md), and the open question in [Risks and open questions](../plan/plan/13-risks-and-open-questions.md).
- **Evidence:** the throwaway spike in `apps/spike` and the `Spike benchmark` workflow run on PR #10. Its artifacts `spike-bench-chromium`, `spike-bench-firefox` and `spike-bench-webkit` contain the JSON, Markdown and screenshots.

## Context

The styling plan ([Styling and theming](../plan/plan/06-styling-and-theming.md)) has three layers. The third renders cell and header content into the **light DOM** and slots it into shadow-DOM cells, the pattern Vaadin Grid uses. That way page CSS, utility classes and the host app's own components work inside cells.

The biggest project risk was that this is too slow at 100k rows together with virtualization, sticky pinned columns and pinned rows. The planned fallback was shadow-DOM-only cells, styled through tokens and `::part()`, with slots kept only for custom cells. The gate:

- **Absolute:** p95 frame time ≤ 20 ms and no long task over 50 ms. Chromium is the primary engine; Firefox and WebKit are checked too.
- **Relative:** choose slotted cells if their p95 is within about 20% of shadow-only cells.

## Options

1. **`shadow`:** cell content renders inside the shadow-DOM cell.
2. **`slotted`:** the shadow-DOM cell holds `<slot name="c-{pool}-{col}">`, and the element renders the content as direct light-DOM children of the host.
   - Slot names come from a **pool**: each rendered row holds a pool index while it is in range, and freed indices are reused. The number of slots and light-DOM nodes stays bounded, at 42 rows × 22 = 924 nodes in this layout, no matter how far you scroll.

Each option was measured with two ways of keying the body rows:

- **`row`:** row DOM is keyed by row id. A row entering the window gets new DOM, which is the usual `repeat(rows, r => r.id)`.
- **`pool`:** row DOM is keyed by pool index, so a row entering the window reuses the DOM of one that left. The light DOM is rendered in pool order, so recycled slots update in place instead of moving.

## Method

- **The grid:** 100k seeded rows × 20 columns, built on TanStack Table v9 and TanStack Virtual (overscan 8), at 36 px rows.
  - A sticky header, 2 pinned top rows and 1 pinned bottom row.
  - 2 start-pinned columns and 1 end-pinned column, using `position: sticky` with logical insets.
  - A small custom element (`<spike-badge>`) in one column.
- **The page:** a 1280×800 viewport, headless.
- **Scenarios** are driven from the page, so every engine gets the same input:

  | Scenario   | What it does                                                                                                                 |
  | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
  | steady     | `scrollTop += 60px` per frame for 10 s, about 3,600 px/s                                                                     |
  | fast       | 240 px per frame for 10 s                                                                                                    |
  | jumps      | 20 seeded random jumps, holding 500 ms after each; the cost is the slowest frame right after each jump                       |
  | horizontal | full width and back over 5 s, with pinned columns sticking while content moves                                               |
  | wheel      | Chromium only: real wheel input through Playwright. A sanity check, not a gate, because its pacing is limited by the harness |

- **Runs:** for each engine, keying and variant, the median of 5 runs in fresh pages. The variant order alternates between runs. The runners were GitHub Actions `ubuntu-latest`, 4 vCPU and no GPU, with Chromium 153, Firefox 155 and WebKit 26.6 (Linux).
- **Long tasks** come from `PerformanceObserver('longtask')`, which only Chromium supports. In Firefox and WebKit, "frames over 50 ms" stands in.
- **Correctness was checked in every run:**
  - frames where the rendered window doesn't cover the viewport (blank rows);
  - after every jump, whether each visible row's first cell shows that row's own data;
  - light-DOM node counts.

  A Vitest browser smoke test covers both variants and both keyings in all three engines in CI.

## Results

Each cell gives slotted ÷ shadow. For steady, fast and horizontal that's the p95 frame time; for jumps it's the median jump frame. Raw medians are in brackets, shadow first and then slotted.

| Engine   | Keying |                 steady |                   fast |                    jumps | horizontal | Absolute gate                                         |
| -------- | ------ | ---------------------: | ---------------------: | -----------------------: | ---------: | ----------------------------------------------------- |
| Chromium | row    |                   0.99 |                   1.00 |   **2.33** (50 / 117 ms) |       0.99 | jumps fail for both                                   |
| Chromium | pool   |                   0.99 |                   1.00 |    1.00 (16.7 / 16.7 ms) |       1.00 | **pass in every scenario, both variants**             |
| Firefox  | row    |                   1.01 |                   1.02 |    **2.00** (33 / 67 ms) |       1.00 | fast and jumps fail                                   |
| Firefox  | pool   |                   1.00 |                  1.94¹ |        1.00 (17 / 17 ms) |       1.00 | pass, except slotted fast at p95 33 ms¹               |
| WebKit   | row    | **2.81** (43 / 121 ms) | **10.2** (47 / 480 ms) | **17.6** (69 / 1,217 ms) |       1.00 | fail for both                                         |
| WebKit   | pool   |                   1.02 |                   0.98 |        1.00 (57 / 57 ms) |       1.00 | fail for both²; shadow alone is about 40 ms per frame |

Across every engine, keying, variant and run, there were **0 blank-row frames** and **0 rows showing another row's content**. The light DOM never went above 924 nodes.

¹ **Firefox, pool, fast** is a quantization artifact, not a real gap.

- Frame times there are about 17 or 33 ms, so p95 flips to 33 ms once more than 5% of frames take two vsyncs.
- Everything else is the same for both variants: p99 is 33.2 ms for shadow and 33.3 ms for slotted, the max is 34.2 ms for both, and neither has a frame over 50 ms.
- This is a borderline result to re-measure on real hardware, not a failure of slotted content.

² **WebKit absolute numbers are inconclusive.** The Linux WebKit build on a GPU-less runner takes about 40 ms per frame even for shadow-only cells while scrolling steadily. The runner is the limit, not the design.

- The relative comparison is still valid, because both variants ran on the same runner, interleaved.
- An absolute check in real Safari is still owed.

**Profile of a row-keyed jump in Chromium.** For slotted cells, most of the time goes to DOM `insertBefore` and `remove`, about 33 ms per jump against about 7 ms for shadow-only cells. Creating and destroying rows means creating and destroying slots, and every slot change triggers slot assignment. WebKit pays far more for that than Blink or Gecko do. With pooled rows, a jump only updates text and attributes in DOM that already exists.

## Decision

1. **Keep the planned styling contract.** Cells are shadow-DOM elements whose content is slotted from the light DOM. Layer 3 of the styling plan stands, and page CSS and the host app's components work inside cells.
2. **Body rows must use pooled DOM.** Rendered rows hold a pool index while they are in range. Row DOM, cell DOM, slot names and the slotted light-DOM content are all keyed by that pool index and are updated in place when a new row takes the slot. Keying body rows by row id is ruled out: it costs 2× in Chromium and Firefox and up to 17× in WebKit.
3. **The fallback is not needed.** Shadow-only cells styled through tokens and parts, with slots kept for custom cells, would be no faster once rows are pooled. In Chromium they are the same within 1% in every scenario.
4. **Slot names stay private.** Slot names (`c-{pool}-{col}`) and pool indices are internal and can change at any time. Users style through tokens, parts and their own light-DOM content, never by slot name.

## Consequences

- **The renderer gets a row pool.** It assigns, keeps and frees pool indices for rendered rows, including pinned rows and overscan. It belongs next to the `VirtualController` (see the [module map](../plan/code-architecture/01-module-map.md)), and both the shadow-DOM body and the light-DOM content are rendered in pool order.
- **DOM order no longer follows visual order** in the body. Screen-reader virtual cursors and "read next row" can follow DOM order, so Phase 1 picks one of two fixes, using screen-reader tests from [Accessibility](../plan/plan/08-accessibility.md):
  - keep `aria-rowindex` and test that it's enough; or
  - keep the DOM sorted by row index while preserving identity per pool slot. That means moving existing nodes, which is much cheaper than recreating them; measure it before choosing.
- **Focus must survive recycling.** The row with the active cell keeps its pool slot (and stays rendered) while it is outside the range, so focus and the roving `tabindex` never land on a recycled row.
- **Slotted nodes must be direct host children.** A wrapper container in the light DOM can't hold them. Lit's `render(template, host, { host })` manages its own part and leaves `<argus-column>` children alone, so the element can own that part directly. The "one dedicated container" wording in the lit3 skill needs correcting.
- **TanStack Table v9 pins columns with logical positions** (`'start' | 'end'`, read with `column.getStart('start')` and `getAfter('end')`). Core's adapter doesn't need the planned `left`/`right` mapping. Row pinning is `'top' | 'bottom'` with `getTopRows()`, `getCenterRows()` and `getBottomRows()`. Virtualize `getCenterRows()`.
- **Header pinned cells need no new public part names.** The spike styles them through private `data-pin` and `data-edge` attributes and exposes only the planned `header-cell` part on headers.

## Follow-ups

- [ ] **Absolute check in real Safari** (needed before v0.1): on a Mac, run `BROWSERS=webkit pnpm --filter @argus-table/spike bench`, and scroll `apps/spike` (`pnpm --filter @argus-table/spike dev`, then `?variant=slotted&keying=pool`) in Safari with the Web Inspector timeline open.
- [ ] Re-measure Firefox fast scrolling on real hardware, where vsync is more stable.
- [ ] A docs PR that updates the lit3 skill (body rows keyed by pool index, not row id; slotted nodes as direct host children) and `code-architecture/02-render-cycle.md` and `06-source-layout.md` (row pool).
- [ ] Phase 1: choose between the two DOM-order options above, with screen-reader tests.
- [ ] Phase 1: delete `apps/spike` and `spike-bench.yml`. If the harness is still useful, move it to `benchmarks/`.
