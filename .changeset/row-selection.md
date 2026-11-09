---
'argus-table': minor
---

Row selection. Set `selectionMode` (or the `selection-mode` attribute) to `'single'` or `'multi'`, and the selected rows' ids are in `selection`:

```html
<argus-table selection-mode="multi"></argus-table>
<script type="module">
  const table = document.querySelector('argus-table');
  table.getRowId = (order) => order.id;
  table.addEventListener('argus-row-select', (e) => console.log(e.detail.selection)); // ['o2', 'o7']
</script>
```

- A click selects a row. In `'multi'` mode, Ctrl+click (Cmd+click on macOS) adds or removes a row, Shift+click selects the range from the last row clicked, and Ctrl+Shift+click adds that range.
- From the keyboard, Space toggles the focused row. In `'multi'` mode, Shift+ArrowUp/ArrowDown and Shift+PageUp/PageDown extend the selection, and Ctrl+A (Cmd+A) selects every row.
- `selection` is uncontrolled until you set it, like `sorting`. Once set, a change only fires `argus-row-select` with the proposed ids, and the table waits for you to set them. `ROW_SELECT` and `RowSelectDetail` are exported.
- Clicks on buttons, links and inputs inside cells don't select. Pinned rows can't be selected, and neither can `dataSource` rows still loading. With a `dataSource`, Ctrl+A selects the rows loaded so far.
- Ids stay selected through sorting and new data, and show again when their rows come back.
- Selected rows get the part `row-selected` and `aria-selected="true"`. `--argus-row-selected-bg` paints them (pinned columns too), which the default and Material-inspired themes already set. Without it, they use the system highlight colour.
