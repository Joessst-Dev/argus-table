// Shared by the resizing examples' four flavours: the rows.
export interface Task {
  id: number;
  title: string;
  owner: string;
  estimate: number;
}

const owners = ['Ada', 'Grace', 'Linus', 'Barbara', 'Ken'];

export const tasks: Task[] = Array.from({ length: 200 }, (_, i) => ({
  id: i + 1,
  title: `Task ${String(i + 1)}: ${['Plan', 'Build', 'Review', 'Ship'][i % 4] ?? ''} the thing`,
  owner: owners[i % owners.length] ?? '',
  estimate: (i * 7) % 40,
}));
