---
'argus-table': minor
---

Columns can wrap their text: `wrap: true` on a column, or `wrap` on `<argus-column>`, wraps cell text onto more lines instead of cutting it off.

```js
{ id: 'note', header: 'Note', accessor: 'note', wrap: true }
```

- Rows keep their height. Text that fits stays centred; longer text starts at the top and is clipped, so give wrapped columns room with `rowHeight` or `--argus-row-height`.
- Headers don't wrap.
- A `width: 'auto'` column fits its text unwrapped, up to `maxWidth`.
