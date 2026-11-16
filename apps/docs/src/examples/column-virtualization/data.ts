// Shared by the column-virtualization example's four flavours: 10,000 rows and
// 500 computed columns between the pinned ones.
export interface Item {
  id: number;
  name: string;
}

export const items: Item[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: i + 1,
  name: `Item ${String(i + 1)}`,
}));

export const valueColumns = Array.from({ length: 500 }, (_, j) => ({
  id: `c${String(j + 1)}`,
  header: `Col ${String(j + 1)}`,
  // Computed per cell: nothing is stored for the 5M cells.
  accessor: (item: Item) => (item.id * 31 + j * 17) % 1000,
  width: 90,
  align: 'end' as const,
}));
