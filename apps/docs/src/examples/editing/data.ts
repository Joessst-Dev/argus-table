// Shared by the editing examples' four flavours: orders to edit, and tasks
// for the other editors.
export interface Order {
  id: string;
  customer: string;
  status: string;
  total: number;
}

const statuses = ['open', 'paid', 'shipped'];

export const orders: Order[] = Array.from({ length: 200 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  status: statuses[i % statuses.length] ?? 'open',
  total: Math.round(((i * 7919) % 100_000) / 10) / 10,
}));

/** A message for a total below zero, or nothing. */
export const validateTotal = (value: unknown) =>
  value === null || (typeof value === 'number' && value < 0)
    ? 'Enter an amount of 0 or more'
    : undefined;

export interface Task {
  id: string;
  title: string;
  due: Date | null;
  done: boolean;
  priority: 1 | 2 | 3;
}

export const tasks: Task[] = Array.from({ length: 30 }, (_, i) => ({
  id: `t${String(i + 1)}`,
  title: `Task ${String(i + 1)}`,
  due: i % 4 === 3 ? null : new Date(2026, 10, 16 + i),
  done: i % 3 === 0,
  priority: ((i % 3) + 1) as 1 | 2 | 3,
}));

export const priorities = [1, 2, 3] as const;
