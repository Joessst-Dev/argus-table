import {
  ArgusColumnComponent,
  ArgusColumnGroupComponent,
  ArgusTableComponent,
} from './generated/elements.js';
import { ArgusCellDirective, ArgusGroupHeaderDirective, ArgusHeaderDirective } from './content.js';

export { ArgusColumnComponent, ArgusColumnGroupComponent, ArgusTableComponent };
export {
  ArgusCellDirective,
  ArgusGroupHeaderDirective,
  ArgusHeaderDirective,
  ArgusTableBase,
  argusTemplate,
  type AngularCellContent,
  type AngularColumnDef,
  type AngularColumnGroup,
  type ArgusCellContext,
  type ArgusGroupHeaderContext,
  type ArgusHeaderContext,
  type ArgusTemplate,
} from './content.js';

// The formula editor's events (`formulas()` from `@argus-table/formulas`), with this wrapper's content.
export type { FormulaColumnChangeDetail, FormulaColumnDetail } from './formula-events.js';

/** The table, its columns and column groups, and the cell, header and group header template directives, for a standalone component's `imports`. */
export const ARGUS_TABLE = [
  ArgusTableComponent,
  ArgusColumnComponent,
  ArgusColumnGroupComponent,
  ArgusCellDirective,
  ArgusHeaderDirective,
  ArgusGroupHeaderDirective,
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
  ColumnFiltersChangeDetail,
  ColumnFilterState,
  ColumnGroup,
  ColumnInfo,
  ColumnOrderChangeDetail,
  ColumnOrderState,
  ColumnPin,
  ColumnPinningChangeDetail,
  ColumnPinningState,
  ColumnResizeEndDetail,
  ColumnSizingChangeDetail,
  ColumnSizingState,
  ColumnVisibilityChangeDetail,
  ColumnVisibilityState,
  ColumnWidth,
  ContentRenderer,
  DataSource,
  DateFilter,
  Density,
  FilterKind,
  FilterValue,
  HeaderGroupInfo,
  LoadErrorDetail,
  NumberFilter,
  PinnedRows,
  PluginHost,
  RangeChangeDetail,
  RangeFilterOp,
  RowClickDetail,
  RowPin,
  RowSection,
  RowsRequest,
  RowsResponse,
  RowTarget,
  ScrollAlign,
  ScrollState,
  ScrollToColumnOptions,
  ScrollToRowOptions,
  SelectionChangeDetail,
  SelectionMode,
  SelectionState,
  SetFilter,
  SortingChangeDetail,
  SortDirection,
  SortItem,
  SortState,
  TableLabels,
  TableState,
  TextFilter,
  TextFilterOp,
} from 'argus-table';
