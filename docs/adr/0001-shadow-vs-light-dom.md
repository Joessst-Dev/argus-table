# ADR 0001: Shadow DOM with slotted light-DOM cells, on pooled row DOM

- **Status:** Accepted (3 November 2026). The real-Safari check before v0.1 was done on 7 November 2026: see [Pinned columns in Safari](#addendum-pinned-columns-in-safari-phase-1).
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

- [x] **Absolute check in real Safari** (done 7 November 2026, see [Pinned columns in Safari](#addendum-pinned-columns-in-safari-phase-1)): on a Mac, run the benchmark against the Phase 1 playground (`BROWSERS=webkit pnpm bench`, added with the rendering PR), and scroll the playground in Safari with the Web Inspector timeline open. The spike that produced the numbers above has been removed; its harness lives on in `benchmarks/`.
- [ ] Re-measure Firefox fast scrolling on real hardware, where vsync is more stable.
- [x] **Pinned columns in real Safari** (done 7 November 2026: they stuttered, and the pinning was rebuilt; see [Pinned columns in Safari](#addendum-pinned-columns-in-safari-phase-1)): scroll the playground fast and sideways in Safari on a Mac, with and without `?pin=none`. Rebuild the pinning (a scroll-synced transform, or one sticky pane per side) only if the pinned version stutters. See the Pinned columns addendum.
- [x] A docs PR that updates the lit3 skill (body rows keyed by pool index, not row id; slotted nodes as direct host children; TanStack v9 API), the rendering, public API and accessibility plan pages, and the code-architecture pages (row pool).
- [x] Phase 1: choose between the two DOM-order options above. Pool order plus `aria-rowindex` was chosen; see the addendum below.
- [ ] Screen-reader check (planned before v0.1, half done): on the Phase 1 playground, test VoiceOver with Safari and NVDA with Firefox. Rows must be read in visual order, with the right row and column numbers, while scrolling. The steps are in [Screen-reader check](../a11y/screen-reader-check.md). VoiceOver passed on 7 November 2026 (see [Screen-reader check](#addendum-screen-reader-check-phase-1)). NVDA with Firefox was skipped for v0.1 (no Windows machine available) and is still to do.
- [x] Phase 1: delete `apps/spike` and `spike-bench.yml`. The harness moved to `benchmarks/`.

## Addendum: sorted DOM (Phase 1)

**Question.** Can pooled body rows stay in row-index order in the DOM (nodes are moved, not recreated) at little cost? If so, screen readers that follow DOM order would read rows in visual order without relying on `aria-rowindex`.

**Method.** The spike gained `keying=sorted`. Rows are keyed by pool slot as before, but `repeat` receives them in row-index order, so Lit moves the existing row nodes into place. The light DOM stays in pool order: slotted content follows its slot in the flat tree, so its own order doesn't matter. `spike-bench` ran `pool` and `sorted` for both variants in all three engines on GitHub-hosted runners, with the same scenarios as above and the median of 5 runs ([run 41806791518](https://github.com/Joessst-Dev/argus-table/actions/runs/41806791518)).

**Rule, set before measuring.** Ship sorted only if its p95 and its median jump frame are within 10% of pool order in every engine.

**Results** (slotted variant, pool → sorted, ms):

| Engine       |         Steady p95 |           Fast p95 |      Median jump frame | Frames > 50 ms (jumps) |
| ------------ | -----------------: | -----------------: | ---------------------: | ---------------------: |
| Chromium 153 |        16.7 → 16.7 |        16.7 → 16.8 | **16.7 → 33.3** (2.0×) |                  0 → 0 |
| Firefox 155  |        17.1 → 17.1 |    **17.1 → 33.3** | **17.1 → 50.3** (2.9×) |                 0 → 12 |
| WebKit 26.6  | **57 → 97** (1.7×) | **58 → 91** (1.6×) |     **71 → 88** (1.2×) |                20 → 19 |

- In the shadow variant, sorted is free in Chromium. In Firefox, its fast-scroll p95 still rises from 17.1 to 33.2 ms. In WebKit, its median jump frame rises from 70 to 77.5 ms.
- Moving nodes is cheaper than recreating them, as with row-id keying, but it is not free. A jump shuffles most of the window, and every moved row carries slots, which triggers slot assignment again. WebKit pays for that during ordinary scrolling as well.
- As above, WebKit's absolute numbers come from the runner. Its relative numbers fail the rule regardless.

**Decision.** Sorted fails the rule in every engine. Body rows stay in **pool order**, and every row carries `aria-rowindex` (and every cell `aria-colindex`), with `ariaRowCount`/`ariaColCount` on the host for the full size. Keyboard navigation moves by row index through the row model, never by DOM siblings.

**Consequences.**

- `RowPool` returns rows in pool order only; it has no row-index-order mode.
- Before v0.1, a screen-reader check on the playground must confirm that `aria-rowindex` is enough (see Follow-ups). If it isn't, revisit this decision, for example by sorting only when the window settles after a jump or a scroll.

## Addendum: pinned columns (Phase 1)

Pinned columns (#16) make the pinned header and body cells `position: sticky` inside the pooled, absolutely positioned rows. In CI, WebKit got slower with them, while Chromium and Firefox didn't change. To find out whether the number of sticky boxes was the cost, the harness learned to run playground variants interleaved on one runner (`VARIANTS`). WebKit runs in CI vary by 40% or more between jobs, so only a same-job comparison is meaningful.

Run 41877304706, 3 runs, all three variants interleaved in each run:

- `cells`: every pinned cell is sticky (shipped).
- `groups`: one sticky subgrid box per pinned side per row.
- `none`: the same columns, unpinned.

| WebKit p95 (ms)           |   cells |  groups |    none |
| ------------------------- | ------: | ------: | ------: |
| steady                    |      70 |      70 |      40 |
| fast                      |      44 |      45 |      17 |
| jumps (median jump frame) | 17 (49) | 35 (50) | 17 (19) |
| horizontal                |      38 |      36 |      17 |

Chromium is 16.7–16.8 ms in every variant and scenario, the real-input `wheel` check included, and Firefox is 17.1 ms. In Linux WebKit the cost comes from having any sticky box inside the rows, not from how many there are. Grouping didn't help, so `cells` stays: it's simpler and just as fast.

**Decision:** keep sticky cells for v0.1, and check real Safari first. CI's WebKit is a software-rendered Linux build, so it doesn't show what Safari on macOS does. The alternatives cost more and have drawbacks:

- **A scroll-synced `transform`:** pinned cells may lag a frame behind when scrolling sideways.
- **One sticky pane per side:** this splits rows across containers, so each row needs `aria-owns` to hold its cells together, and VoiceOver supports that poorly.

Build either one only if Safari shows the stutter (see Follow-ups).

## Addendum: pinned columns in Safari (Phase 1)

**Finding.** In Safari on macOS, the sticky pinned cells made vertical scrolling stutter visibly; `?pin=none` was smooth. Safari Web Inspector timelines of the production playground showed why. Every sticky element is a compositing layer of its own, and Safari moves each one on every scroll frame. With a sticky cell per pinned column per rendered row, that is dozens of layers. When recycled rows entered the window, Safari rebuilt and repainted about 70 of them in one frame, which took 22 ms of compositing alone. Linux WebKit in CI composites differently and doesn't show this. There, the cost was the blurred edge `box-shadow` that every pinned row painted.

**What was tried**, each as a playground variant and compared in Safari by feel and by timeline:

| Variant                                                                   | Safari   | Why not                                                                                                                                                      |
| ------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sticky cells without the edge shadow                                      | stutters | still one layer per cell                                                                                                                                     |
| Rows positioned with `top` instead of `transform`                         | stutters | the transformed row wasn't the cost                                                                                                                          |
| Pinned cells moved by a scroll-driven animation                           | stutters | one animated layer per cell; `container-type` on the scroller also stopped WebKit from scrolling                                                             |
| One sticky pane per side, rows owning their pinned cells with `aria-owns` | smooth   | axe's `aria-required-children` fails: axe adds owned cells to the row but doesn't take them away from the pane, so every page using the table would fail axe |
| **Hybrid** (shipped)                                                      | smooth   | —                                                                                                                                                            |

**Decision: the hybrid.** Pinned body cells stay in their rows, so the DOM and the accessibility tree are unchanged.

- **At rest, and while scrolling up and down,** they are plain cells shifted by the horizontal scroll offset (`transform: translateX(…)`). Vertical scrolling never changes that offset, so there are no extra layers.
- **While the table scrolls sideways,** the scroller carries `data-hscroll` and the cells are sticky, so they never lag behind the scroll. 150 ms after the last sideways scroll they switch back, at the same position (`PinScrollController`).
- **The edge shadow** is drawn once per pinned side, by an overlay over the scroller, instead of on every pinned row. `--argus-pinned-shadow` keeps its meaning.
- **Pinned header cells** stay sticky: it's one row.

Safari timelines of the production playground, the same session, Screenshots off, scrolling down. These ran at 120 Hz; the earlier sticky recording ran at 60 Hz.

| Safari, scrolling frames | `pin=none` |     Hybrid | Sticky cells (earlier recording) |
| ------------------------ | ---------: | ---------: | -------------------------------: |
| Frame p50 (ms)           |        8.9 |        8.6 |                             22.3 |
| Frame p95 (ms)           |       27.2 |       32.8 |                             50.0 |
| Frames over 34 ms        |       2.3% |       3.9% |                            23.8% |
| Composite avg / p95 (ms) |  4.8 / 8.4 | 4.9 / 14.2 |                       9.5 / 24.4 |

Linux WebKit, the playground benchmark, 3 runs interleaved (p95, ms):

| Scenario   | Sticky cells | Hybrid | `pin=none` |
| ---------- | -----------: | -----: | ---------: |
| steady     |           96 |     38 |         28 |
| fast       |           68 |     18 |         19 |
| jumps      |           26 |     21 |         27 |
| horizontal |           70 |     17 |         20 |

## Addendum: screen-reader check (Phase 1)

**Question.** Body rows stay in pool order in the DOM (see [Sorted DOM](#addendum-sorted-dom-phase-1)). Is `aria-rowindex` enough for screen readers to read them in visual order, with the right numbers?

**VoiceOver, 7 November 2026.** macOS 26.1, Safari 26.1, VoiceOver as shipped with macOS 26.1. The production playground at `?rows=1000&cols=8`, following the [screen-reader check](../a11y/screen-reader-check.md).

| Step                                   | Result |
| -------------------------------------- | ------ |
| 1. Name and size                       | pass   |
| 2. Headers                             | pass   |
| 3. Arrow keys, row by row              | pass   |
| 4. After scrolling                     | pass   |
| 5. Jump far away                       | pass   |
| 6. Screen-reader navigation, not focus | pass   |
| 7. Pinned columns                      | pass   |
| 8. Right to left                       | pass   |

**Result.** With VoiceOver, pool order plus `aria-rowindex` is enough: rows were read in visual order with the right numbers, including VoiceOver's own row navigation after a far jump (step 6), where DOM order would show first.

**Skipped for v0.1: NVDA with Firefox.** No Windows machine was available, so v0.1 ships with the VoiceOver result only. NVDA's browse mode reads from a virtual buffer built in DOM order, so step 6 there is the riskier case and the VoiceOver result doesn't cover it. If it fails, the fix stays the one named above: sort rows in the DOM only once scrolling settles, measured before it ships.
