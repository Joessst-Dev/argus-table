---
'argus-table': major
---

**1.0.** The public API is now stable. Properties, attributes, methods, events and their `detail` fields, CSS parts, `--argus-*` tokens and slots change only in a major release.

**Not breaking** (any minor release may do these):

- new members in the union types the table outputs, such as `CellTarget.section`, `FilterKind`, `ColumnFilter` and `SelectionMode`; code that switches over them needs a default branch;
- new members of the plugin host, and new optional plugin hooks;
- new optional fields in column definitions, event details and `TableState`;
- different text in the built-in English strings, and new values in the default theme's colours and spacing (the names stay).

The full policy is in ADR 0004. 1.0 has no API changes from 0.5: upgrading from 0.5 needs no code changes. From 0.3 or older, see the 0.4.0 notes, which list the renamed events, tokens, parts and plugin members.
