# Architecture (packages)

[← Back to contents](../README.md)

Six packages in one monorepo (five published); users only ever touch `argus-table`, an optional wrapper and a theme file.

**Only argus-table and its add-ons are public; TanStack stays internal.**

```mermaid
flowchart TD
    app["Your site or app<br/>Plain HTML, React, Vue or Angular<br/>Page CSS also styles the slotted cell content"]
    wrappers["@argus-table/react, /vue, /angular<br/>Typed props, events and two-way binding<br/>Optional; plain HTML needs no wrapper"]
    themes["@argus-table/themes<br/>One CSS file per theme<br/>Sets tokens and ::part() rules only"]
    table["argus-table: the argus-table element (Lit)<br/>Renders the div grid: sticky header, pinned rows and columns, skeleton rows<br/>Public API: properties, events, CSS tokens, parts, slotted cell content"]
    core["@argus-table/core (internal)<br/>Column model, dataSource paging, width measuring<br/>Wraps TanStack so its types never leak into the public API"]
    tst["TanStack Table (dependency)<br/>Sorting, filtering, pinning, sizing<br/>Row models and table state"]
    tsv["TanStack Virtual (dependency)<br/>Which rows and columns are visible<br/>Scroll offsets and measurements"]

    app --> wrappers
    app --> table
    app --> themes
    wrappers --> table
    themes --> table
    table --> core
    core --> tst
    core --> tsv

    classDef main stroke-width:2px
    class table main
```

Arrows point from a package to what it uses. Plain-HTML users import `argus-table` directly. Storybook reads the Custom Elements Manifest generated from `argus-table`.

What happens inside the element (controllers, render cycle, loading, formulas): see [Code architecture](../code-architecture/01-module-map.md).
