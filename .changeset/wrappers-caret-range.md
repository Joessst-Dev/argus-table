---
'@argus-table/react': patch
'@argus-table/vue': patch
'@argus-table/angular': patch
---

The wrappers depend on `argus-table` with a caret range (`^0.2.0`) instead of an exact version, so a newer `argus-table` you install yourself is shared with the wrapper rather than installed twice. Two copies would both try to register `<argus-table>`, and the second fails.
