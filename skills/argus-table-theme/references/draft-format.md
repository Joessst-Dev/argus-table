# Theme draft format

A draft is what the theme creator stores: a **base** (a shipped theme), the **seeds** you changed, the **part options** you changed and per-token **overrides**. The creator works out everything else. `scripts/theme-link.mjs` checks a draft and turns it into a link.

```json
{
  "name": "Acme",
  "preset": "fluent",
  "seeds": {
    "accent": { "light": "#e4572e", "dark": "#ff8a65" },
    "surface": { "light": "#fffdf9", "dark": "#1b1714" },
    "text": { "light": "#2b211c", "dark": "#f3ebe6" },
    "header": { "style": "accent", "strength": 40, "muted": false },
    "lines": { "radius": 8 },
    "type": { "family": "Inter, system-ui, sans-serif" }
  },
  "parts": { "uppercase": true, "sortedAccent": true },
  "overrides": {}
}
```

## Top-level keys

| Key            | Required | Meaning                                                                                                                                                                                          |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`         | no       | The theme's name. The downloaded file is named after it in lower case, with each run of other characters as `-`: `Acme Bank` → `acme-bank.css`, `Node.js` → `node-js.css`. Default `"My theme"`. |
| `preset`       | no       | The base: one of the presets below. Default `"default"`.                                                                                                                                         |
| `seeds`        | no       | Only the seeds you set. A seed you leave out keeps the base theme's look.                                                                                                                        |
| `parts`        | no       | Only the part options you set.                                                                                                                                                                   |
| `overrides`    | no       | Exact token values that win over the base and the seeds. Use them only for what the seeds can't say. Names are in [tokens.md](tokens.md).                                                        |
| `removedParts` | no       | `::part()` rules of the base to drop, by their selector list (`"header-cell, header-group-cell"`). Rarely needed.                                                                                |
| `v`            | no       | Always `1`.                                                                                                                                                                                      |

## Presets

Pick the base whose structure is closest to the look you want. The seeds then recolour it, and any rule the seeds don't touch stays the base's. The base's accent-coloured part rules (the sorted header, the checkboxes) follow your `accent`.

| `preset`    | Character                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `default`   | Neutral. Uses the page's font, a slightly tinted header, thin row lines, 40px rows.                                                  |
| `material`  | Material 3 feel. Roboto, tall 52px rows, a rounded (12px) outlined surface, a tinted header, deeper shadows.                         |
| `fluent`    | Fluent 2 feel. Segoe UI, a flat header on the body colour, 44px rows, neutral greys, one brand blue.                                 |
| `bootstrap` | Bootstrap 5 striped, hoverable table. System font stack, stripes, a divider under the header, 40px rows.                             |
| `minimal`   | Quiet and airy. One surface, no column lines, faint row lines, small uppercase labels, roomy 56px rows. Instrument Sans.             |
| `blank`     | Nothing but the seeds: every seed you leave out gets the creator's defaults (below). For a theme built entirely from your own seeds. |

Their colours, light / dark. A seed you leave out, or the side of a colour you leave out, keeps these:

| `preset`    | `surface`             | `text`                | `accent`              |
| ----------- | --------------------- | --------------------- | --------------------- |
| `default`   | `Canvas` (system)     | `CanvasText` (system) | `#2f5bd3` / `#8aa6f2` |
| `material`  | `#fef7ff` / `#141218` | `#1d1b20` / `#e6e0e9` | `#6750a4` / `#d0bcff` |
| `fluent`    | `#ffffff` / `#292929` | `#242424` / `#ffffff` | `#0f6cbd` / `#479ef5` |
| `bootstrap` | `#ffffff` / `#212529` | `#212529` / `#dee2e6` | `#0d6efd` / `#6ea8fe` |
| `minimal`   | `#ffffff` / `#0f1012` | `#17181b` / `#ecedef` | `#b45309` / `#f0b35b` |

## Seeds

A seed you set is a whole group (`header`, `lines`, …). Any field you leave out of it keeps the base theme's value, so `"lines": { "radius": 8 }` changes the radius only.

A colour is a plain CSS colour: hex (`#e4572e`), `rgb()`, `hsl()`, `oklch()` or a named colour. No `var()`, `light-dark()` or system colours. Each colour seed is a pair `{ "light": …, "dark": … }`, for the light and the dark scheme. You may leave out one side:

- `accent` without `dark`: the light accent, lifted until it reads on the dark surface.
- `text` without `dark`: a text colour for the dark surface. Set `text` whenever you change the surface, because the base's text was picked for the base's surface.
- `surface` without `dark`: the base theme's dark surface.
- Any colour without `light`: the base theme's light colour (see the table above).

| Seed.field                      | Type                                            | What it drives                                                                                                                                                                                                                                                                             |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `accent.light`, `accent.dark`   | colour                                          | The focus ring (`2px solid`), the resize handle, the drop and filter indicators, and selected rows (the accent mixed 14% / 28% into the surface). Also the formula editor's button, function names and column references. The `sortedAccent` and `checkboxAccent` part options use it too. |
| `surface.light`, `surface.dark` | colour                                          | `--argus-bg`. Every mixed colour starts from it: lines, stripes, hover, skeletons, menus.                                                                                                                                                                                                  |
| `text.light`, `text.dark`       | colour                                          | `--argus-fg`. It's also what lines, stripes and hover mix in.                                                                                                                                                                                                                              |
| `header.style`                  | `"body"`, `"tinted"` or `"accent"`              | The header background. `body`: the same as the rows. `tinted`: the surface, a step towards the text colour. `accent`: the surface, a step towards the accent.                                                                                                                              |
| `header.strength`               | 0–100                                           | How far `tinted` or `accent` goes. 100 is 12% of the text colour, or 20% of the accent.                                                                                                                                                                                                    |
| `header.muted`                  | boolean                                         | Header text a step towards the background: softer column labels.                                                                                                                                                                                                                           |
| `lines.strength`                | 0–100                                           | Contrast of the row borders: 0 is faint, 100 is clearly visible.                                                                                                                                                                                                                           |
| `lines.width`                   | 0–8 (px)                                        | Width of the row borders.                                                                                                                                                                                                                                                                  |
| `lines.outline`                 | boolean                                         | A border around the whole table. Without one, the radius shows only where the table's colours differ from the page's.                                                                                                                                                                      |
| `lines.radius`                  | 0–32 (px)                                       | Corner radius of the table.                                                                                                                                                                                                                                                                |
| `rows.stripes`                  | boolean                                         | Striped odd rows.                                                                                                                                                                                                                                                                          |
| `rows.hover`                    | boolean                                         | A hover background on rows.                                                                                                                                                                                                                                                                |
| `rows.height`                   | `{ compact, comfortable, spacious }`, 20–120 px | Row height per density. The app picks the density with the table's `density` attribute; `comfortable` is the default. You may give only some densities.                                                                                                                                    |
| `rows.padding`                  | `{ compact, comfortable, spacious }`, 0–48 px   | Inline cell padding per density.                                                                                                                                                                                                                                                           |
| `type.family`                   | string                                          | A font stack (`"Inter, system-ui, sans-serif"`). `""` uses the page's font. The theme loads no fonts: the page must load them.                                                                                                                                                             |
| `type.size`                     | string                                          | A CSS font size (`"0.875rem"`, `"14px"`). `""` keeps the page's size.                                                                                                                                                                                                                      |
| `type.weight`                   | string                                          | A font weight (`"400"`). `""` means 400.                                                                                                                                                                                                                                                   |
| `type.mono`                     | string                                          | A monospace stack for formulas and menu details. `""` keeps the default.                                                                                                                                                                                                                   |
| `depth.pinned`                  | 0–100                                           | The shadow on pinned columns. 0 is none.                                                                                                                                                                                                                                                   |
| `depth.popover`                 | 0–100                                           | The shadow under the column menu and the formula editor. 0 is none.                                                                                                                                                                                                                        |

The defaults for a `blank` base: accent `#2f5bd3` / `#8aa6f2`, surface `#ffffff` / `#14171c`, text `#1f2329` / `#e6e8eb`, a `tinted` header at 30, lines at 25 (1px, no outline, no radius), hover on and no stripes, rows 32 / 40 / 52 px with padding 8 / 12 / 16 px, the page's font, pinned depth 35 and popover depth 50.

## Part options

| Option            | Type    | Effect                                                  |
| ----------------- | ------- | ------------------------------------------------------- |
| `headerSize`      | string  | The header label size (`"0.75rem"`). `""` removes it.   |
| `headerWeight`    | string  | The header label weight (`"600"`). `""` removes it.     |
| `uppercase`       | boolean | Small uppercase header labels with letter spacing.      |
| `sortedAccent`    | boolean | The sorted column's header in the accent colour.        |
| `tabularNums`     | boolean | Numbers line up (`font-variant-numeric: tabular-nums`). |
| `pinnedBold`      | boolean | Pinned rows (totals) in bold.                           |
| `pinnedSeparator` | boolean | A line between pinned rows and the body.                |
| `checkboxAccent`  | boolean | Selection checkboxes in the accent colour.              |
| `skeletonRadius`  | boolean | Rounded skeleton bars in rows still loading.            |

## Overrides

`"--argus-header-bg": "#0b3d91"` sets one value for both schemes. `"--argus-header-bg": { "light": "#0b3d91", "dark": "#173a73" }` sets one per scheme. Values are CSS as written, so `var(--argus-bg)` works. Overrides win over the seeds, so a seed the user changes later in the creator doesn't move an overridden token. Keep them few.

## How the creator resolves a draft

1. Start from the base theme's tokens and `::part()` rules.
2. Write the tokens of the seeds that differ from the base's own seeds.
3. Apply the overrides.
4. Apply the part options to the rules.

It then checks contrast (body text, header text, the focus ring, the sorted header, selected rows, …) in both schemes and offers fixes.
