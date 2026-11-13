# ADR 0005: Translatable built-in text through `labels`

- **Status:** Accepted (13 November 2026).
- **Builds on:** [ADR 0004](0004-api-1-0.md), which listed localizable strings as the first addition after 1.0.

## Context

The table, the column menu and the formula editor show English text in several forms: visible text ("Retry", "No rows", the menu items, the filter form, the editor), accessible names ("Select row", "Resize column", "Column menu") and live-region announcements ("42 rows", "Name moved to column 2 of 8"). Some announcements were built from English fragments ("column 2" / "columns 2 to 4", `pinned to the start`), and three hand-written English plurals got it wrong once ("first 1 rows"). There was no `locale` concept anywhere, and no `Intl` use.

## Decision

- **A `labels` object per instance.** The table gets a property `labels: Partial<TableLabels>`. `headerMenu()` and `formulas()` each take a `labels` option. Each is merged over that package's English defaults, so an app sets only what it needs. A key set to `undefined` or `null` keeps its default.
- **Strings, and functions for text with values.** A label without values is a string. A label with values is a function of one object (`rowCount: ({ count }) => …`, `columnMoved: ({ column, position, total }) => …`). The object form lets a value be added later without breaking anyone, and the function form lets a language pick its own word order and plural forms (`Intl.PluralRules`). Numbers are passed unformatted, so apps format them with `Intl.NumberFormat`. A whole sentence is one label: no fragments are joined.
- **Defaults live with their package.** The table's bundle doesn't carry the menu's text, and the formula editor's English text loads with the editor (`editor/labels.ts`), outside the plugin's size budget.
- **The filter operators are records keyed by core's op ids** (`textOperators.contains`, `numberOperators.ge`), merged one level deeper, so they can't drift from the filter types.

## Options not taken

- **A `locale` property with message catalogues shipped for some languages.** Catalogues add bytes, need maintenance for each language, and still leave the app's own column headers to translate. The app knows its language; an object of labels is what it can give directly.
- **A static default (`ArgusTable.defaultLabels`).** Less wiring for an app with many tables, but it is global mutable state that tests would have to reset, and more API under the compatibility policy. An app shares one object instead.
- **ICU message strings (`{count, plural, one {# row} other {# rows}}`).** One string per message, but the table would need a message parser, and functions already do everything ICU does.

## Not covered yet

- The formula engine's error messages (the cell tooltips, the editor's problem line) and the function descriptions in the editor. Their text is spread over the engine's modules; translating it needs message keys in the DOM-free engine.
- Function names, error codes (`#VALUE!`), `TRUE`/`FALSE`, `TEXT()`'s month names and the decimal point in formulas: formula syntax, as in spreadsheets with English function names.
- Locale formatting of cell values: a `Date` cell shows the browser locale's `toLocaleString()`, a number its `String()`. Columns format values with `cell`.

## Consequences

- Every new user-visible string goes through its package's labels, with a key in the labels interface and its English default. A label is public API: renaming or removing one is a breaking change.
- The Features/Labels story sets every key in German, with `satisfies` on the full interfaces, so a key added later fails its typecheck until it is translated there too.
