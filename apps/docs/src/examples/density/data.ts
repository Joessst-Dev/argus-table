// Shared by the density example's four flavours.
export interface Order {
  id: string;
  customer: string;
  total: number;
}

export const orders: Order[] = Array.from({ length: 20 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  total: Math.round(((i * 7919) % 100000) / 10) / 10,
}));

export const densities = ['compact', 'comfortable', 'spacious'] as const;
