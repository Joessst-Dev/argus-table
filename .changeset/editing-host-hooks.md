---
'argus-table': minor
---

Plugins can now support cell editing (ADR 0009), ahead of the `@argus-table/editing` add-on:

- `PluginHost.focusCell(index, columnId, section?)` makes a body or pinned-row cell the active one and focuses it after the next update, like `focusHeader()`.
- A plugin's optional `editable(columnId, host)` hook says whether it makes a column's cells editable.

The grid now tells assistive technology that it is read-only (`aria-readonly`) while no plugin makes anything editable; screen readers could announce its cells as editable before. With an editing plugin, the cells of columns it doesn't edit are marked read-only instead.
