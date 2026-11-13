---
'argus-table': minor
---

`selectionMode` is reflected to the `selection-mode` attribute, like `density`, so page CSS and themes can style a table by its selection mode:

```css
argus-table[selection-mode='multi']::part(row) {
  cursor: pointer;
}
```

The attribute is on every table, with `none` as the default.
