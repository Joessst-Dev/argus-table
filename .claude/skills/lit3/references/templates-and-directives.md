# Templates and directives

Directives live in `lit/directives/*.js`; import each one separately so unused ones are tree-shaken (the core bundle budget is under 30 KB min+gzip).

## Directive cheat sheet

| Directive | Import | Use in argus-table |
|---|---|---|
| `repeat(items, keyFn, template)` | `lit/directives/repeat.js` | Every virtualized list: rows by row id, cells by column id. Moves DOM with the item instead of reusing by position. |
| `classMap({...})` | `lit/directives/class-map.js` | Internal-only classes. Prefer parts for anything users might style. |
| `styleMap({...})` | `lit/directives/style-map.js` | Per-row `transform`, per-cell `inset-inline-start`, grid template, custom properties (`'--_col-width': '120px'`). Only touches changed keys. |
| `ifDefined(v)` | `lit/directives/if-defined.js` | Attribute that should disappear when `undefined`. `nothing` does the same for any falsy branch you choose. |
| `live(v)` | `lit/directives/live.js` | Rare: when the DOM value can change behind Lit's back (an input the user typed into). |
| `ref(cb or createRef())` | `lit/directives/ref.js` | Grabbing an element inside `repeat` (measuring a row). Prefer `@query` for single static elements. |
| `guard([deps], () => tpl)` | `lit/directives/guard.js` | Skip re-rendering an expensive subtree (the header) unless its deps change. Use only after measuring a real cost. |
| `keyed(key, tpl)` | `lit/directives/keyed.js` | Force a full re-create of a subtree when the key changes (e.g. switching data source resets skeletons). |
| `cache(tpl)` | `lit/directives/cache.js` | Switching between two big templates repeatedly (empty state vs body). |
| `until(promise, placeholder)` | `lit/directives/until.js` | Avoid for row data: the DataController owns loading and skeletons. |
| `unsafeHTML` | `lit/directives/unsafe-html.js` | Don't. Cell renderers return templates; string HTML from data is an XSS hole. |

## Rendering conditionally

```ts
${this.loading ? renderSkeleton(range) : nothing}
${rows.length === 0 && !this.loading ? html`<div part="empty"><slot name="empty">No rows</slot></div>` : nothing}
```

Return `nothing` (not `''`, `null` or `undefined` for attributes) when you want an attribute removed; in child position all of them render nothing, but `nothing` reads clearest.

## Performance notes for a 100k-row table

- **Only the window renders.** The template maps `virtualizer.getVirtualItems()` (plus pinned rows, always rendered) through `repeat`. Overscan defaults to 6 rows.
- **Static parts of templates are free**; Lit only updates bindings. Keep the number of bindings per cell small: a cell with 3 bindings × 50 columns × 40 visible rows is 6 000 binding checks per frame.
- **Positioning:** one `transform: translateY()` per row via `styleMap`; one spacer sets the total height. Never set `top` per row (layout cost).
- **Grid template once:** compute `grid-template-columns` in `willUpdate` from column sizes and set it as one custom property on the scroll container, so header, body and footer share it.
- **Scroll handling:** the virtualizer listens to scroll with passive listeners. Don't add your own scroll listener that sets reactive state on every event; if needed, batch with `requestAnimationFrame`.
- **Resizing:** apply widths during drag via `requestAnimationFrame` batching (TanStack `columnResizeMode: 'onChange'`), commit and fire `argus-column-resize` on pointer up.
- **hasChanged:** for properties set to equal-but-new objects often (e.g. `sorting` from a framework), consider a custom `hasChanged` that compares structurally, to skip needless updates. Don't do it for `data` (arrays can be huge).
- **Dev mode:** Lit's development build (Vite's dev server picks the `development` export condition) warns about `change-in-update`, missing `super` calls and class-field shadowing. Read those warnings; production builds strip them.
