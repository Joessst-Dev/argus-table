import type { TableModel } from '@argus-table/core';
import type { DataController } from '../controllers/data-controller.js';
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
 * Loading state for the body while a data source is set (else `undefined`): the
 * state of each row, and a Retry button on the first visible row of each failed
 * page, and on the error row of each parent whose children failed (a tree).
 * Indexes are shown indexes; the data controller maps top-level rows to pages.
 */
export function loadingState<T>(
  model: TableModel<T, CellContent>,
  data: DataController<T>,
  window: VirtualWindow,
  labels: TableLabels,
  onRetry: (event: Event) => void,
): Loading | undefined {
  const cache = data.cache;
  if (!cache) return undefined;
  // Read once: `stateAt` runs per rendered row.
  const { rows } = model;
  const { range } = window;
  const top = (range && model.display.dataRange(range.start, range.end)?.first) ?? 0;
  const firstByPage = new Map<number, number>();
  const retry = new Map<number, string>();
  for (const { row: index, idle } of window.rows) {
    if (idle) continue;
    if (index < top || rows.stateAt(index) !== 'error') continue;
    const page = data.pageAt(index);
    if (page === undefined) {
      // A parent's failed children: one error row under it.
      retry.set(index, labels.retryChildren);
      continue;
    }
    const first = firstByPage.get(page);
    if (first === undefined || index < first) firstByPage.set(page, index);
  }
  // In a tree, shown rows (as `argus-load-error` and `aria-rowindex` count them):
  // open rows above push the page down.
  for (const [page, index] of firstByPage) {
    const start = page * cache.pageSize;
    const end = Math.min(start + cache.pageSize, cache.rowCount);
    retry.set(
      index,
      labels.retryRows({ first: data.shownOfTop(start) + 1, last: data.shownOfTop(end) }),
    );
  }
  return {
    stateAt: (index) => rows.stateAt(index),
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
 * column, rendered or not (`virtualizeColumns`). Rows not loaded (a data
 * source's) carry their depth too.
 */
export function treeRows<T>(
  model: TableModel<T, CellContent>,
  labels: TableLabels,
  onClick: (event: Event) => void,
): TreeRows | undefined {
  if (!model.tree) return undefined;
  const { rows } = model;
  return {
    column: firstDataColumn(model.columns),
    row: (index) => model.treeRow(index),
    depth: (index) => rows.depthAt(index),
    expandLabel: labels.expandTreeRow,
    collapseLabel: labels.collapseTreeRow,
    onClick,
  };
}
