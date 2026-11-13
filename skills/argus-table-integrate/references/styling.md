# Styling

## Themes

`@argus-table/themes` has five: `default`, `material`, `fluent`, `bootstrap`, `minimal`. Each is one CSS file that styles every `argus-table` on the page through `--argus-*` tokens and `::part()` rules. Import one, once, where the app's global CSS goes, before the app's own CSS (so the app's token overrides win):

| App                      | Where                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Vite (React, Vue, plain) | `import '@argus-table/themes/default.css';` in `src/main.*`                                        |
| Next.js App Router       | the same import in `app/layout.tsx`                                                                |
| Next.js Pages Router     | `pages/_app.tsx`                                                                                   |
| Remix / React Router     | `app/root.tsx`                                                                                     |
| Nuxt                     | `css: ['@argus-table/themes/default.css']` in `nuxt.config`                                        |
| Angular                  | `@import '@argus-table/themes/default.css';` in `src/styles.css`                                   |
| No bundler               | `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@argus-table/themes/dist/default.css">` |

- Themes follow the system's light or dark scheme. Force one with `data-argus-theme="light"` or `"dark"` on the table or an ancestor (`<html>`). If the app has its own dark-mode switch (a `.dark` class), set `data-argus-theme` from the same state.
- Themes load no fonts: `material` expects Roboto, `minimal` Instrument Sans; otherwise the font falls back. To use the app's font: `argus-table { --argus-font: inherit; }`.
- To match a brand, a design system or a website, use the `argus-table-theme` skill: it makes a theme in the theme creator from colours, fonts or a URL.

## Picking a theme when migrating

| Old look                                                  | Theme                                                 |
| --------------------------------------------------------- | ----------------------------------------------------- |
| AG Grid Quartz / Alpine                                   | `default` or `fluent`                                 |
| AG Grid Balham, dense enterprise UIs                      | `fluent` with `density="compact"`                     |
| MUI, Vuetify, Angular Material                            | `material`                                            |
| Bootstrap tables, PrimeNG/PrimeVue, Element Plus `stripe` | `bootstrap`                                           |
| Tailwind/shadcn, Ant Design                               | `minimal` or `default`, then the app's tokens (below) |
| A plain `<table>` styled by the app                       | `default` or `minimal`, then the app's tokens         |

Themes set their own font (`--argus-font`). A table that used the page's font should keep it: `argus-table { --argus-font: inherit; }`.

## Density

`density="compact" | "comfortable" | "spacious"` (default `comfortable`): MUI `compact`/`standard`/`comfortable` → `compact`/`comfortable`/`spacious`; Vuetify `compact`/`default`/`comfortable` the same way; AG Grid `rowHeight` 28–32 → `compact`. The heights differ between libraries (MUI `compact` is 36px, a theme's `compact` may be 40px): for an exact match set `rowHeight={36}` (or the `--argus-row-height` token in CSS).

## Height

The table virtualizes, so it has its own height: 400px by default. Common layouts:

```css
/* A fixed height */
argus-table {
  block-size: 600px;
}

/* Fill a flex column (the parent must have a height) */
.page {
  display: flex;
  flex-direction: column;
  block-size: 100vh;
}
.page argus-table {
  flex: 1;
  min-block-size: 0;
}
```

Don't size it to its rows: that renders every row and loses virtualization. For short lists (a few rows) give it a matching fixed height.

## Tokens and parts

Override tokens on `argus-table`, after the theme:

```css
argus-table {
  --argus-header-bg: var(--app-surface-2);
  --argus-border-color: var(--app-border);
  --argus-row-selected-bg: color-mix(in oklab, var(--app-primary) 15%, transparent);
  --argus-font: inherit;
}
argus-table::part(header-cell) {
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
argus-table::part(row-odd) {
  background: var(--app-surface-1);
}
```

States are part names: `row-selected`, `row-odd`, `header-cell-sorted`, `cell-pinned`, `cell-pinned-edge`, `header-cell-filtered`. `::part()` can't take attribute or class selectors.

## Cell content

Cell and header content is in the page's light DOM: style it with the app's own CSS classes, Tailwind classes, CSS modules or the framework's scoped styles (Angular component styles apply to `argusCell` templates, which are part of the component's template; in Vue, check that `scoped` styles reach slot content, else use `:deep()` or a global class). Old grid CSS that targeted the grid's internals (`.ag-cell`, `.MuiDataGrid-cell`, `td.mat-cell`) has no effect: move what you need to tokens, parts or the content's own classes.

The themes follow the light or dark scheme; the app's own CSS in cells (a badge with a fixed light background) doesn't. Give it both schemes (`light-dark()`, or the app's dark-mode class).
