// Shared by the scrolling example's four flavours: 100,000 orders, and columns
// wider than the view (twenty months between the pinned ones).
export interface Order {
  id: string;
  customer: string;
  total: number;
}

export const orders: Order[] = Array.from({ length: 100_000 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  total: Math.round(((i * 7919) % 100_000) / 10) / 10,
}));

export const months = Array.from({ length: 20 }, (_, i) => ({
  id: `m${String(i + 1)}`,
  header: `Month ${String(i + 1)}`,
  accessor: (order: Order) => Math.round(order.total * (1 + i / 10)),
  width: 110,
  align: 'end' as const,
}));

/** Where a scroll target lands. */
export const aligns = ['start', 'center', 'end', 'nearest'] as const;

/** Line items for the fit-to-content example: a table that grows with its rows. */
export interface Item {
  id: string;
  product: string;
  quantity: number;
}

export const itemColumns = [
  { id: 'id', header: 'Line', accessor: 'id', width: 80 },
  { id: 'product', header: 'Product', accessor: 'product', width: { flex: 1 } },
  { id: 'quantity', header: 'Qty', accessor: 'quantity', width: 80, align: 'end' as const },
];

export const items = (count: number): Item[] =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    product: `Product ${String.fromCharCode(65 + (i % 26))}`,
    quantity: (i % 5) + 1,
  }));
