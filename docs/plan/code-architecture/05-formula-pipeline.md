# Formula pipeline

[← Back to contents](../README.md)

A formula goes through parsing, checks and compilation once when it is saved; only the compiled closure runs per row. Feature description: [Formula columns](../plan/09-formula-columns.md).

**Formulas are checked and compiled once, then run per row.**

```mermaid
flowchart TD
    text["Formula text<br/>ROUND([Total] * 1.19, 2)"] --> parse["Tokenize + parse<br/>Pratt parser builds a syntax tree"]
    parse --> validate["Validate<br/>known functions, columns, types"]
    validate --> valid{"Valid?"}
    valid -- no --> error["Error in the editor<br/>message points to the bad part"]
    valid -- yes --> deps["Dependency order<br/>sort formula columns by what they use"]
    deps --> cycle{"Cycle?"}
    cycle -- yes --> error
    cycle -- no --> compile["Compile once<br/>syntax tree to a closure, no eval"]
    compile --> register["Register column<br/>ColumnDef with an accessorFn"]
    register --> evaluate["Evaluate per row<br/>visible rows first, cached by row id"]
    evaluate --> values["Cell values<br/>number, text, date or an error value"]

    classDef main stroke-width:2px
    class values main
    classDef err stroke-dasharray:4 3
    class error err
```

Error values shown in cells: `#DIV/0!`, `#VALUE!`, `#REF!`, `#CYCLE!`.

Changing one formula re-runs the pipeline for that column and the columns that depend on it. Changing data only clears the value cache; nothing is re-parsed.

Whole columns (`[[name]]`) read a *universe*: the rows the table's filters keep, leaving out the filters on the columns using whole columns. Columns using them are compiled again for each universe (a new `data`, other filters, the quick filter), so their accessors change and the table re-reads them; the others keep theirs.

```mermaid
flowchart LR
    change["data, filters, quick filter"] --> hook["plugin willUpdate<br/>compares the universe key"]
    hook --> source["new row source<br/>invalidateColumns()"]
    source --> recompile["compile the range-dependent columns<br/>new accessors"]
    recompile --> lazy["first use of a range<br/>host.filteredIndexes(dependent)"]
    lazy --> range["ColumnRange per column<br/>memo of SUM([[x]]), indexes for COUNTIF / XLOOKUP"]
```
