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
| Client-side sorting falls off a cliff in Firefox between 500k rows (2.5 s) and 750k rows (151 s); 1M takes minutes, while Chromium sorts 1M in ≈3 s and a plain `Array.sort` of the same rows takes 0.7 s in Firefox | Resolved | TanStack's row methods take rest arguments (`function (...args)`), and its sorted row model calls `row.getValue()` four times per comparison: in Firefox that alone made a 750k sort 176 s instead of 0.9 s. Core now has its own sorted row model (`table/sorted-row-model.ts`, same order and sort functions) that reads each value once and sorts the row positions: 1M rows sort in ≈0.8 s in Firefox and ≈0.65 s in Chromium |

## Open questions

- [x] Final name and npm scope: decided, Argus Table (`argus-table` + `@argus-table/*`)
- [x] Shadow DOM + slotted cells vs. full light DOM inside `@layer`: decided, shadow DOM with slotted light-DOM cells on pooled row DOM ([ADR 0001](../../adr/0001-shadow-vs-light-dom.md))
- [x] Framework wrappers at launch: decided, React, Vue and Angular wrappers all ship with v0.2
- [x] Row selection in v1 or v2? v1: `selectionMode` and `selection` (row ids), with the event `argus-row-select`. A built-in checkbox column follows.
- [ ] Expose TanStack's table instance as an escape hatch, or keep it private?
- [ ] Formula columns with server-side data: disable sorting/filtering, or pass the syntax tree to `getRows`? (see [Formula columns](09-formula-columns.md))
