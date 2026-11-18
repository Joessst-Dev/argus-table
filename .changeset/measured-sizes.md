---
'argus-table': patch
---

Internal: measured row heights (`rowHeight: 'auto'` and detail panels) are kept and laid out by a DOM-free class in core, `MeasuredSizes`, instead of inside the table's virtualizer. Nothing changes for apps.
