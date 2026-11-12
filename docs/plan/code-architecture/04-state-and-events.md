# State and events

[← Back to contents](../README.md)

Every piece of table state works like a form input: uncontrolled by default, controlled when the host sets the property.

| State           | Property                                                                              | Change event                                                                      |
| --------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Sorting         | `sorting`                                                                             | `argus-sorting-change`                                                               |
| Column widths   | `columnSizing`                                                                        | `argus-column-sizing-change`                                                             |
| Pinned columns  | `columnPinning`                                                                       | `argus-column-pinning-change`                                                                |
| Column order    | `columnOrder`                                                                         | `argus-column-order-change`                                                            |
| Selected rows   | `selection`                                                                           | `argus-selection-change`                                                                |
| Hidden columns  | `columnVisibility`                                                                    | `argus-column-visibility-change` (also when a column is shown)                                 |
| Column filters  | `columnFilters` (`quickFilter` is the app's alone: no event)                          | `argus-column-filters-change` (also when a filter is cleared)                             |
| Formula columns | `columns` (a column's `formula`; the app owns them, the formula editor only proposes) | `argus-formula-column-add` / `-change` / `-remove` (from `@argus-table/formulas`) |

- **Uncontrolled** (property never set): the table keeps the state, updates it, then fires the event.
- **Controlled** (property set by the host): the table fires the event with the proposed new state but changes nothing until the host sets the property again. One helper in `core/state` implements this for every row of the table above.
- All events are `CustomEvent` with `bubbles: true` and `composed: true`; `detail` carries the new (or, when controlled, the proposed) state, under the property's name (`argus-<property>-change`, ADR 0004), plus what changed where it isn't obvious from the state alone, for example `columnId` on `argus-column-sizing-change`. The events table in the [public API](../plan/07-public-api.md#events) is the reference for each event's `detail`. Events fire after the update, never during `render()`.
- `getState()` / `setState()` read and write the rows above as one object of plain JSON (`TableState`), for saving a user's layout, plus `quickFilter` and the scroll position (`scroll`: the row at the top and the horizontal offset). Formula columns aren't in it: they live in `columns`, which the app saves. `setState()` applies only the keys it is given, leaves controlled ones to the host, and fires no events (it is a host write, not a user action); it stores values through the same `request()` path as user actions, so uncontrolled state stays uncontrolled.
