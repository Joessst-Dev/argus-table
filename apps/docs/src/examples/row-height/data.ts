// Shared by the row-height examples' four flavours: orders with notes of very
// different lengths, and a totals row.
export interface Order {
  id: string;
  city: string;
  status: string;
  total: number;
  note: string;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];
const statuses = ['open', 'paid', 'shipped'];
const notes = [
  'Leave at the door.',
  'Fragile: glassware inside. Please keep upright and call the customer before delivery.',
  'Gift wrap, no invoice in the parcel.',
  'Customer asked to combine this order with the next one from the same address, if it ships within the week.',
];

export const orders: Order[] = Array.from({ length: 200 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  city: cities[i % cities.length] ?? '',
  status: statuses[i % statuses.length] ?? '',
  total: Math.round(((i * 7919) % 100000) / 10) / 10,
  note: notes[i % notes.length] ?? '',
}));

/** A row pinned below the body: the sum of every order. */
export const totals: Order = {
  id: 'total',
  city: '',
  status: '',
  total: Math.round(orders.reduce((sum, o) => sum + o.total, 0) * 10) / 10,
  note: 'Total of all orders, before discounts and shipping, in the currency of the order.',
};

/** The height of an order's bar, in px: 16 to 75, following its total. */
export const barHeight = (order: Order) => 16 + Math.round(order.total % 60);
