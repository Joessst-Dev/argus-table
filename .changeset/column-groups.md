---
'argus-table': minor
---

Column groups: headers over several columns, nested to any depth. Set `columnGroups`, or wrap `<argus-column>`s in `<argus-column-group>`:

```js
table.columnGroups = [
  {
    id: 'customer',
    header: 'Customer',
    columns: ['name', { id: 'address', header: 'Address', columns: ['city', 'country'] }],
  },
  { id: 'order', header: 'Order', columns: ['status', 'total'] },
];
```

```html
<argus-column-group group-id="customer" header="Customer">
  <argus-column column-id="name" header="Name"></argus-column>
  <argus-column column-id="city" header="City"></argus-column>
</argus-column-group>
```

- Each level of nesting adds a header row above the column headers. `columns` stays a flat list, and so do `columnOrder`, the other state properties and what plugins see.
- A group's columns stay next to each other: on its first column's place, even when `columnOrder` lists them apart. Columns move only within their group, and a group moves as a whole: drag its header, or press Alt+Shift+Arrow on it. `argus-column-reorder` then has a `groupId`.
- A group whose columns are pinned to different sides shows on each side, sticky with its columns. A wide group's label stays in view while its columns scroll past, `virtualizeColumns` included.
- Group headers are column headers (`aria-colspan` over their columns) in the keyboard navigation: ArrowUp from a column header goes to its group, ArrowDown back. Columns without a group at a level sit under an empty filler cell. Groups don't sort or resize.
- New parts: `header-group-row`, `header-group-cell`, `header-group-cell-dragging` and `header-group-filler`. Group headers take `--argus-header-bg` and `--argus-header-fg`, and each header row is `--argus-row-height` tall.
- The CDN bundle grows by about 3.3 kB (min+gzip), to 58.2 kB; its size budget goes from 55 to 59 kB.
