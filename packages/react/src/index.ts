export { ArgusColumn, ArgusTable } from './generated/elements.js';
export type {
  ArgusColumnElementProps,
  ArgusColumnProps,
  ArgusTableElementProps,
  ArgusTableEventProps,
  ArgusTableProps,
} from './generated/elements.js';

// The element classes, for typing a ref: `useRef<ArgusTableElement<Order>>(null)`.
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
