---
tags: [skill-creator]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Implement header click sorting for <argus-table>: clicking a sortable column header cycles asc -> desc -> none and emits argus-sorting-change with the new sorting. If the app passes its own `sorting` the table should behave like a controlled input. Put it in packages/table/src (a controller is fine) with tests.
