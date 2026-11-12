# Module map

[← Back to contents](../README.md)

Everything inside `<argus-table>` is a set of Lit reactive controllers around TanStack; the element itself only wires them together and renders. Framework-free logic lives in `@argus-table/core` so it can be unit-tested without a browser.

Five reactive controllers each own one concern; the renderer only reads from them.

**Controllers do the work; the element wires them together and renders.**

```mermaid
flowchart TD
    children["argus-column children<br/>declarative column defs"]
    props["Properties<br/>columns, data, dataSource, …"]
    user["User input<br/>scroll, clicks, keys, drags"]

    subgraph element["Inside the argus-table element"]
        col["ColumnController<br/>builds ColumnDef[]"]
        data["DataController<br/>array or pages, row cache"]
        inter["InteractionController<br/>focus, keys, sort, resize"]
        table["TableController (TanStack Table)<br/>row models, sorting, pinning, sizing"]
        virt["VirtualController<br/>TanStack Virtual: ranges + row pool"]
        render["Renderer (Lit templates)<br/>header, pinned rows, visible window, footer, parts"]
    end

    dom["DOM<br/>shadow DOM + slotted cell content"]
    events["Events<br/>argus-sorting-change, …"]

    children --> col
    props --> col
    props --> data
    user --> inter
    user -- scroll --> virt
    col --> table
    data --> table
    inter --> table
    table -- row count --> virt
    table --> render
    virt -- visible range --> render
    inter -. active cell .-> render
    render --> dom
    render --> events

    classDef main stroke-width:2px
    class render main
```

The InteractionController also tells the renderer which cell has focus. Each controller fires its own `argus-*` events, so the element class stays small.
