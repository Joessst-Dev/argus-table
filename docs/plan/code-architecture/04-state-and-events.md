# State and events

[← Back to contents](../README.md)

Every piece of table state works like a form input: uncontrolled by default, controlled when the host sets the property.

| State | Property | Change event |
| --- | --- | --- |
| Sorting | `sorting` | `argus-sort-change` |
| Column widths | `columnSizing` | `argus-column-resize` |
| Pinned columns | `columnPinning` | `argus-column-pin` |
| Column order | `columnOrder` | `argus-column-reorder` |
| Hidden columns | `columnVisibility` | `argus-column-visibility` |
| Formula columns | `formulaColumns` | `argus-formula-column-add` / `-change` / `-remove` |

- **Uncontrolled** (property never set): the table keeps the state, updates it, then fires the event.
- **Controlled** (property set by the host): the table fires the event with the proposed new state but changes nothing until the host sets the property again. One helper in `core/state` implements this for every row of the table above.
- All events are `CustomEvent` with `bubbles: true` and `composed: true`; `detail` carries the new (or, when controlled, the proposed) state, plus what changed where it isn't obvious from the state alone, for example `columnId` on `argus-column-resize`. The events table in the [public API](../plan/07-public-api.md#events) is the reference for each event's `detail`. Events fire after the update, never during `render()`.
- `getState()` / `setState()` read and write all of the above as one object, for saving a user's layout.
