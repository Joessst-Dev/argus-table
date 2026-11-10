import type { TemplateResult } from 'lit';
import type { ColumnDef as CoreColumnDef } from '@argus-table/core';

/**
 * What a column's `header` or `cell` may produce: a Lit template, a DOM node, or
 * text. The content is rendered into the table's light DOM and slotted into the
 * cell, so page CSS and the page's own components work inside it.
 */
export type CellContent = TemplateResult | Node | string | number;

/**
 * One column of `<argus-table>`: what it shows, how wide it is, and how it behaves.
 * `TContent` is what `header` and `cell` may return; the framework wrappers widen it
 * to their own content (React nodes, Vue VNodes), which reaches the table's
 * `contentRenderer`.
 */
export type ColumnDef<T = unknown, TContent = CellContent> = CoreColumnDef<T, TContent>;

/** Row density. Each one sets defaults for `--argus-row-height` and `--argus-cell-padding-inline`. */
export type Density = 'compact' | 'comfortable' | 'spacious';

export type { ArgusPlugin, CellTarget, ColumnInfo, PluginHost } from './plugins.js';
export type { ContentRenderer } from './render/content-directive.js';

export type {
  CellClickDetail,
  CellContext,
  ColumnAlign,
  ColumnFilter,
  ColumnFilterDetail,
  ColumnFilterState,
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
  DateFilter,
  FilterKind,
  FilterValue,
  LoadErrorDetail,
  NumberFilter,
  PinnedRows,
  RangeChangeDetail,
  RangeFilterOp,
  RowClickDetail,
  RowPin,
  RowsRequest,
  RowsResponse,
  RowSelectDetail,
  SelectionMode,
  SelectionState,
  SetFilter,
  SortChangeDetail,
  SortItem,
  SortState,
  TextFilter,
  TextFilterOp,
} from '@argus-table/core';
