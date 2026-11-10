export { ArgusColumn, ArgusTable } from './generated/elements.js';
export type {
  ArgusColumnElementProps,
  ArgusColumnExposed,
  ArgusColumnProps,
  ArgusColumnSlots,
  ArgusTableElementProps,
  ArgusTableEmit,
  ArgusTableEventProps,
  ArgusTableExposed,
  ArgusTableProps,
  ArgusTableSlots,
} from './generated/elements.js';

// The element classes, for typing `exposed.element` or a ref to the raw element.
export type {
  ArgusColumn as ArgusColumnElement,
  ArgusTable as ArgusTableElement,
} from 'argus-table';

export type {
  ArgusPlugin,
  CellClickDetail,
  CellContent,
  CellContext,
  CellTarget,
  ColumnAlign,
  ColumnDef,
  ColumnInfo,
  ColumnOrderState,
  ColumnPin,
  ColumnReorderDetail,
  ColumnResizeDetail,
  ColumnSizingState,
  ColumnWidth,
  DataSource,
  Density,
  LoadErrorDetail,
  PinnedRows,
  PluginHost,
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
} from 'argus-table';
