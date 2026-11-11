import {
  ArgusColumnComponent,
  ArgusColumnGroupComponent,
  ArgusTableComponent,
} from './generated/elements.js';
import { ArgusCellDirective, ArgusHeaderDirective } from './content.js';

export { ArgusColumnComponent, ArgusColumnGroupComponent, ArgusTableComponent };
export {
  ArgusCellDirective,
  ArgusHeaderDirective,
  ArgusTableBase,
  argusTemplate,
  type AngularCellContent,
  type AngularColumnDef,
  type AngularColumnGroup,
  type ArgusCellContext,
  type ArgusHeaderContext,
  type ArgusTemplate,
} from './content.js';

/** The table, its columns and column groups, and the cell and header template directives, for a standalone component's `imports`. */
export const ARGUS_TABLE = [
  ArgusTableComponent,
  ArgusColumnComponent,
  ArgusColumnGroupComponent,
  ArgusCellDirective,
  ArgusHeaderDirective,
] as const;

// The element classes, for typing `component.element`.
export type {
  ArgusColumn as ArgusColumnElement,
  ArgusColumnGroup as ArgusColumnGroupElement,
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
  ColumnFilter,
  ColumnFilterDetail,
  ColumnFilterState,
  ColumnGroup,
  ColumnHideDetail,
  ColumnInfo,
  ColumnOrderState,
  ColumnPin,
  ColumnPinDetail,
  ColumnPinningState,
  ColumnReorderDetail,
  ColumnResizeDetail,
  ColumnSizingState,
  ColumnVisibilityState,
  ColumnWidth,
  ContentRenderer,
  DataSource,
  DateFilter,
  Density,
  FilterKind,
  FilterValue,
  LoadErrorDetail,
  NumberFilter,
  PinnedRows,
  PluginHost,
  RangeChangeDetail,
  RangeFilterOp,
  RowClickDetail,
  RowPin,
  RowSelectDetail,
  ScrollState,
  RowsRequest,
  RowsResponse,
  SelectionMode,
  SelectionState,
  SetFilter,
  SortChangeDetail,
  SortItem,
  SortState,
  TableState,
  TextFilter,
  TextFilterOp,
} from 'argus-table';
