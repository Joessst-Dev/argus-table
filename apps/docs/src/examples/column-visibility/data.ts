// Shared by the column-visibility examples' four flavours: the rows.
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

/** The pin choices of the controls: `false` unpins a column pinned by its definition. */
export type PinChoice = 'none' | 'start' | 'end';
export const pinOf = (choice: PinChoice) => (choice === 'none' ? false : choice);
