// Shared by the tree rows examples' four flavours: a project's files (nested
// data) and a company's people (flat data, each naming their manager).

/** A file, or a folder with the entries in it. */
export interface Entry {
  name: string;
  type: string;
  size: number;
  children?: Entry[];
}

const file = (name: string, type: string, size: number): Entry => ({ name, type, size });
/** A folder is as large as what it holds. */
const folder = (name: string, children: Entry[]): Entry => ({
  name,
  type: 'Folder',
  size: children.reduce((sum, child) => sum + child.size, 0),
  children,
});

export const files: Entry[] = [
  folder('src', [
    folder('components', [
      file('Button.tsx', 'TypeScript', 2_340),
      file('Table.tsx', 'TypeScript', 8_912),
      file('Toolbar.tsx', 'TypeScript', 1_208),
    ]),
    folder('lib', [file('api.ts', 'TypeScript', 3_105), file('format.ts', 'TypeScript', 640)]),
    file('main.ts', 'TypeScript', 412),
    file('styles.css', 'CSS', 5_870),
  ]),
  folder('public', [
    file('favicon.svg', 'SVG image', 1_024),
    file('logo.png', 'PNG image', 24_576),
  ]),
  folder('docs', [file('guide.md', 'Markdown', 9_830), file('changelog.md', 'Markdown', 4_410)]),
  file('package.json', 'JSON', 1_150),
  file('README.md', 'Markdown', 2_760),
  file('tsconfig.json', 'JSON', 480),
];

/** A folder's entries: the table's `getSubRows`. */
export const entriesOf = (entry: Entry) => entry.children;

/** `8.9 kB` for 8,912 bytes. */
export const formatSize = (bytes: number) =>
  bytes < 1000 ? `${String(bytes)} B` : `${(bytes / 1000).toFixed(1)} kB`;

export const fileColumns = [
  { id: 'name', header: 'Name', accessor: 'name', width: { flex: 1 }, sortable: true },
  { id: 'type', header: 'Type', accessor: 'type', width: 130 },
  {
    id: 'size',
    header: 'Size',
    accessor: 'size',
    width: 110,
    align: 'end' as const,
    sortable: true,
    cell: (entry: Entry) => formatSize(entry.size),
  },
];

/**
 * The ids of every folder, for "Expand all". Without `getRowId` a top-level
 * row's id is its index in `data` (`'0'`), and a child's is its parent's id, a
 * dot and its index among its siblings (`'0.1'` is src's second entry, lib).
 */
export const folderIds: readonly string[] = (function idsOf(entries: Entry[], parent?: string) {
  return entries.flatMap((entry, i): string[] => {
    const id = parent === undefined ? String(i) : `${parent}.${String(i)}`;
    return entry.children ? [id, ...idsOf(entry.children, id)] : [];
  });
})(files);

/** A person, with the id of their manager: `null` for the head of the company. */
export interface Person {
  id: string;
  name: string;
  title: string;
  team: string;
  managerId: string | null;
}

const teams = [
  { team: 'Engineering', head: 'Bruno Silva', lead: 'Engineering lead', member: 'Engineer' },
  { team: 'Sales', head: 'Freya Lindqvist', lead: 'Sales lead', member: 'Account executive' },
  { team: 'Design', head: 'Hana Tanaka', lead: 'Design lead', member: 'Designer' },
  { team: 'Finance', head: 'Emeka Mensah', lead: 'Finance lead', member: 'Accountant' },
];
// prettier-ignore
const firstNames = [
  'Ada', 'Ben', 'Chen', 'Dara', 'Elif', 'Femi', 'Goran', 'Ilse', 'Jonas', 'Kemi', 'Lena',
  'Luca', 'Mina', 'Nils', 'Olga', 'Pita', 'Quinn', 'Rosa', 'Sami', 'Tariq', 'Una', 'Vera',
  'Wim', 'Xia', 'Yusuf', 'Zofia', 'Arno', 'Bea', 'Cyril', 'Dina', 'Ezra', 'Fay',
];
const lastNames = ['Moreau', 'Novak', 'Haddad', 'Kowalski', 'Rossi', 'Ivanova', 'Nguyen'];

/** 37 people: a chief executive, four heads of team, two leads each and three people per lead. */
export const people: Person[] = (() => {
  const list: Person[] = [
    { id: 'p1', name: 'Grace Okafor', title: 'Chief executive', team: 'Board', managerId: null },
  ];
  const add = (name: string, title: string, team: string, managerId: string) => {
    const id = `p${String(list.length + 1)}`;
    list.push({ id, name, title, team, managerId });
    return id;
  };
  let n = 0;
  const nextName = () => {
    const name = `${firstNames[n] ?? ''} ${lastNames[n % lastNames.length] ?? ''}`;
    n += 1;
    return name;
  };
  for (const { team, head, lead, member } of teams) {
    const headId = add(head, `Head of ${team}`, team, 'p1');
    for (let l = 0; l < 2; l++) {
      const leadId = add(nextName(), lead, team, headId);
      for (let m = 0; m < 3; m++) add(nextName(), member, team, leadId);
    }
  }
  return list;
})();

/** Rows are kept by id (expanded, selected), and parents named by id. */
export const personId = (person: Person) => person.id;
/** A person's manager: the table's `getParentId`. */
export const managerOf = (person: Person) => person.managerId;

export const personColumns = [
  { id: 'name', header: 'Name', accessor: 'name', width: { flex: 1 } },
  { id: 'title', header: 'Title', accessor: 'title', width: 180 },
  { id: 'team', header: 'Team', accessor: 'team', width: 130 },
];

export const describeSelection = (selection: readonly string[]) =>
  selection.length === 1 ? '1 person selected' : `${String(selection.length)} people selected`;
