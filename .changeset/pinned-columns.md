---
'argus-table': minor
---

Pin columns with `pin: 'start'` or `pin: 'end'`. Pinned header and body cells stay in place while the other columns scroll sideways, in LTR and RTL. Body cells in pinned columns get the `cell-pinned` part, and the one next to the scrolling columns also gets `cell-pinned-edge`, with a shadow from `--argus-pinned-shadow` (mirrored for the end side and in RTL; `none` removes it).
