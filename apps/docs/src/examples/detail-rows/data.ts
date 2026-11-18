// Shared by the detail rows examples' four flavours: orders, and each order's lines.
export interface Order {
  id: string;
  customer: string;
  city: string;
  status: string;
  total: number;
}

export interface Line {
  id: string;
  product: string;
  quantity: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];
const statuses = ['open', 'paid', 'shipped'];

export const orders: Order[] = Array.from({ length: 200 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  city: cities[i % cities.length] ?? '',
  status: statuses[i % statuses.length] ?? 'open',
  total: Math.round(((i * 7919) % 100_000) / 10) / 10,
}));

export const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'status', header: 'Status', accessor: 'status', width: 110 },
  { id: 'total', header: 'Total', accessor: 'total', width: 100, align: 'end' as const },
];

const lines = new Map<string, Line[]>();

/**
 * An order's lines: 3 to 32 of them. The same array for an order each time, so a
 * panel that renders again doesn't hand its nested table new data.
 */
export function linesOf(order: Order): Line[] {
  let list = lines.get(order.id);
  if (!list) {
    list = Array.from({ length: 3 + (Number(order.id.slice(1)) % 30) }, (_, i) => ({
      id: String(i + 1),
      product: `Product ${String.fromCharCode(65 + (i % 26))}`,
      quantity: (i % 5) + 1,
    }));
    lines.set(order.id, list);
  }
  return list;
}

export const lineColumns = [
  { id: 'id', header: 'Line', accessor: 'id', width: 70 },
  { id: 'product', header: 'Product', accessor: 'product', width: { flex: 1 }, sortable: true },
  { id: 'quantity', header: 'Qty', accessor: 'quantity', width: 70, align: 'end' as const },
];

/** Rows are kept open by id: the panels need getRowId. */
export const idOf = (order: Order) => order.id;
