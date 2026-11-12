---
'@argus-table/formulas': minor
'@argus-table/header-menu': patch
'@argus-table/react': patch
'@argus-table/vue': patch
'@argus-table/angular': patch
---

Follow the 1.0 plugin API (ADR 0004).

- **Formulas:**
  - Exports `FORMULA_COLUMN_ADD`, `FORMULA_COLUMN_CHANGE` and `FORMULA_COLUMN_REMOVE` for its event names, and `FormulaMenuGroup` and `FormulaMenuItem` for its menu items.
  - `FormulaColumnDetail` and `FormulaColumnChangeDetail` take the columns' content type as a second parameter, which defaults to the table's own. `detail.columns` is a readonly array.
- **Wrappers:** they re-export the new `SortDirection` type, and a check keeps their type re-exports in step with `argus-table`.
