/** A file format the plugin writes. */
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

/**
 * The export's built-in text: its column menu items, the PDF's page footer and
 * its announcements. Set any of them through `tableExport({ labels })`; the rest
 * stay English. Text with values in it is a function of an object, so it can put
 * them in any order and pick a plural form (`Intl.PluralRules`). Numbers come
 * unformatted.
 */
export interface ExportLabels {
  /** Heading of the export items in the column menu. Default: `Export`. */
  group: string;
  /** Default: `CSV`. */
  csv: string;
  /** Default: `Excel (.xlsx)`. */
  xlsx: string;
  /** Default: `PDF`. */
  pdf: string;
  /**
   * Heading of the column menu's second export group, which includes each row's
   * detail rows (shown when `tableExport()` has a `detail`). Default: `Export with details`.
   */
  withDetails: string;
  /** Footer of each PDF page. Default: `Page 2 of 5`. */
  page: (item: { page: number; pages: number }) => string;
  /** Announced when a download starts. Default: `Exported 120 rows`, `Exported 1 row`. */
  exported: (item: { rows: number; format: ExportFormat }) => string;
  /** Announced when an export from the column menu fails. Default: `Export failed`. */
  failed: string;
  /** A group row's first cell (`grouping`): its value and number of rows. Default: `EU (12)`. */
  groupRow: (group: { value: string; count: number }) => string;
  /** The value of the group of rows with an empty value. Default: `(empty)`. */
  emptyGroup: string;
}

const DEFAULT_LABELS: ExportLabels = {
  group: 'Export',
  csv: 'CSV',
  xlsx: 'Excel (.xlsx)',
  pdf: 'PDF',
  withDetails: 'Export with details',
  page: ({ page, pages }) => `Page ${String(page)} of ${String(pages)}`,
  exported: ({ rows }) => `Exported ${String(rows)} ${rows === 1 ? 'row' : 'rows'}`,
  failed: 'Export failed',
  groupRow: ({ value, count }) => `${value} (${String(count)})`,
  emptyGroup: '(empty)',
};

/** The labels given, over the English defaults. */
export function resolveLabels(labels: Partial<ExportLabels> | undefined): ExportLabels {
  return { ...DEFAULT_LABELS, ...labels };
}
