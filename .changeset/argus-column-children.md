---
'argus-table': minor
---

Declarative columns: write columns as `<argus-column>` children instead of setting the `columns` property.

```html
<argus-table>
  <argus-column column-id="id" header="Order" accessor="id" width="90" pin="start"></argus-column>
  <argus-column
    column-id="customer"
    header="Customer"
    accessor="customer.name"
    width="1fr"
    sortable
  ></argus-column>
  <argus-column column-id="actions" header="Actions" width="100" resizable="false">
    <template><button>Open</button></template>
  </argus-column>
</argus-table>
```

- Attributes cover the plain fields: `column-id`, `header`, `accessor`, `width` (`90`, `auto` or `2fr`), `min-width`, `max-width`, `pin`, `align`, `sortable`, `resizable` and `reorderable` (`resizable="false"` turns resizing off). Functions and rich content go in properties: `accessor`, `header` and `cell`.
- A `<template>` child is static content for every cell of the column. Use the `cell` property for content that depends on the row.
- The table follows its children: add, remove or move a column, or change an attribute, and the columns update, keeping widths, order and sorting. Loops in Vue, Angular or React just work.
- A non-empty `columns` property wins over the children.
