# Infinite loading

[← Back to contents](../README.md)

The DataController asks `getRows()` only for pages that are in view and not cached, and cancels anything that scrolled away.

**Pages load only for rows in view; stale requests are cancelled.**

```mermaid
flowchart TD
    range["Range changes<br/>new visible rows after scroll or resize"] --> missing{"Rows missing?"}
    missing -- no --> render["Render<br/>cached rows; skeletons where rows are missing"]
    missing -- yes --> debounce["Debounce<br/>wait until fast scrolling settles"]
    debounce --> abort["Abort stale<br/>cancel requests outside the range"]
    abort --> get["getRows()<br/>start, end, sort, filter, signal"]
    get --> ok{"Request succeeded?"}
    ok -- yes --> store["Store page<br/>row cache, update total if known"]
    store --> render
    ok -- no --> error["Show the error<br/>argus-load-error, Retry in the skeleton"]

    classDef main stroke-width:2px
    class render main
    classDef err stroke-dasharray:4 3
    class error err
```

A change of sort or filter clears the cache and scrolls back to the top before this flow runs again. Pages far outside the view are evicted from the cache, so memory stays bounded at 1M rows.
