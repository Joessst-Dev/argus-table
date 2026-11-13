---
'@argus-table/react': minor
'@argus-table/vue': minor
'@argus-table/angular': minor
---

The table components bind the formula editor's events from `formulas()` (`@argus-table/formulas`): `onFormulaColumnAdd`, `onFormulaColumnChange` and `onFormulaColumnRemove` in React, `@formula-column-add`, `@formula-column-change` and `@formula-column-remove` in Vue, and the `formulaColumnAdd`, `formulaColumnChange` and `formulaColumnRemove` outputs in Angular. Before, these needed a ref and `addEventListener`.

```tsx
const apply = (e: CustomEvent<FormulaColumnDetail<Order>>) => setColumns(e.detail.columns);

<ArgusTable
  columns={columns}
  data={orders}
  plugins={plugins}
  onFormulaColumnAdd={apply}
  onFormulaColumnChange={apply}
  onFormulaColumnRemove={apply}
/>;
```

Each wrapper exports `FormulaColumnDetail<T>` and `FormulaColumnChangeDetail<T>`, typed with its own columns (`ReactColumnDef<T>`, `VueColumnDef<T>`, `AngularColumnDef<T>`), so `detail.columns` can go straight back into `columns`. The wrappers still don't depend on `@argus-table/formulas`.
