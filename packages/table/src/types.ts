import type { TemplateResult } from 'lit';
import type { ColumnDef as CoreColumnDef, ColumnGroup as CoreColumnGroup } from '@argus-table/core';

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

/**
 * A header over several columns (`columnGroups`): an `id`, a `header`, and the
 * `columns` it spans, by id, with nested groups among them.
 */
export type ColumnGroup<TContent = CellContent> = CoreColumnGroup<TContent>;

/** Row density. Each one sets defaults for `--argus-row-height` and `--argus-cell-padding-inline`. */
export type Density = 'compact' | 'comfortable' | 'spacious';

export type { ArgusPlugin, CellTarget, ColumnInfo, PluginHost } from './plugins.js';
export type { ContentRenderer } from './render/content-directive.js';
export type { TableLabels } from './labels.js';

export type {
  CellClickDetail,
  CellContext,
  ColumnAlign,
  ColumnFilter,
  ColumnFiltersChangeDetail,
  ColumnFilterState,
  ColumnOrderChangeDetail,
  ColumnOrderState,
  ColumnPin,
  ColumnPinningChangeDetail,
  ColumnPinningState,
  ColumnSizingChangeDetail,
  ColumnSizingState,
  ColumnVisibilityChangeDetail,
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
  ScrollState,
  SelectionChangeDetail,
  SelectionMode,
  SelectionState,
  SetFilter,
  SortDirection,
  SortingChangeDetail,
  SortItem,
  SortState,
  TableState,
  TextFilter,
  TextFilterOp,
} from '@argus-table/core';
