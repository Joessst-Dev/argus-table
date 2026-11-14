# ADR 0007: Header text through the header's context, and `ColumnDef.meta`

- **Status:** Accepted (14 November 2026).
- **Builds on:** [ADR 0004](0004-api-1-0.md), which listed both as additions after 1.0: "a `HeaderContext` argument for `header()`, so plugins can label any header" and "`ColumnDef.meta` for plugins' own fields".

## Context

A column's `header` is content: a string, a Lit template, a node, or JSX and VNodes in the wrappers. Some places need the column's name as plain text, and they all fell back to the column id when the header wasn't a string:

- the column menu's "Hidden columns" items and its announcements (`@argus-table/header-menu`);
- an export's header row (`@argus-table/export`), which also made the export go first in `plugins`, before other plugins turned headers into functions returning templates;
- the names formulas use for columns (`@argus-table/formulas`);
- the table's own announcement of a keyboard move, which read the slotted header's DOM text instead.

In Vue and Angular a `#header-<id>` slot or `argusHeader` template replaces the column's header with a function, so even a column with `header: 'Total'` lost its name to these plugins.

Plugins also had nowhere to keep their own settings on a column: `tableExport()` takes a `columns` record keyed by id, apart from the definitions, and `formula` is a field of the table's own `ColumnDef` that only the formulas plugin reads.

## Decision

- **Header functions get a context.** A column's `header` function receives `HeaderContext { columnId, text }`, a group's `GroupHeaderContext { groupId, text }`. The table renders headers with `text: false`. With `text: true` the table or a plugin asks for the name as plain text, and the function returns a string (or a number). Whatever else it returns means "no text": the column is named by its id, as before.
  - One function per header keeps the content and its name together, and it works for every framework: a JSX header returns a string in text mode.
  - Existing headers keep working: a function that ignores the context returns its content, which counts as no text. A string header is its own text.
- **`PluginHost.headerText(def)`** reads a column's or group's name (`undefined` without one), next to `host.header(def)`. It isn't a `ColumnInfo` field: `#columnInfo` runs on every render, and the field would call user functions each time.
- **Plugins that wrap headers forward text mode.** header-menu, formulas and the Vue and Angular content plugins return `host.headerText(def)` of the header they wrap when asked for text. A slot or template header therefore names its column by the definition's `header`, and `tableExport()` no longer has to come first.
- **The consumers use it.** header-menu names items and announcements by it; export reads names when it exports, through the host; the table's move announcements use it before the slotted DOM text; formulas name columns by it.
- **Formulas resolve the new names last**: id, string header, id in any case, then text mode. Every formula that resolved before resolves to the same column. A column's suggested name is its text only where that text leads back to it.
- **`ColumnDef.meta?: ColumnMeta<TData>`**, an interface with an index signature (`[key: string]: unknown`). The table never reads it; plugins get it as `ColumnInfo.meta`. A plugin types its own key by augmenting `ColumnMeta` (`declare module 'argus-table'`); `TData` lets a field take the row type. `<argus-column>` takes it as a property.
- **`@argus-table/export` reads `meta.export`** (`ExportColumnOptions<TData>`: `header`, `value`, `exclude`), typed by its augmentation. The per-id `columns` option wins field by field.

## Options not taken

- **A separate `label` field** on columns and groups, used as `label ?? string header ?? id`. Simpler to type, but every column with a non-text header would carry its name twice, and a function header already has the information.
- **Reading the rendered header's text from the DOM**, as the move announcement did. Column virtualization renders only the headers in view, and the text of a template isn't always a good name (icons, units, badges).
- **`meta` as a plain `Record<string, unknown>`.** Plugins would narrow every value by hand, and apps would get no checking of `meta.export`.
- **Moving `formula` into `meta`**: `<argus-column formula>` is an attribute the element reads, and the field is part of the frozen 1.0 API.

## Consequences

- Code that calls a definition's `header()` itself must now pass a context. Plugins are told to use `host.header()` and `host.headerText()`, and no add-on calls it directly.
- A header function that only renders should still check `text` if the app wants its name in menus, exports and announcements.
- In an app with only a framework wrapper installed, the wrapper's module is the one to augment (`declare module '@argus-table/react'`): under pnpm, `argus-table` isn't resolvable from the app.
- The CDN build grows by the context objects, `headerText` and `meta` passed through.
