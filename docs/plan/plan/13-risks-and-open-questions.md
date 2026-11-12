# Risks and open questions

[← Back to contents](../README.md)

The biggest risk is the rendering combo (virtualization + sticky + slotted content) performing badly; the spike exists to find that out first.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Slotted light-DOM cells are slow at 100k rows | High → Low | Measured in the Phase 0 spike: as fast as shadow-only cells when row DOM is pooled; row-id keying is 2–17× slower and ruled out. See [ADR 0001](../../adr/0001-shadow-vs-light-dom.md). Real-Safari absolute check still due before v0.1 |
| `auto` width wrong for unloaded rows | Medium | Sample-based measuring, explicit `min`/`max`, document the limit |
| TanStack v9 API changes before stable | Medium | Wrap TanStack behind an internal adapter; never expose its types directly |
| Scope creep (editing, grouping requests) | Medium | Public roadmap and non-goals; plugin hooks instead of core features |
| Maintainer burnout as a solo project | High | Small core, wrappers generated from the manifest, good contributor docs, "good first issue" labels |
| Safari sticky/transform quirks | Low–Medium | WebKit in the CI matrix from day one |
| Rows past the engines' maximum element height can't be reached: Chromium and WebKit clamp the body at ≈33.5M px (row 838,866 of 1M at 40 px), Firefox drops a body over ≈17.9M px (≈450k rows) to 0 and doesn't scroll at all | Resolved | Scroll scaling (v0.2): the table measures the engine's limit, renders a body that tall at most and maps the scroll position linearly onto the rows (`ScrollScale` in core). Trade-off: past the limit a wheel step covers proportionally more rows. The benchmark's reach-the-end and "didn't scroll" checks guard it at 1M rows |
| Firefox lets go of an element stuck to the top of a scroller (the header, the top pinned rows) once the scroll offset passes about 8.95M px (2^29 of its 1/60 px units): deep in a large table the header disappeared ([#90](https://github.com/Joessst-Dev/argus-table/issues/90)) | Resolved | `max-height.ts` also checks that a sticky element stays in place at each height it tries, so Firefox's body stops at 8M px (scaled past about 200k rows of 40 px, instead of 450k); Chromium and WebKit keep 32M px. Trade-off: in Firefox a wheel step covers more rows in tables of 8M–17.9M px |
| Measured row heights (`rowHeight: 'auto'`) at 1M rows: TanStack Virtual recomputes every offset below a measured row, 14–23 ms per frame near the top of 1M rows | Resolved | Core's `RowSizes` (a Fenwick tree) takes O(log n) per height and per lookup; the virtualizer sits idle in this mode. Rows are on a whole-px grid (even px past 2^24 px) so they stay flush where engines round positions |
| Client-side sorting falls off a cliff in Firefox between 500k rows (2.5 s) and 750k rows (151 s); 1M takes minutes, while Chromium sorts 1M in ≈3 s and a plain `Array.sort` of the same rows takes 0.7 s in Firefox | Resolved | TanStack's row methods take rest arguments (`function (...args)`), and its sorted row model calls `row.getValue()` four times per comparison: in Firefox that alone made a 750k sort 176 s instead of 0.9 s. Core now has its own sorted row model (`table/sorted-row-model.ts`, same order and sort functions) that reads each value once and sorts the row positions: 1M rows sort in ≈0.8 s in Firefox and ≈0.65 s in Chromium |

## Open questions

- [x] Final name and npm scope: decided, Argus Table (`argus-table` + `@argus-table/*`)
- [x] Shadow DOM + slotted cells vs. full light DOM inside `@layer`: decided, shadow DOM with slotted light-DOM cells on pooled row DOM ([ADR 0001](../../adr/0001-shadow-vs-light-dom.md))
- [x] Framework wrappers at launch: decided, React, Vue and Angular wrappers all ship with v0.2
- [x] Row selection in v1 or v2? v1: `selectionMode` and `selection` (row ids), with the event `argus-selection-change`. `selection-checkboxes` adds a checkbox column with a select-all header.
- [ ] Expose TanStack's table instance as an escape hatch, or keep it private?
- [x] Formula columns with server-side data: disable sorting/filtering, or pass the syntax tree to `getRows`? Decided for now: disabled (no sorting, no filter kind) with a `dataSource`; passing the syntax tree stays open (see [Formula columns](09-formula-columns.md))
- [x] Filtering in v1? Yes: `columnFilters` (text, number, date and set filters, a per-column `filterFn`) and `quickFilter`, with the filter form in the column menu. The table filters with its own row model rather than TanStack's filtering feature (bundle size, Firefox speed), which raised the CDN budget from 50 to 51 kB.
