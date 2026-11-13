import type { RangeFilterOp, TextFilterOp } from 'argus-table';

/**
 * The column menu's built-in text: its items, the filter form and its
 * announcements. Set any of them through `headerMenu({ labels })`; the rest stay
 * English. Text with values in it is a function of an object, so it can put them
 * in any order and pick a plural form (`Intl.PluralRules`). Numbers come
 * unformatted. `column` is the column's text header, or its id.
 */
export interface HeaderMenuLabels {
  /** Accessible name of the button in each header. Default: `Column menu`. */
  columnMenu: string;
  /** Default: `Sort ascending`. */
  sortAscending: string;
  /** Default: `Sort descending`. */
  sortDescending: string;
  /** Clears the column's sort. Default: `Unsorted`. */
  unsorted: string;
  /** Default: `Pin to start`. */
  pinStart: string;
  /** Default: `Pin to end`. */
  pinEnd: string;
  /** Default: `Don't pin`. */
  unpin: string;
  /** Opens the filter form. Default: `Filter…`. */
  filter: string;
  /** Default: `Clear filter`. */
  clearFilter: string;
  /** Default: `Fit width`. */
  fitWidth: string;
  /** Default: `Hide column`. */
  hideColumn: string;
  /** Heading of the group that shows hidden columns again. Default: `Hidden columns`. */
  hiddenColumns: string;
  /** Shows one hidden column. Default: `Show Price`. */
  showColumn: (item: { column: string }) => string;
  /** Shows every hidden column. Default: `Show all`. */
  showAll: string;

  /** Announced when a column is pinned or unpinned. Default: `Price pinned to the start`, `Price unpinned`. */
  pinned: (change: { column: string; pin: 'start' | 'end' | false }) => string;
  /** Announced when a column is hidden. Default: `Price hidden`. */
  columnHidden: (change: { column: string }) => string;
  /** Announced when one hidden column is shown again. Default: `Price shown`. */
  columnShown: (change: { column: string }) => string;
  /** Announced when several hidden columns are shown again (Show all). Default: `3 columns shown`. */
  columnsShown: (change: { count: number }) => string;
  /** Announced when Fit width changed a column's width, in px. Default: `Price fitted to 96 px`. */
  columnFitted: (change: { column: string; width: number }) => string;

  /** Accessible name of the filter form. Default: `Filter Price`. */
  filterDialog: (form: { column: string }) => string;
  /** Label of the operator list. Default: `Condition`. */
  condition: string;
  /** The operators of a text filter. */
  textOperators: Record<TextFilterOp, string>;
  /** The operators of a number filter. */
  numberOperators: Record<RangeFilterOp, string>;
  /** The operators of a date filter. */
  dateOperators: Record<RangeFilterOp, string>;
  /** Label of the value field. Default: `Value`. */
  value: string;
  /** Labels of the two fields of `between`. Default: `From`. */
  from: string;
  /** Default: `To`. */
  to: string;
  /** Label of a set filter's search field. Default: `Search values`. */
  searchValues: string;
  /** Checks every value of a set filter. Default: `Select all`. */
  selectAll: string;
  /** Checks every value the search shows. Default: `Select all shown`. */
  selectAllShown: string;
  /** Accessible name of a set filter's list of values. Default: `Values`. */
  values: string;
  /** Shown for the empty value (`null`) in a set filter's list. Default: `(Empty)`. */
  emptyValue: string;
  /** Shown when the search leaves no values. Default: `No values`. */
  noValues: string;
  /** Shown when a set filter lists only the first values. Default: `Showing the first 1000 values`. */
  valuesLimited: (list: { count: number }) => string;
  /** Default: `Clear`. */
  clear: string;
  /** Default: `Done`. */
  done: string;
}

/** What `headerMenu({ labels })` takes: any of the labels, and any of each operator list. */
export type HeaderMenuLabelsInput = Partial<
  Omit<HeaderMenuLabels, 'textOperators' | 'numberOperators' | 'dateOperators'>
> & {
  textOperators?: Partial<Record<TextFilterOp, string>> | undefined;
  numberOperators?: Partial<Record<RangeFilterOp, string>> | undefined;
  dateOperators?: Partial<Record<RangeFilterOp, string>> | undefined;
};

const PINNED = { start: 'pinned to the start', end: 'pinned to the end' };

const DEFAULT_LABELS: HeaderMenuLabels = {
  columnMenu: 'Column menu',
  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
  unsorted: 'Unsorted',
  pinStart: 'Pin to start',
  pinEnd: 'Pin to end',
  unpin: "Don't pin",
  filter: 'Filter…',
  clearFilter: 'Clear filter',
  fitWidth: 'Fit width',
  hideColumn: 'Hide column',
  hiddenColumns: 'Hidden columns',
  showColumn: ({ column }) => `Show ${column}`,
  showAll: 'Show all',
  pinned: ({ column, pin }) => `${column} ${pin ? PINNED[pin] : 'unpinned'}`,
  columnHidden: ({ column }) => `${column} hidden`,
  columnShown: ({ column }) => `${column} shown`,
  columnsShown: ({ count }) => `${String(count)} columns shown`,
  columnFitted: ({ column, width }) => `${column} fitted to ${String(width)} px`,
  filterDialog: ({ column }) => `Filter ${column}`,
  condition: 'Condition',
  textOperators: {
    contains: 'Contains',
    equals: 'Equals',
    startsWith: 'Starts with',
    empty: 'Is empty',
    notEmpty: 'Is not empty',
  },
  numberOperators: {
    eq: 'Equals',
    ne: 'Does not equal',
    gt: 'Greater than',
    ge: 'At least',
    lt: 'Less than',
    le: 'At most',
    between: 'Between',
    empty: 'Is empty',
    notEmpty: 'Is not empty',
  },
  dateOperators: {
    eq: 'On',
    ne: 'Not on',
    gt: 'After',
    ge: 'On or after',
    lt: 'Before',
    le: 'On or before',
    between: 'Between',
    empty: 'Is empty',
    notEmpty: 'Is not empty',
  },
  value: 'Value',
  from: 'From',
  to: 'To',
  searchValues: 'Search values',
  selectAll: 'Select all',
  selectAllShown: 'Select all shown',
  values: 'Values',
  emptyValue: '(Empty)',
  noValues: 'No values',
  valuesLimited: ({ count }) => `Showing the first ${String(count)} values`,
  clear: 'Clear',
  done: 'Done',
};

/** The entries of a record that are set: `undefined` and `null` keep the default. */
const setOnly = <R extends object>(record: R | undefined): Partial<R> =>
  Object.fromEntries(Object.entries(record ?? {}).filter(([, v]) => v != null)) as Partial<R>;

/** The labels in effect: the ones given, over the English defaults. */
export function resolveLabels(labels: HeaderMenuLabelsInput | undefined): HeaderMenuLabels {
  const given = setOnly(labels);
  return {
    ...DEFAULT_LABELS,
    ...(given as Partial<HeaderMenuLabels>),
    textOperators: { ...DEFAULT_LABELS.textOperators, ...setOnly(labels?.textOperators) },
    numberOperators: { ...DEFAULT_LABELS.numberOperators, ...setOnly(labels?.numberOperators) },
    dateOperators: { ...DEFAULT_LABELS.dateOperators, ...setOnly(labels?.dateOperators) },
  };
}
