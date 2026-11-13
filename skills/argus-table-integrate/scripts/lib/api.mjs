// What the scripts know about argus-table's public API: packages, the
// element's properties, events and methods, column fields, add-ons and
// themes. skills/test/integrate-sync.test.mjs keeps this in step with the
// Custom Elements Manifest, the core types, the wrappers and the themes.

/** The lowest release this skill's references are written for. */
export const MIN_VERSION = '1.1.0';

/** Every published package, released together at one version (changesets `fixed`). */
export const PACKAGES = [
  'argus-table',
  '@argus-table/react',
  '@argus-table/vue',
  '@argus-table/angular',
  '@argus-table/header-menu',
  '@argus-table/formulas',
  '@argus-table/export',
  '@argus-table/themes',
];

/** The framework wrapper per framework. They depend on `argus-table`. */
export const WRAPPERS = {
  react: '@argus-table/react',
  vue: '@argus-table/vue',
  angular: '@argus-table/angular',
};

/** What each wrapper needs from the app (its peer dependencies). */
export const FRAMEWORK_PEERS = {
  react: { package: 'react', range: '^18.3.0 || ^19.0.0', min: '18.3.0', below: '20.0.0' },
  vue: { package: 'vue', range: '^3.5.0', min: '3.5.0', below: '4.0.0' },
  angular: {
    package: '@angular/core',
    range: '^20.0.0 || ^21.0.0 || ^22.0.0',
    min: '20.0.0',
    below: '23.0.0',
  },
};

/** The add-ons: plugins for `plugins`, with their factory, options and peers. */
export const ADDONS = {
  '@argus-table/export': {
    factory: 'tableExport',
    exports: ['tableExport', 'exportTable', 'downloadTable'],
    options: [
      'formats',
      'menu',
      'filename',
      'labels',
      'rows',
      'pinnedRows',
      'hiddenColumns',
      'headerGroups',
      'allRows',
      'columns',
      'delimiter',
      'bom',
      'escapeFormulas',
      'sheetName',
      'pageSize',
      'orientation',
      'title',
      'signal',
    ],
    peers: ['argus-table'],
  },
  '@argus-table/formulas': {
    factory: 'formulas',
    exports: ['formulas'],
    options: ['functions', 'marker', 'editing', 'labels'],
    peers: ['argus-table', 'lit'],
  },
  '@argus-table/header-menu': {
    factory: 'headerMenu',
    exports: ['headerMenu'],
    options: ['sort', 'fitWidth', 'pin', 'hide', 'filter', 'labels'],
    peers: ['argus-table', 'lit'],
  },
};

/** The order add-ons must have in `plugins`, when several are used. */
export const PLUGIN_ORDER = ['tableExport', 'formulas', 'headerMenu'];

/** Theme files: `@argus-table/themes/<name>.css`. */
export const THEMES = ['default', 'material', 'fluent', 'bootstrap', 'minimal'];

/**
 * The element's public properties, with their attribute if they have one.
 * Properties without an attribute hold objects or functions: set them as
 * properties (wrappers do that for you).
 */
export const PROPERTIES = {
  columns: null,
  columnGroups: null,
  data: null,
  dataSource: null,
  pinnedRows: null,
  getRowId: null,
  rowHeight: 'row-height',
  density: 'density',
  overscan: 'overscan',
  virtualizeColumns: 'virtualize-columns',
  sorting: null,
  columnSizing: null,
  columnOrder: null,
  columnPinning: null,
  columnVisibility: null,
  columnFilters: null,
  quickFilter: 'quick-filter',
  selectionMode: 'selection-mode',
  selectionCheckboxes: 'selection-checkboxes',
  selection: null,
  plugins: null,
  labels: null,
};

/** Set by the wrappers; never by apps. */
export const INTERNAL_PROPERTIES = ['contentRenderer'];

/** State the user changes, two-way: uncontrolled until set, then only proposed through `argus-<kebab>-change`. */
export const CONTROLLABLES = [
  'sorting',
  'columnSizing',
  'columnOrder',
  'columnPinning',
  'columnVisibility',
  'columnFilters',
  'selection',
];

/** The element's events. */
export const EVENTS = [
  'argus-sorting-change',
  'argus-column-sizing-change',
  'argus-column-resize-end',
  'argus-column-order-change',
  'argus-column-pinning-change',
  'argus-column-visibility-change',
  'argus-column-filters-change',
  'argus-selection-change',
  'argus-cell-click',
  'argus-row-click',
  'argus-range-change',
  'argus-load-error',
];

/** Events add-ons fire on the table (the formula editor's). */
export const ADDON_EVENTS = [
  'argus-formula-column-add',
  'argus-formula-column-change',
  'argus-formula-column-remove',
];

/** Event names from before 0.4 (ADR 0004), with their replacement. */
export const RENAMED_EVENTS = {
  'argus-sort-change': 'argus-sorting-change',
  'argus-column-resize': 'argus-column-sizing-change',
  'argus-column-reorder': 'argus-column-order-change',
  'argus-column-pin': 'argus-column-pinning-change',
  'argus-column-hide': 'argus-column-visibility-change',
  'argus-column-filter': 'argus-column-filters-change',
  'argus-row-select': 'argus-selection-change',
};

/** The element's public methods. */
export const METHODS = [
  'refresh',
  'autosizeColumns',
  'scrollToRow',
  'scrollToColumn',
  'getState',
  'setState',
];

/** Fields of a `ColumnDef`. */
export const COLUMN_FIELDS = [
  'id',
  'header',
  'accessor',
  'formula',
  'cell',
  'width',
  'minWidth',
  'maxWidth',
  'pin',
  'hidden',
  'sortable',
  'resizable',
  'reorderable',
  'pinnable',
  'hideable',
  'filter',
  'filterFn',
  'filterOptions',
  'align',
  'wrap',
];

/** Fields of a `ColumnGroup`. */
export const COLUMN_GROUP_FIELDS = ['id', 'header', 'reorderable', 'columns'];

/** Attributes of `<argus-column>` (`cell`, `filterFn`, `filterOptions` are properties only). */
export const COLUMN_ATTRIBUTES = [
  'column-id',
  'header',
  'accessor',
  'formula',
  'width',
  'min-width',
  'max-width',
  'pin',
  'pinnable',
  'hideable',
  'align',
  'wrap',
  'sortable',
  'resizable',
  'reorderable',
  'filter',
  'hidden',
];

/** Attributes of `<argus-column-group>`. */
export const COLUMN_GROUP_ATTRIBUTES = ['group-id', 'header', 'reorderable'];

/**
 * Field names other grids use, and what they are in a `ColumnDef`.
 * `check.mjs` suggests these for unknown column fields.
 */
export const COLUMN_FIELD_RENAMES = {
  field: 'accessor',
  accessorKey: 'accessor',
  accessorFn: 'accessor (a function)',
  dataIndex: 'accessor',
  dataKey: 'accessor',
  prop: 'accessor',
  key: 'id (and accessor)',
  value: 'accessor',
  valueGetter: 'accessor (a function)',
  headerName: 'header',
  title: 'header',
  label: 'header',
  name: 'header',
  Header: 'header',
  Cell: 'cell',
  render: 'cell',
  renderCell: 'cell',
  cellRenderer: 'cell',
  valueFormatter: 'cell',
  formatter: 'cell',
  pinned: "pin ('start' or 'end')",
  fixed: "pin ('start' or 'end')",
  frozen: "pin ('start' or 'end')",
  sticky: "pin: 'start'",
  stickyEnd: "pin: 'end'",
  flex: 'width: { flex }',
  size: 'width',
  minSize: 'minWidth',
  maxSize: 'maxWidth',
  hide: 'hidden',
  enableSorting: 'sortable',
  sorter: 'sortable (and the sorting property)',
  enableResizing: 'resizable',
  enableHiding: 'hideable',
  enablePinning: 'pinnable',
  enableColumnFilter: 'filter',
  filterVariant: 'filter',
  type: 'filter and align',
  headerAlign: 'align',
  textAlign: 'align',
  wrapText: 'wrap',
  autoHeight: "wrap, with the table's rowHeight: 'auto'",
  children: 'columnGroups (a separate property)',
  columns: 'columnGroups (a separate property)',
};

/** Features added after 1.0, and how to spot them in code. */
export const SINCE = [
  {
    feature: 'labels',
    version: '1.1.0',
    patterns: [/\blabels\s*[=:]\s*[{[]/, /\[labels\]|:labels\b/],
  },
  { feature: 'scrollToColumn()', version: '1.1.0', patterns: [/\.scrollToColumn\s*\(/] },
  {
    feature: 'scrollToRow() with options or a row id',
    version: '1.1.0',
    patterns: [/\.scrollToRow\s*\(\s*\{/, /\.scrollToRow\s*\([^()]*,\s*\{/],
  },
  {
    feature: 'the resize-end event',
    version: '1.1.0',
    patterns: [/argus-column-resize-end|onColumnResizeEnd|@column-resize-end|\(columnResizeEnd\)/],
  },
  { feature: '@argus-table/export', version: '1.1.0', patterns: [/@argus-table\/export\b/] },
  {
    feature: "headerMenu()'s sort and fitWidth options",
    version: '1.1.0',
    patterns: [/headerMenu\s*(?:<[^>]*>)?\s*\(\s*\{[^}]*\b(?:sort|fitWidth)\s*:/],
  },
  {
    feature: 'formula events on the wrappers',
    version: '1.1.0',
    patterns: [
      /onFormulaColumn(?:Add|Change|Remove)|@formula-column-|\(formulaColumn(?:Add|Change|Remove)\)/,
    ],
  },
];

/** `argus-sorting-change` → `sorting-change`. */
export const bare = (event) => event.replace(/^argus-/, '');

/** `column-sizing` → `columnSizing`. */
export const camel = (kebab) => kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** `columnSizing` → `column-sizing`. */
export const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** How each wrapper binds an element event. */
export function eventBindings(event) {
  const name = camel(bare(event));
  return {
    react: `on${name[0].toUpperCase()}${name.slice(1)}`,
    vue: bare(event),
    angular: name,
  };
}

/** How each wrapper binds a controllable property two-way. */
export function twoWayBindings(property) {
  return {
    react: { value: property, handler: eventBindings(`argus-${kebab(property)}-change`).react },
    vue: {
      model: `v-model:${property}`,
      update: `update:${property}`,
      event: `${kebab(property)}-change`,
    },
    angular: { banana: `[(${property})]`, output: `${property}Change` },
    element: { event: `argus-${kebab(property)}-change` },
  };
}

/** Wrapper component names, by framework. */
export const COMPONENTS = {
  react: ['ArgusTable', 'ArgusColumn', 'ArgusColumnGroup'],
  vue: ['ArgusTable', 'ArgusColumn', 'ArgusColumnGroup'],
  angular: [
    'ARGUS_TABLE',
    'ArgusTableComponent',
    'ArgusColumnComponent',
    'ArgusColumnGroupComponent',
    'ArgusCellDirective',
    'ArgusHeaderDirective',
    'ArgusGroupHeaderDirective',
  ],
};

/** Semver-ish compare of `x.y.z` (pre-release tags sort before the release). */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++)
    if (pa.nums[i] !== pb.nums[i]) return pa.nums[i] < pb.nums[i] ? -1 : 1;
  if (pa.pre === pb.pre) return 0;
  if (!pa.pre) return 1;
  if (!pb.pre) return -1;
  return pa.pre < pb.pre ? -1 : 1;
}

/** `^1.2.3`, `v1.2`, `1.2.3-rc.1` → `{ nums: [1, 2, 3], pre }`; `undefined` if there is no version. */
export function parseVersion(text) {
  const m = /(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?(?:-([\w.]+))?/.exec(String(text ?? ''));
  if (!m) return undefined;
  const num = (s) => (s === undefined || s === 'x' || s === '*' ? 0 : Number(s));
  return { nums: [num(m[1]), num(m[2]), num(m[3])], pre: m[4] ?? '' };
}

/** The lowest version a range allows (`^1.2.0` → `1.2.0`, `~1.2` → `1.2.0`); `undefined` for tags and links. */
export function minVersion(range) {
  if (!range || /^(?:workspace|link|file|portal|git|github|https?):|^[a-z]+$/i.test(range)) {
    return undefined;
  }
  const parsed = parseVersion(range.split('||')[0]);
  return parsed ? parsed.nums.join('.') + (parsed.pre ? `-${parsed.pre}` : '') : undefined;
}
