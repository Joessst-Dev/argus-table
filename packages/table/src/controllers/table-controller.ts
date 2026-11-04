import { createTableModel, type TableModel, type TableModelOptions } from '@argus-table/core';
import type { CellContent } from '../types.js';

/**
 * Owns the table model (core's TanStack adapter). The element pushes its
 * properties in from `willUpdate`; render functions read `model`. It needs no
 * lifecycle hooks yet: the model is pull-based and owns no state.
 */
export class TableController<T> {
  readonly model: TableModel<T, CellContent>;

  constructor() {
    this.model = createTableModel<T, CellContent>({
      columns: [],
      data: [],
      getRowId: undefined,
      sorting: [],
      columnSizing: {},
    });
  }

  update(options: Partial<TableModelOptions<T, CellContent>>): void {
    this.model.update(options);
  }
}
