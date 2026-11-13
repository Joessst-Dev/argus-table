// The tables this skill migrates from: how to recognise each one in a
// project, and what each feature it uses becomes in argus-table.
//
// fit: `maps` (argus-table has it), `partial` (close, with differences),
// `builtin` (argus-table does it already: delete the code), `gap` (no
// equivalent; references/gaps.md#<gap> says what to tell the user).
// `argus` names only real API (props, column fields, events, methods,
// add-ons): skills/test/integrate-sync.test.mjs checks them.

const f = (id, re, fit, argus = {}, extra = {}) => ({ id, re, fit, argus, ...extra });

/**
 * Each library: `deps` (package names), `gate` (a file must match to be
 * looked at), `requires` (must match too, unless the project depends on one
 * of `deps`: components registered globally), `anchors` (where a usage
 * starts), `vocabulary` (marks a file of column definitions), `columnKey`
 * (counts columns) and `features`.
 */
export const LIBRARIES = [
  {
    id: 'tanstack',
    name: 'TanStack Table',
    reference: 'migrate/tanstack.md',
    deps: [
      '@tanstack/react-table',
      '@tanstack/vue-table',
      '@tanstack/angular-table',
      '@tanstack/table-core',
    ],
    unsupported: {
      'react-table':
        'react-table v7 (the predecessor of TanStack Table): migrate by hand with migrate/tanstack.md',
      '@tanstack/solid-table':
        'Solid: use the <argus-table> element directly (frameworks/vanilla.md)',
      '@tanstack/svelte-table':
        'Svelte: use the <argus-table> element directly (frameworks/vanilla.md)',
      'material-react-table':
        'built on TanStack Table: migrate with migrate/tanstack.md and migrate/mui-x.md',
      'mantine-react-table': 'built on TanStack Table: migrate with migrate/tanstack.md',
    },
    gate: /@tanstack\/(?:react|vue|angular)-table|@tanstack\/table-core/,
    anchors: [
      /\buseReactTable\s*[<(]/,
      /\buseVueTable\s*[<(]/,
      /\bcreateAngularTable\s*[<(]/,
      /\bcreateTable\s*[<(]/,
      /\buseTable\s*[<(]/,
      /\buseLegacyTable\s*[<(]/,
      /\bcreateTableHook\s*[<(]/,
    ],
    vocabulary:
      /\baccessorKey\s*:|\baccessorFn\s*:|\bcolumnHelper\.(?:accessor|display|group)\b|\bColumnDef\s*</,
    columnKey:
      /\baccessorKey\s*:|\baccessorFn\s*:|\bcolumnHelper\.(?:accessor|display)\s*\(|\bid\s*:\s*['"](?:select|actions)['"]/g,
    sortsByDefault: false,
    features: [
      f(
        'sorting',
        /\bgetSortedRowModel\b|\bcreateSortedRowModel\b|\b(?:row)?[sS]ortingFeature\b|\bonSortingChange\b|\benableSorting\b/,
        'maps',
        {
          column: ['sortable'],
          props: ['sorting'],
          events: ['argus-sorting-change'],
        },
      ),
      f(
        'multi-sort',
        /\benableMultiSort\b|\bisMultiSortEvent\b|\bmaxMultiSortColCount\b/,
        'partial',
        { props: ['sorting'] },
      ),
      f(
        'column-filters',
        /\bcolumnFilters\b|\bcolumnFilteringFeature\b|\bonColumnFiltersChange\b|\bsetFilterValue\b|\bfilterFn\s*:/,
        'maps',
        {
          column: ['filter', 'filterFn'],
          props: ['columnFilters'],
          events: ['argus-column-filters-change'],
          addons: ['@argus-table/header-menu'],
        },
      ),
      f(
        'global-filter',
        /\bglobalFilter\b|\bonGlobalFilterChange\b|\bglobalFilteringFeature\b/,
        'maps',
        {
          props: ['quickFilter'],
        },
      ),
      f(
        'faceted',
        /\bgetFaceted(?:UniqueValues|RowModel|MinMaxValues)\b|\bcreateFaceted\w*RowModel\b|\bcolumnFacetingFeature\b/,
        'maps',
        {
          column: ['filter', 'filterOptions'],
        },
      ),
      f(
        'pagination',
        /\bgetPaginationRowModel\b|\bcreatePaginatedRowModel\b|\browPaginationFeature\b|\bonPaginationChange\b|\bsetPageIndex\b|\bgetCanNextPage\b|\bpaginationRowModel\b/,
        'gap',
        {},
        { gap: 'pagination' },
      ),
      f(
        'server-side',
        /\bmanual(?:Pagination|Sorting|Filtering)\s*:|\browCount\s*:|\bpageCount\s*:/,
        'maps',
        { props: ['dataSource'] },
      ),
      f(
        'row-selection',
        /\benableRowSelection\b|\browSelection(?:Feature)?\b|\bonRowSelectionChange\b|\bgetToggleAllRowsSelectedHandler\b/,
        'maps',
        {
          props: ['selectionMode', 'selectionCheckboxes', 'selection'],
          events: ['argus-selection-change'],
        },
      ),
      f('row-id', /\bgetRowId\s*[:(]/, 'maps', { props: ['getRowId'] }),
      f(
        'resizing',
        /\benableColumnResizing\b|\bcolumnResizeMode\b|\bgetResizeHandler\b|\bcolumnSizing\b|\bcolumnResizingFeature\b/,
        'maps',
        {
          column: ['resizable', 'width', 'minWidth', 'maxWidth'],
          props: ['columnSizing'],
          events: ['argus-column-sizing-change', 'argus-column-resize-end'],
        },
      ),
      f(
        'column-pinning',
        /\bcolumnPinning(?:Feature)?\b|\benableColumnPinning\b|\bgetIsPinned\b/,
        'maps',
        {
          column: ['pin'],
          props: ['columnPinning'],
        },
      ),
      f('row-pinning', /\browPinning(?:Feature)?\b|\benableRowPinning\b/, 'partial', {
        props: ['pinnedRows'],
      }),
      f(
        'column-order',
        /\bcolumnOrder\b|\bcolumnOrderingFeature\b|\bonColumnOrderChange\b/,
        'maps',
        {
          props: ['columnOrder'],
          column: ['reorderable'],
        },
      ),
      f(
        'column-visibility',
        /\bcolumnVisibility(?:Feature)?\b|\bgetToggleVisibilityHandler\b/,
        'maps',
        {
          props: ['columnVisibility'],
          column: ['hidden'],
          addons: ['@argus-table/header-menu'],
        },
      ),
      f(
        'column-groups',
        /\bcolumnHelper\.group\s*\(|\bgetHeaderGroups\b[\s\S]{0,40}\bdepth\b|\bcolumns\s*:\s*\[\s*(?:columnHelper|\{)/,
        'maps',
        {
          props: ['columnGroups'],
        },
      ),
      f(
        'grouping',
        /\bgetGroupedRowModel\b|\bcreateGroupedRowModel\b|\b(?:column)?[gG]roupingFeature\b|\browAggregationFeature\b|\baggregationFn\b|\baggregatedCell\b/,
        'gap',
        {},
        { gap: 'row-grouping' },
      ),
      f(
        'expanding',
        /\bgetExpandedRowModel\b|\bcreateExpandedRowModel\b|\browExpandingFeature\b|\bgetSubRows\b|\brenderSubComponent\b|\bgetCanExpand\b/,
        'gap',
        {},
        { gap: 'tree-data' },
      ),
      f(
        'virtualizer',
        /\buseVirtualizer\b|\binjectVirtualizer\b|@tanstack\/(?:react|vue|angular)-virtual/,
        'builtin',
      ),
      f('footer', /\bfooter\s*:|\bgetFooterGroups\b/, 'partial', { props: ['pinnedRows'] }),
      f('editing', /\bmeta\??\.updateData\b|\bupdateData\s*[:(]/, 'gap', {}, { gap: 'editing' }),
      f('cell-selection', /\bcellSelectionFeature\b/, 'gap', {}, { gap: 'range-selection' }),
      f('cell-spanning', /\bcellSpanningFeature\b/, 'gap', {}, { gap: 'cell-spanning' }),
      f('flex-render', /\bflexRender\b|\bFlexRender\b/, 'maps', { column: ['cell', 'header'] }),
    ],
  },
  {
    id: 'ag-grid',
    name: 'AG Grid',
    reference: 'migrate/ag-grid.md',
    deps: [
      'ag-grid-community',
      'ag-grid-enterprise',
      'ag-grid-react',
      'ag-grid-vue3',
      'ag-grid-vue',
      'ag-grid-angular',
      '@ag-grid-community/core',
      '@ag-grid-community/react',
      '@ag-grid-community/client-side-row-model',
      '@ag-grid-enterprise/core',
    ],
    enterprise: /ag-grid-enterprise|@ag-grid-enterprise\//,
    gate: /ag-grid|AgGrid|agGrid/,
    anchors: [
      /<AgGridReact\b/,
      /<ag-grid-vue\b/,
      /<AgGridVue\b/,
      /<ag-grid-angular\b/,
      /\bcreateGrid\s*\(/,
      /\bnew\s+Grid\s*\(/,
    ],
    vocabulary: /\bColDef\b|\bcolumnDefs\b|\bheaderName\s*:|\bfield\s*:\s*['"]/,
    columnKey: /\bfield\s*:\s*['"]|\bcolId\s*:/g,
    sortsByDefault: true,
    features: [
      f(
        'sorting',
        /\bsortable\s*:|\bdefaultColDef\b|\bsort\s*:\s*['"](?:asc|desc)|\bonSortChanged\b/,
        'maps',
        {
          column: ['sortable'],
          props: ['sorting'],
          events: ['argus-sorting-change'],
        },
      ),
      f('multi-sort', /\bmultiSortKey\b|\balwaysMultiSort\b|\bsortIndex\s*:/, 'partial', {
        props: ['sorting'],
      }),
      f(
        'filters',
        /\bfilter\s*:\s*(?:true|['"]ag(?:Text|Number|Date|Set|Multi)ColumnFilter['"])|\bfilterParams\b/,
        'maps',
        {
          column: ['filter', 'filterOptions'],
          props: ['columnFilters'],
          addons: ['@argus-table/header-menu'],
        },
      ),
      f('floating-filters', /\bfloatingFilter\s*:/, 'gap', {}, { gap: 'filter-row' }),
      f('quick-filter', /\bquickFilterText\b|\bsetQuickFilter\b/, 'maps', {
        props: ['quickFilter'],
      }),
      f(
        'selection',
        /\browSelection\s*[:=]|\bcheckboxSelection\b|\bheaderCheckboxSelection\b|\bcheckboxes\s*:|\bonSelectionChanged\b/,
        'maps',
        {
          props: ['selectionMode', 'selectionCheckboxes', 'selection'],
          events: ['argus-selection-change'],
        },
      ),
      f('row-id', /\bgetRowId\b|\bgetRowNodeId\b/, 'maps', { props: ['getRowId'] }),
      f('pinned-columns', /\bpinned\s*:\s*['"](?:left|right)['"]|\blockPinned\b/, 'maps', {
        column: ['pin'],
        props: ['columnPinning'],
      }),
      f('pinned-rows', /\bpinnedTopRowData\b|\bpinnedBottomRowData\b/, 'maps', {
        props: ['pinnedRows'],
      }),
      f('resizing', /\bresizable\s*:|\bonColumnResized\b/, 'maps', {
        column: ['resizable', 'width', 'minWidth', 'maxWidth'],
        events: ['argus-column-resize-end'],
      }),
      f('flex', /\bflex\s*:\s*\d/, 'maps', { column: ['width'] }),
      f('numeric-column', /\btype\s*:\s*['"]numericColumn['"]|ag-right-aligned/, 'maps', {
        column: ['align'],
      }),
      f('movable', /\bsuppressMovable(?:Columns)?\b|\bonColumnMoved\b/, 'maps', {
        column: ['reorderable'],
        props: ['columnOrder'],
      }),
      f('hide', /\bhide\s*:\s*true\b/, 'maps', { column: ['hidden'], props: ['columnVisibility'] }),
      f(
        'infinite',
        /\browModelType\s*[:=]\s*['"]infinite['"]|\bdatasource\s*[:=]|\bIDatasource\b/,
        'maps',
        { props: ['dataSource'], methods: ['refresh'] },
      ),
      f(
        'server-side-row-model',
        /['"]serverSide['"]|\bserverSideDatasource\b|\bIServerSideDatasource\b/,
        'partial',
        { props: ['dataSource'] },
      ),
      f('viewport', /['"]viewport['"]|\bviewportDatasource\b/, 'gap', {}, { gap: 'viewport' }),
      f(
        'pagination',
        /\bpagination\s*[:=]\s*(?:true|\{)|\bpaginationPageSize\b|\bpaginationAutoPageSize\b/,
        'gap',
        {},
        { gap: 'pagination' },
      ),
      f(
        'editing',
        /\beditable\s*:|\bcellEditor\b|\bonCellValueChanged\b|\bsingleClickEdit\b|\bstopEditing\b/,
        'gap',
        {},
        { gap: 'editing' },
      ),
      f(
        'row-grouping',
        /\browGroup\s*:|\benableRowGroup\b|\baggFunc\b|\bgroupDisplayType\b|\bpivot(?:Mode)?\s*:/,
        'gap',
        {},
        { gap: 'row-grouping' },
      ),
      f('tree-data', /\btreeData\b|\bgetDataPath\b/, 'gap', {}, { gap: 'tree-data' }),
      f(
        'master-detail',
        /\bmasterDetail\b|\bdetailCellRenderer\b/,
        'gap',
        {},
        { gap: 'master-detail' },
      ),
      f(
        'range-selection',
        /\benableRangeSelection\b|\bcellSelection\s*:|\benableFillHandle\b|\bcopyToClipboard\b/,
        'gap',
        {},
        { gap: 'range-selection' },
      ),
      f('row-drag', /\browDrag\b|\browDragManaged\b/, 'gap', {}, { gap: 'row-drag' }),
      f(
        'context-menu',
        /\bgetContextMenuItems\b|\bmainMenuItems\b/,
        'gap',
        {},
        { gap: 'context-menu' },
      ),
      f(
        'side-bar-status-bar',
        /\bsideBar\s*[:=]|\bstatusBar\s*[:=]/,
        'gap',
        {},
        { gap: 'tool-panels' },
      ),
      f(
        'spanning',
        /\bcolSpan\s*:|\browSpan\s*:|\bspanRows\b/,
        'gap',
        {},
        { gap: 'cell-spanning' },
      ),
      f('column-groups', /\bchildren\s*:\s*\[\s*\{[^}]*\bfield\b/, 'maps', {
        props: ['columnGroups'],
      }),
      f(
        'row-height',
        /\bautoHeight\s*:|\bwrapText\s*:|\bgetRowHeight\b|\browHeight\s*[:=]/,
        'maps',
        {
          props: ['rowHeight', 'density'],
          column: ['wrap'],
        },
      ),
      f('dom-layout', /\bdomLayout\s*[:=]\s*['"](?:autoHeight|print)['"]/, 'partial'),
      f(
        'cell-renderer',
        /\bcellRenderer\b|\bvalueFormatter\b|\bvalueGetter\b|\bheaderComponent\b/,
        'maps',
        {
          column: ['cell', 'accessor', 'header'],
        },
      ),
      f('events', /\bonRowClicked\b|\bonCellClicked\b|\bonRowDoubleClicked\b/, 'maps', {
        events: ['argus-row-click', 'argus-cell-click'],
      }),
      f('export', /\bexportDataAs(?:Csv|Excel)\b|\bgetDataAs(?:Csv|Excel)\b/, 'maps', {
        addons: ['@argus-table/export'],
      }),
      f('theme', /ag-theme-|\btheme(?:Quartz|Alpine|Balham|Material)\b|ag-grid\.css/, 'maps'),
      f(
        'transactions',
        /\bapplyTransaction(?:Async)?\b|\bsetRowData\b|setGridOption\(\s*['"]rowData['"]/,
        'partial',
        { props: ['data'] },
      ),
      f(
        'overlays',
        /\boverlayNoRowsTemplate\b|\bnoRowsOverlayComponent\b|\bshowNoRowsOverlay\b/,
        'maps',
      ),
      f('locale', /\blocaleText\b|\bgetLocaleText\b/, 'maps', { props: ['labels'] }),
      f(
        'row-class',
        /\bgetRowClass\b|\browClassRules\b|\bcellClassRules\b|\bcellStyle\s*:|\bgetRowStyle\b/,
        'partial',
        { column: ['cell'] },
      ),
      f('state', /\binitialState\s*[:=]|\bgetState\s*\(\)|\bonStateUpdated\b/, 'maps', {
        methods: ['getState', 'setState'],
      }),
    ],
  },
  {
    id: 'mui-x',
    name: 'MUI X Data Grid',
    reference: 'migrate/mui-x.md',
    deps: ['@mui/x-data-grid', '@mui/x-data-grid-pro', '@mui/x-data-grid-premium'],
    gate: /@mui\/x-data-grid/,
    anchors: [/<DataGrid(?:Pro|Premium)?\b/],
    vocabulary: /\bGridColDef\b|\bheaderName\s*:|\bfield\s*:\s*['"]/,
    columnKey: /\bfield\s*:\s*['"]/g,
    sortsByDefault: true,
    features: [
      f(
        'sorting',
        /\bsortModel\b|\bonSortModelChange\b|\bsortable\s*[:=]|\bsortingOrder\b/,
        'maps',
        {
          column: ['sortable'],
          props: ['sorting'],
          events: ['argus-sorting-change'],
        },
      ),
      f(
        'server-mode',
        /\b(?:sorting|filter|pagination)Mode\s*=\s*['"{]+server|\bunstable_dataSource\b|\bdataSource\s*=\s*\{/,
        'maps',
        {
          props: ['dataSource'],
        },
      ),
      f(
        'pagination',
        /\bpaginationModel\b|\bpageSizeOptions\b|\bonPaginationModelChange\b|\bpagination\s*:\s*\{\s*paginationModel/,
        'gap',
        {},
        { gap: 'pagination' },
      ),
      f(
        'checkbox-selection',
        /\bcheckboxSelection\b|\browSelectionModel\b|\bonRowSelectionModelChange\b/,
        'maps',
        {
          props: ['selectionMode', 'selectionCheckboxes', 'selection'],
          events: ['argus-selection-change'],
        },
      ),
      f('row-id', /\bgetRowId\s*=/, 'maps', { props: ['getRowId'] }),
      f(
        'column-types',
        /\btype\s*:\s*['"](?:number|date|dateTime|singleSelect|boolean)['"]|\bvalueOptions\b/,
        'maps',
        {
          column: ['filter', 'align', 'filterOptions'],
        },
      ),
      f('filters', /\bfilterModel\b|\bonFilterModelChange\b|\bfilterOperators\b/, 'maps', {
        props: ['columnFilters'],
        column: ['filter', 'filterFn'],
        addons: ['@argus-table/header-menu'],
      }),
      f(
        'render-cell',
        /\brenderCell\b|\bvalueGetter\b|\bvalueFormatter\b|\brenderHeader\b/,
        'maps',
        {
          column: ['cell', 'accessor', 'header'],
        },
      ),
      f('column-pinning', /\bpinnedColumns\b/, 'maps', {
        props: ['columnPinning'],
        column: ['pin'],
      }),
      f('pinned-rows', /\bpinnedRows\s*=/, 'maps', { props: ['pinnedRows'] }),
      f('visibility', /\bcolumnVisibilityModel\b/, 'maps', { props: ['columnVisibility'] }),
      f('column-grouping', /\bcolumnGroupingModel\b/, 'maps', { props: ['columnGroups'] }),
      f('flex', /\bflex\s*:\s*\d/, 'maps', { column: ['width'] }),
      f('resizing', /\bresizable\s*:|\bonColumnWidthChange\b/, 'maps', {
        column: ['resizable', 'width'],
        events: ['argus-column-resize-end'],
      }),
      f('reorder', /\bcolumnOrder\b|\bonColumnOrderChange\b|\bdisableColumnReorder\b/, 'maps', {
        props: ['columnOrder'],
      }),
      f(
        'toolbar',
        /\bGridToolbar\b|\bshowToolbar\b|\bGridToolbarQuickFilter\b|\bGridToolbarExport\b|\bslots=\{\{[^}]*toolbar/,
        'partial',
        {
          props: ['quickFilter'],
          addons: ['@argus-table/export'],
        },
      ),
      f('auto-height', /\bautoHeight\b/, 'partial'),
      f('row-height', /\bgetRowHeight\b|\browHeight\s*=|\bgetEstimatedRowHeight\b/, 'maps', {
        props: ['rowHeight'],
      }),
      f('density', /\bdensity\s*=/, 'maps', { props: ['density'] }),
      f('events', /\bonRowClick\b|\bonCellClick\b/, 'maps', {
        events: ['argus-row-click', 'argus-cell-click'],
      }),
      f(
        'editing',
        /\beditMode\b|\bprocessRowUpdate\b|\beditable\s*:\s*true|\bonCellEditStop\b/,
        'gap',
        {},
        { gap: 'editing' },
      ),
      f(
        'grouping-tree',
        /\browGroupingModel\b|\baggregationModel\b|\btreeData\b|\bgetTreeDataPath\b/,
        'gap',
        {},
        { gap: 'row-grouping' },
      ),
      f('detail-panel', /\bgetDetailPanelContent\b/, 'gap', {}, { gap: 'master-detail' }),
      f(
        'cell-selection',
        /\bcellSelection\b|\bclipboardCopyCellDelimiter\b/,
        'gap',
        {},
        { gap: 'range-selection' },
      ),
      f('row-reorder', /\browReordering\b/, 'gap', {}, { gap: 'row-drag' }),
      f('header-filters', /\bheaderFilters\b/, 'gap', {}, { gap: 'filter-row' }),
      f('export', /\bexportDataAsCsv\b|\bcsvOptions\b|\bexcelOptions\b|\bprintOptions\b/, 'maps', {
        addons: ['@argus-table/export'],
      }),
      f('locale', /\blocaleText\b/, 'maps', { props: ['labels'] }),
      f('slots', /\bnoRowsOverlay\b|\bloadingOverlay\b/, 'maps'),
      f('loading', /\bloading\s*=/, 'partial', { props: ['dataSource'] }),
      f('api-ref', /\buseGridApiRef\b|\bapiRef\b/, 'partial', {
        methods: ['scrollToRow', 'getState', 'setState', 'refresh'],
      }),
    ],
  },
  {
    id: 'angular-material',
    name: 'Angular Material table',
    reference: 'migrate/angular-material.md',
    deps: ['@angular/material', '@angular/cdk'],
    gate: /mat-table|MatTableModule|MatTableDataSource|matColumnDef|cdk-table/,
    anchors: [
      /<(?:table|mat-table)\b[^>]*\bmat-table\b/,
      /<mat-table\b/,
      /<cdk-table\b/,
      /<table\b[^>]*\bcdk-table\b/,
    ],
    vocabulary: /\bmatColumnDef\b|\bdisplayedColumns\b/,
    columnKey: /\bmatColumnDef\s*=\s*['"]/g,
    sortsByDefault: false,
    features: [
      f('sort', /\bmatSort\b|\bmat-sort-header\b|\bMatSort\b/, 'maps', {
        column: ['sortable'],
        props: ['sorting'],
      }),
      f('paginator', /<mat-paginator\b|\bMatPaginator\b/, 'gap', {}, { gap: 'pagination' }),
      f('filter', /\.filter\s*=|\bfilterPredicate\b/, 'maps', {
        props: ['quickFilter'],
        column: ['filterFn'],
      }),
      f('selection', /\bSelectionModel\b|<mat-checkbox\b/, 'maps', {
        props: ['selectionMode', 'selectionCheckboxes', 'selection'],
      }),
      f('sticky', /\bsticky\b|\bstickyEnd\b/, 'maps', { column: ['pin'] }),
      f('cell-templates', /\*matCellDef\b|\*matHeaderCellDef\b/, 'maps', {
        column: ['cell', 'header'],
      }),
      f('footer', /\bmatFooterCellDef\b|\bmatFooterRowDef\b/, 'partial', { props: ['pinnedRows'] }),
      f(
        'expandable',
        /\bmultiTemplateDataRows\b|\bexpandedElement\b/,
        'gap',
        {},
        { gap: 'master-detail' },
      ),
      f('cdk-virtual', /<cdk-virtual-scroll-viewport\b|\bTableVirtualScroll\b/, 'builtin'),
      f('drag', /\bcdkDropList\b|\bcdkDrag\b/, 'partial', { props: ['columnOrder'] }),
      f('row-click', /<(?:tr|mat-row)\b[^>]*\(click\)/, 'maps', { events: ['argus-row-click'] }),
    ],
  },
  {
    id: 'primeng',
    name: 'PrimeNG / PrimeVue DataTable',
    reference: 'migrate/primeng-primevue.md',
    deps: ['primeng', 'primevue'],
    gate: /<p-table\b|<p-treeTable\b|<DataTable\b|<TreeTable\b/,
    requires: /primevue|primeng|<p-table\b|<p-treeTable\b/,
    anchors: [/<p-table\b/, /<DataTable\b/, /<TreeTable\b/, /<p-treeTable\b/],
    vocabulary: /\bfield\s*[:=]\s*['"]|<Column\b|\bpSortableColumn\b/,
    columnKey: /<Column\b|\bfield\s*:\s*['"]/g,
    sortsByDefault: false,
    features: [
      f('sort', /\bpSortableColumn\b|\bsortable\b|\bsortField\b/, 'maps', {
        column: ['sortable'],
        props: ['sorting'],
      }),
      f('multi-sort', /\bsortMode\s*=\s*['"]multiple['"]/, 'partial', { props: ['sorting'] }),
      f('paginator', /\bpaginator\b|\[rows\]|\s:rows\s*=/, 'gap', {}, { gap: 'pagination' }),
      f('lazy', /\blazy\b|\bonLazyLoad\b|@page\b|\(onLazyLoad\)/, 'maps', {
        props: ['dataSource'],
      }),
      f(
        'selection',
        /\bselectionMode\b|\bp-tableCheckbox\b|\bp-tableHeaderCheckbox\b|\bdataKey\b|v-model:selection/,
        'maps',
        {
          props: ['selectionMode', 'selectionCheckboxes', 'selection', 'getRowId'],
        },
      ),
      f('global-filter', /\bglobalFilterFields\b|\bfilterGlobal\b/, 'maps', {
        props: ['quickFilter'],
      }),
      f('column-filter', /<p-columnFilter\b|\bfilterMatchMode\b|v-model:filters/, 'maps', {
        column: ['filter'],
        props: ['columnFilters'],
        addons: ['@argus-table/header-menu'],
      }),
      f('filter-row', /\bfilterDisplay\s*=\s*['"]row['"]/, 'gap', {}, { gap: 'filter-row' }),
      f('frozen', /\bpFrozenColumn\b|\bfrozen\b|\balignFrozen\b/, 'maps', { column: ['pin'] }),
      f('frozen-rows', /\bfrozenValue\b/, 'maps', { props: ['pinnedRows'] }),
      f('resize', /\bresizableColumns\b|\bpResizableColumn\b/, 'maps', { column: ['resizable'] }),
      f('reorder', /\breorderableColumns\b|\bpReorderableColumn\b/, 'maps', {
        props: ['columnOrder'],
      }),
      f('virtual', /\bvirtualScroll\b|\bvirtualScrollerOptions\b/, 'builtin'),
      f('scroll-height', /\bscrollHeight\b/, 'maps'),
      f(
        'edit',
        /\bpEditableColumn\b|\beditMode\b|\bpInitEditableRow\b/,
        'gap',
        {},
        { gap: 'editing' },
      ),
      f('row-group', /\browGroupMode\b|\bgroupRowsBy\b/, 'gap', {}, { gap: 'row-grouping' }),
      f(
        'expansion',
        /\bexpandedRow\b|\bpRowToggler\b|\bexpandedRowKeys\b/,
        'gap',
        {},
        { gap: 'master-detail' },
      ),
      f('col-group', /<ColumnGroup\b|<p-columnGroup\b/, 'maps', { props: ['columnGroups'] }),
      f('export', /\bexportCSV\b/, 'maps', { addons: ['@argus-table/export'] }),
      f('state', /\bstateStorage\b|\bstateKey\b/, 'maps', { methods: ['getState', 'setState'] }),
      f('tree', /<TreeTable\b|<p-treeTable\b/, 'gap', {}, { gap: 'tree-data' }),
      f('row-click', /\bonRowSelect\b|@row-click\b|\(onRowSelect\)/, 'maps', {
        events: ['argus-row-click'],
      }),
    ],
  },
  {
    id: 'vuetify',
    name: 'Vuetify v-data-table',
    reference: 'migrate/vuetify.md',
    deps: ['vuetify'],
    gate: /<v-data-table|<VDataTable/,
    anchors: [/<v-data-table(?:-server|-virtual)?\b/, /<VDataTable(?:Server|Virtual)?\b/],
    vocabulary: /\b(?:title|text)\s*:\s*['"][^'"]*['"]\s*,\s*(?:key|value)\s*:/,
    columnKey: /\b(?:key|value)\s*:\s*['"]/g,
    sortsByDefault: true,
    features: [
      f('headers', /:headers\b|\bheaders\s*[:=]/, 'maps', { props: ['columns'] }),
      f(
        'server',
        /<v-data-table-server\b|<VDataTableServer\b|items-length|@update:options/,
        'maps',
        { props: ['dataSource'] },
      ),
      f('pagination', /items-per-page|:page\b|v-model:page/, 'gap', {}, { gap: 'pagination' }),
      f('select', /\bshow-select\b|\bitem-value\b|\bselect-strategy\b/, 'maps', {
        props: ['selectionMode', 'selectionCheckboxes', 'selection', 'getRowId'],
      }),
      f('sort', /\bsort-by\b|\bmust-sort\b|v-model:sort-by/, 'maps', {
        props: ['sorting'],
        column: ['sortable'],
      }),
      f('multi-sort', /\bmulti-sort\b/, 'partial', { props: ['sorting'] }),
      f('search', /:search\b/, 'maps', { props: ['quickFilter'] }),
      f('fixed', /\bfixed\s*:\s*true\b|\bfixed-header\b/, 'maps', { column: ['pin'] }),
      f('slots', /#item\.[\w-]+|v-slot:item\.[\w-]+/, 'maps', { column: ['cell'] }),
      f('expand', /\bshow-expand\b|#expanded-row\b/, 'gap', {}, { gap: 'master-detail' }),
      f('group', /\bgroup-by\b/, 'gap', {}, { gap: 'row-grouping' }),
      f('density', /\bdensity\s*=/, 'maps', { props: ['density'] }),
      f('virtual', /<v-data-table-virtual\b|<VDataTableVirtual\b/, 'builtin'),
      f('row-click', /@click:row\b/, 'maps', { events: ['argus-row-click'] }),
    ],
  },
  {
    id: 'antd',
    name: 'Ant Design Table',
    reference: 'migrate/antd.md',
    deps: ['antd'],
    gate: /['"]antd(?:\/[\w/]*)?['"]/,
    alwaysRequires: true,
    requires:
      /import\s+(?:type\s+)?\{[^}]*\bTable\b[^}]*\}\s+from\s+['"]antd['"]|import\s+Table\s+from\s+['"]antd\/(?:es|lib)\/table['"]/,
    anchors: [/<Table\b/],
    vocabulary: /\bdataIndex\s*:|\bColumnsType\b|\bTableColumnsType\b|\bColumnType\s*</,
    columnKey: /\bdataIndex\s*:/g,
    sortsByDefault: false,
    features: [
      f('columns', /\bdataIndex\s*:/, 'maps', { column: ['accessor', 'id'] }),
      f('render', /\brender\s*:/, 'maps', { column: ['cell'] }),
      f('sorter', /\bsorter\s*:/, 'maps', { column: ['sortable'], props: ['sorting'] }),
      f('multi-sort', /\bsorter\s*:\s*\{\s*(?:compare[^}]*)?multiple/, 'partial', {
        props: ['sorting'],
      }),
      f('filters', /\bfilters\s*:\s*\[|\bonFilter\s*:/, 'maps', {
        column: ['filter', 'filterOptions', 'filterFn'],
      }),
      f('filter-dropdown', /\bfilterDropdown\s*:/, 'partial', {
        addons: ['@argus-table/header-menu'],
      }),
      f('fixed', /\bfixed\s*:\s*(?:['"](?:left|right)['"]|true)/, 'maps', { column: ['pin'] }),
      f('selection', /\browSelection\s*=|\bselectedRowKeys\b/, 'maps', {
        props: ['selectionMode', 'selectionCheckboxes', 'selection'],
      }),
      f('row-key', /\browKey\s*=/, 'maps', { props: ['getRowId'] }),
      f('pagination', /\bpagination\s*=\s*\{(?!\s*false)/, 'gap', {}, { gap: 'pagination' }),
      f('server', /\bonChange\s*=\s*\{[^}]*\b(?:sorter|filters|pagination)\b|\btotal\s*:/, 'maps', {
        props: ['dataSource'],
      }),
      f('scroll-y', /\bscroll\s*=\s*\{\{[^}]*\by\s*:/, 'maps'),
      f('virtual', /<Table\b[^>]*\bvirtual\b/, 'builtin'),
      f(
        'expandable',
        /\bexpandable\s*=|\bexpandedRowRender\b/,
        'gap',
        {},
        { gap: 'master-detail' },
      ),
      f('summary', /\bsummary\s*=/, 'partial', { props: ['pinnedRows'] }),
      f('children', /\bchildren\s*:\s*\[\s*\{[^}]*\bdataIndex\b/, 'maps', {
        props: ['columnGroups'],
      }),
      f('tree-data', /\bchildrenColumnName\b|\bindentSize\b/, 'gap', {}, { gap: 'tree-data' }),
      f(
        'editable',
        /\bEditableCell\b|\bcomponents\s*=\s*\{\{\s*body/,
        'gap',
        {},
        { gap: 'editing' },
      ),
      f('locale', /<Table\b[^>]*\blocale\s*=/, 'maps', { props: ['labels'] }),
      f('row-click', /\bonRow\s*=/, 'maps', { events: ['argus-row-click'] }),
    ],
  },
  {
    id: 'element-plus',
    name: 'Element Plus el-table',
    reference: 'migrate/element-plus.md',
    deps: ['element-plus'],
    gate: /<el-table|<ElTable/,
    anchors: [/<el-table(?:-v2)?\b(?!-column)/, /<ElTable(?:V2)?\b(?!Column)/],
    vocabulary: /<el-table-column\b|<ElTableColumn\b/,
    columnKey:
      /<(?:el-table-column|ElTableColumn)\b(?![^>]*\btype\s*=\s*['"](?:selection|index|expand)['"])/g,
    sortsByDefault: false,
    features: [
      f('columns', /\bprop\s*=|\blabel\s*=|\bmin-width\s*=/, 'maps', {
        column: ['accessor', 'header', 'minWidth'],
      }),
      f('sortable', /\bsortable\b(?!\s*=\s*['"]custom)/, 'maps', { column: ['sortable'] }),
      f('server-sort', /\bsortable\s*=\s*['"]custom['"]|@sort-change\b/, 'maps', {
        props: ['dataSource', 'sorting'],
      }),
      f('fixed', /\bfixed(?:\s*=\s*['"](?:left|right)['"])?/, 'maps', { column: ['pin'] }),
      f('selection', /\btype\s*=\s*['"]selection['"]|@selection-change\b/, 'maps', {
        props: ['selectionMode', 'selectionCheckboxes', 'selection'],
      }),
      f('row-key', /\brow-key\s*=/, 'maps', { props: ['getRowId'] }),
      f('current-row', /\bhighlight-current-row\b/, 'maps', { props: ['selectionMode'] }),
      f('index', /\btype\s*=\s*['"]index['"]/, 'partial', { column: ['cell'] }),
      f('expand', /\btype\s*=\s*['"]expand['"]/, 'gap', {}, { gap: 'master-detail' }),
      f('filters', /:filters\b|:filter-method\b/, 'maps', {
        column: ['filter', 'filterOptions', 'filterFn'],
      }),
      f('summary', /\bshow-summary\b|\bsummary-method\b/, 'partial', { props: ['pinnedRows'] }),
      f('span', /\bspan-method\b/, 'gap', {}, { gap: 'cell-spanning' }),
      f('tree', /\btree-props\b|:load\b/, 'gap', {}, { gap: 'tree-data' }),
      f('height', /<el-table\b[^>]*\b(?:max-)?height\s*=/, 'maps'),
      f('stripe-border', /\bstripe\b|\bborder\b/, 'maps'),
      f('slots', /#default\s*=\s*['"]\s*(?:scope|\{)/, 'maps', { column: ['cell'] }),
      f('pagination', /<el-pagination\b/, 'gap', {}, { gap: 'pagination' }),
      f('row-click', /@row-click\b/, 'maps', { events: ['argus-row-click'] }),
    ],
  },
  {
    id: 'html-table',
    name: 'plain <table>',
    reference: 'migrate/html-table.md',
    deps: [],
    gate: /<table\b/i,
    anchors: [/<table\b/i],
    vocabulary: /<th\b/,
    columnKey: /<th\b/g,
    sortsByDefault: false,
    features: [
      f(
        'sorting',
        /\.sort\s*\([\s\S]{0,400}<th\b|<th\b[^>]*(?:onClick|@click|\(click\)|on:click|onclick)\s*=/,
        'maps',
        {
          column: ['sortable'],
          props: ['sorting'],
        },
      ),
      f('search', /\.filter\s*\(.{0,120}?\b(?:search|query|term|keyword)\w*/i, 'partial', {
        props: ['quickFilter'],
      }),
      f('selection', /<td\b[^>]*>\s*<input\b[^>]*type\s*=\s*['"]checkbox['"]/, 'maps', {
        props: ['selectionMode', 'selectionCheckboxes', 'selection'],
      }),
      f('sticky', /position\s*:\s*sticky/, 'builtin'),
      f('pagination', /\.slice\s*\([^)]*\b(?:page|offset)\w*/i, 'gap', {}, { gap: 'pagination' }),
      f('tfoot', /<tfoot\b/, 'partial', { props: ['pinnedRows'] }),
      f('header-spans', /<th\b[^>]*\bcolspan\s*=/, 'maps', { props: ['columnGroups'] }),
      f('body-spans', /<td\b[^>]*\b(?:colspan|rowspan)\s*=/, 'gap', {}, { gap: 'cell-spanning' }),
      f(
        'editing',
        /<td\b[^>]*\bcontenteditable\b|<td\b[^>]*>\s*<(?:input|select|textarea)\b(?![^>]*type\s*=\s*['"]checkbox)/,
        'gap',
        {},
        { gap: 'editing' },
      ),
      f('row-click', /<tr\b[^>]*(?:onClick|@click|\(click\)|on:click|onclick)\s*=/, 'maps', {
        events: ['argus-row-click'],
      }),
    ],
  },
];

/** Gap sections in references/gaps.md. */
export const GAPS = [
  'pagination',
  'editing',
  'row-grouping',
  'tree-data',
  'master-detail',
  'range-selection',
  'row-drag',
  'context-menu',
  'tool-panels',
  'cell-spanning',
  'filter-row',
  'viewport',
];

/** Gaps that usually decide whether a screen can move (shown first, and make the effort `high`). */
export const HARD_GAPS = [
  'editing',
  'row-grouping',
  'tree-data',
  'master-detail',
  'range-selection',
];

/** A feature's argus-table equivalent as one line, for the scan's output. */
export function describeArgus(argus) {
  const parts = [];
  if (argus.column?.length) parts.push(argus.column.map((c) => `ColumnDef.${c}`).join(', '));
  if (argus.props?.length) parts.push(argus.props.join(', '));
  if (argus.events?.length) parts.push(argus.events.join(', '));
  if (argus.methods?.length) parts.push(argus.methods.map((m) => `${m}()`).join(', '));
  if (argus.addons?.length) parts.push(argus.addons.join(', '));
  return parts.length ? parts.join('; ') : null;
}
