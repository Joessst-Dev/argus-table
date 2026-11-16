// Shared by the column-reorder examples' four flavours: the rows, and the key
// the saved order goes under.
export interface Task {
  id: number;
  title: string;
  owner: string;
  status: string;
  estimate: number;
}

const owners = ['Ada', 'Grace', 'Linus', 'Barbara', 'Ken'];
const statuses = ['Open', 'In progress', 'Review', 'Done'];

export const tasks: Task[] = Array.from({ length: 200 }, (_, i) => ({
  id: i + 1,
  title: `Task ${String(i + 1)}`,
  owner: owners[i % owners.length] ?? '',
  status: statuses[i % statuses.length] ?? '',
  estimate: (i * 7) % 40,
}));

export const STORAGE_KEY = 'argus-docs:task-order';
