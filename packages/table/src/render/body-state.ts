import type { PageCache, TableModel } from '@argus-table/core';
import type { VirtualWindow } from '../controllers/virtual-controller.js';
import type { TableLabels } from '../labels.js';
import type { CellContent } from '../types.js';
import {
  detailRowId,
  firstDataColumn,
  type Loading,
  type RowToggles,
  type TreeRows,
} from './body.js';

/**
 * Loading state for the body while a data source is set: the state of each
 * row, and a Retry button on the first visible row of each failed page.
 */
export function loadingState<T>(
  cache: PageCache<T>,
  window: VirtualWindow,
  model: TableModel<T, CellContent>,
  labels: TableLabels,
  onRetry: (event: Event) => void,
): Loading {
  const { range } = window;
  const top = (range && model.display.dataRange(range.start, range.end)?.first) ?? 0;
  const firstByPage = new Map<number, number>();
  for (const { row: index, idle } of window.rows) {
    if (idle) continue;
    if (index < top || cache.stateAt(index) !== 'error') continue;
    const page = cache.pageOf(index);
    const first = firstByPage.get(page);
    if (first === undefined || index < first) firstByPage.set(page, index);
  }
  const retry = new Map<number, string>();
  for (const [page, index] of firstByPage) {
    const start = page * cache.pageSize;
    const end = Math.min(start + cache.pageSize, cache.rowCount);
    retry.set(index, labels.retryRows({ first: start + 1, last: end }));
  }
  return {
    stateAt: (index) => cache.stateAt(index),
    retry,
    retryText: labels.retry,
    onRetry,
  };
}

/** The toggle column's chevrons, for the body. */
export function rowToggles<T>(
  model: TableModel<T, CellContent>,
  window: VirtualWindow,
  labels: TableLabels,
  onToggle: (event: Event) => void,
): RowToggles {
  const { display } = model;
  const panels = new Map(
    window.details.filter((r) => !r.idle).map((r) => [r.row, detailRowId(r.slot)]),
  );
  return {
    controls: (index) => panels.get(index),
    expandable: (index) => model.expandable(index),
    // The model placed a panel after it: expanded, loaded and expandable.
    open: (index) => display.hasDetail(index),
    expandLabel: labels.expandRow,
    collapseLabel: labels.collapseRow,
    onClick: onToggle,
  };
}

/**
 * The tree column and the rows' places in the tree, for the body; `undefined`
 * while the rows don't form a tree. The tree column is the model's first data
 * column, rendered or not (`virtualizeColumns`).
 */
export function treeRows<T>(
  model: TableModel<T, CellContent>,
  labels: TableLabels,
  onClick: (event: Event) => void,
): TreeRows | undefined {
  if (!model.tree) return undefined;
  return {
    column: firstDataColumn(model.columns),
    row: (index) => model.treeRow(index),
    expandLabel: labels.expandTreeRow,
    collapseLabel: labels.collapseTreeRow,
    onClick,
  };
}
