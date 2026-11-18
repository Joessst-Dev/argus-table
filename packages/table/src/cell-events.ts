import { EXPAND_COLUMN_ID, SELECTION_COLUMN_ID, type TableModel } from '@argus-table/core';
import type { NavigationController } from './controllers/navigation.js';
import { CELL_CLICK, fire, ROW_CLICK } from './events.js';
import { dataIndexOf, gridCell, gridRowOf, gridRowOfCell, layoutOf } from './grid.js';
import type { CellTarget } from './plugins.js';
import { PANEL_COLUMN } from './render/body.js';
import type { CellClickDetail, CellContent } from './types.js';

const TREE_TOGGLE = '[part~="tree-toggle"]';

/**
 * Fires `argus-cell-click` (when a cell is on the path), then `argus-row-click`,
 * for the body or pinned row on an event path. Clicks and Enter on a cell use
 * it. Rows that haven't loaded, the header, the checkbox column and a tree row's
 * toggle fire nothing.
 */
export function activate<T>(
  element: HTMLElement,
  root: Node,
  model: TableModel<T, CellContent>,
  path: readonly EventTarget[],
): void {
  let columnId: string | undefined;
  for (const target of path) {
    // A nested table's cells and rows (in a cell or a panel) aren't this table's: walk on out.
    if (!(target instanceof HTMLElement) || target.getRootNode() !== root) continue;
    // A tree row's toggle only expands or collapses it.
    if (target.matches(TREE_TOGGLE)) return;
    const role = target.getAttribute('role');
    if (role === 'gridcell') columnId = target.dataset.col;
    if (columnId === SELECTION_COLUMN_ID || columnId === EXPAND_COLUMN_ID) return;
    if (role !== 'row') continue;
    const at = gridRowOf(target, layoutOf(model));
    if (!at || at.section === 'header') return;
    if (at.section === 'body') {
      // A panel's row fires nothing; a data row's events carry its data index.
      const index = dataIndexOf(model, at.index);
      if (index === undefined) return;
      const row = model.rowAt(index);
      if (!row) return;
      if (columnId !== undefined) {
        const detail: CellClickDetail<T> = {
          row: row.original,
          rowId: row.id,
          index,
          columnId,
          value: model.valueAt(index, columnId),
        };
        // No `depth` key without a tree: details stay as they were.
        const depth = model.treeRow(index)?.depth;
        if (depth !== undefined) detail.depth = depth;
        fire(element, CELL_CLICK, detail);
      }
      fire(element, ROW_CLICK, { row: row.original, rowId: row.id, index });
      return;
    }
    const pinned = at.section;
    const { index } = at;
    const row = model.pinnedRowAt(pinned, index);
    if (!row) return;
    if (columnId !== undefined) {
      fire(element, CELL_CLICK, {
        row: row.original,
        rowId: row.id,
        index,
        columnId,
        value: model.pinnedValueAt(pinned, index, columnId),
        pinned,
      });
    }
    fire(element, ROW_CLICK, { row: row.original, rowId: row.id, index, pinned });
    return;
  }
}

/** The header or cell an event happened in, for plugins. */
export function cellTargetOf<T>(
  event: Event,
  root: Node,
  model: TableModel<T, CellContent>,
  nav: NavigationController<T>,
): CellTarget | undefined {
  for (const target of event.composedPath()) {
    const cell = gridCell(target, root);
    const columnId = cell?.dataset.col;
    if (!cell || columnId === undefined) continue;
    // A detail panel is no column's cell: plugins get nothing there.
    if (columnId === PANEL_COLUMN) return undefined;
    const row = gridRowOfCell(cell, layoutOf(model));
    if (!row) return undefined;
    return {
      section: row.section,
      columnId,
      // `0` for the column headers, whatever group rows are above them; a data index in the body.
      rowIndex:
        row.section === 'header'
          ? 0
          : row.section === 'body'
            ? (dataIndexOf(model, row.index) ?? -1)
            : row.index,
      rowId: nav.gridRowId(model, row),
    };
  }
  return undefined;
}
