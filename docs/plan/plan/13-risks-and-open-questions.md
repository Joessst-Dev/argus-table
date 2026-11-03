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

## Open questions

- [x] Final name and npm scope: decided, Argus Table (`argus-table` + `@argus-table/*`)
- [x] Shadow DOM + slotted cells vs. full light DOM inside `@layer`: decided, shadow DOM with slotted light-DOM cells on pooled row DOM ([ADR 0001](../../adr/0001-shadow-vs-light-dom.md))
- [x] Framework wrappers at launch: decided, React, Vue and Angular wrappers all ship with v0.2
- [ ] Row selection in v1 or v2?
- [ ] Expose TanStack's table instance as an escape hatch, or keep it private?
- [ ] Formula columns with server-side data: disable sorting/filtering, or pass the syntax tree to `getRows`? (see [Formula columns](09-formula-columns.md))
