# @argus-table/themes

Themes for [argus-table](https://www.npmjs.com/package/argus-table). Each theme is one CSS file that sets the table's `--argus-*` tokens and `::part()` rules, and nothing else.

```bash
npm i argus-table @argus-table/themes
```

```js
import 'argus-table';
import '@argus-table/themes/default.css';
```

Or with a `<link>`: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@argus-table/themes/dist/default.css">`.

## Default

Neutral. It uses the page's font, follows the system's light or dark setting, and has one accent colour for focus, the sorted column's header and the resize handle.

- **Force a scheme:** put `data-argus-theme="dark"` or `data-argus-theme="light"` on the table or on any ancestor, such as `<html>`. The attribute on the table wins over one on an ancestor.
- **Change a value:** set the token after the theme, for example `argus-table { --argus-focus-ring: 2px solid teal; }`.
- **Density:** the theme keeps the table's row heights and padding per `density`. Override one density with `argus-table[density='compact'] { --argus-row-height: 28px; }`.

The full list of tokens and parts is in the argus-table docs.

MIT licensed.
