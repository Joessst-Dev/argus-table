// Shared by the pinned-columns example's four flavours: a row per item with a
// value per month, and the month columns.
export interface Item {
  id: number;
  name: string;
  values: number[];
}

export const items: Item[] = Array.from({ length: 200 }, (_, i) => ({
  id: i + 1,
  name: `Item ${String(i + 1)}`,
  values: Array.from({ length: 12 }, (_, j) => (i * 31 + j * 17) % 1000),
}));

/** Twelve scrolling columns, between the pinned ones. */
export const months = Array.from({ length: 12 }, (_, j) => ({
  id: `m${String(j + 1)}`,
  header: `Month ${String(j + 1)}`,
  accessor: (item: Item) => item.values[j],
  width: 110,
  align: 'end' as const,
}));

/** `--argus-pinned-shadow` values to choose from. */
export const shadows = {
  Theme: '',
  None: 'none',
  Strong: '8px 0 10px -6px rgb(0 0 0 / 0.5)',
};
