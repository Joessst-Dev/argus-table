import type { TemplateResult } from 'lit';
import type { ColumnDef as CoreColumnDef } from '@argus-table/core';

/**
 * What a column's `header` or `cell` may produce: a Lit template, a DOM node, or
 * text. The content is rendered into the table's light DOM and slotted into the
 * cell, so page CSS and the page's own components work inside it.
 */
export type CellContent = TemplateResult | Node | string | number;

/** One column of `<argus-table>`: what it shows, how wide it is, and how it behaves. */
export type ColumnDef<T = unknown> = CoreColumnDef<T, CellContent>;

/** Row density. Each one sets defaults for `--argus-row-height` and `--argus-cell-padding-inline`. */
export type Density = 'compact' | 'comfortable' | 'spacious';

export type { ArgusPlugin, CellTarget, ColumnInfo, PluginHost } from './plugins.js';

export type {
  CellClickDetail,
  CellContext,
  ColumnAlign,
  ColumnHideDetail,
  ColumnOrderState,
  ColumnPin,
  ColumnPinDetail,
  ColumnPinningState,
  ColumnReorderDetail,
  ColumnResizeDetail,
  ColumnSizingState,
  ColumnVisibilityState,
  ColumnWidth,
  DataSource,
  LoadErrorDetail,
  PinnedRows,
  RangeChangeDetail,
  RowClickDetail,
  RowPin,
  RowsRequest,
  RowsResponse,
  RowSelectDetail,
  SelectionMode,
  SelectionState,
  SortChangeDetail,
  SortItem,
  SortState,
} from '@argus-table/core';
