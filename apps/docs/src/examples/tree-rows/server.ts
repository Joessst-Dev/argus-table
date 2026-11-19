// Shared by the lazy-tree example's four flavours: a pretend file server,
// standing in for your API. It pages the top-level entries (getRows) and
// answers a folder's entries (getChildren), sorted, after a short delay.
import type { DataSource, SortState } from 'argus-table';

/** A file or folder as the server sends it: no children, they load on expand. */
export interface DriveItem {
  /** The server's id, the entry's path: unique across levels. */
  id: string;
  name: string;
  type: string;
  size: number;
  /** A folder has entries to load. */
  folder: boolean;
}

/** An entry on the server's disk. */
interface Stored {
  name: string;
  type: string;
  size: number;
  children?: Stored[];
}

const file = (name: string, type: string, size: number): Stored => ({ name, type, size });
const folder = (name: string, children: Stored[]): Stored => ({
  name,
  type: 'Folder',
  size: 0,
  children,
});

/** What each project folder holds, three levels deep. */
const project: Stored[] = [
  folder('src', [
    folder('components', [
      file('Button.tsx', 'TypeScript', 2_340),
      file('Table.tsx', 'TypeScript', 8_912),
      file('Toolbar.tsx', 'TypeScript', 1_208),
    ]),
    file('main.ts', 'TypeScript', 412),
    file('styles.css', 'CSS', 5_870),
  ]),
  folder('docs', [file('guide.md', 'Markdown', 9_830), file('changelog.md', 'Markdown', 4_410)]),
  file('package.json', 'JSON', 1_150),
  file('README.md', 'Markdown', 2_760),
];

/** The entries under each folder's id, held by the server. */
const childrenOf = new Map<string, DriveItem[]>();

/** Stores an entry and what it holds, sizes scaled per project; a folder is as large as its entries. */
function store(entry: Stored, id: string, scale: number): DriveItem {
  if (!entry.children) {
    const size = Math.round(entry.size * scale);
    return { id, name: entry.name, type: entry.type, size, folder: false };
  }
  const children = entry.children.map((child) => store(child, `${id}/${child.name}`, scale));
  childrenOf.set(id, children);
  const size = children.reduce((sum, child) => sum + child.size, 0);
  return { id, name: entry.name, type: entry.type, size, folder: true };
}

/** The 200 top-level entries: project folders, every fourth one a report. */
const topLevel: DriveItem[] = Array.from({ length: 200 }, (_, i) => {
  const n = String(i + 1).padStart(3, '0');
  const scale = 1 + ((i * 37) % 10) / 10;
  if (i % 4 === 3) return store(file(`Report ${n}.pdf`, 'PDF', 48_000), `report-${n}`, scale);
  return store(folder(`Project ${n}`, project), `project-${n}`, scale);
});

/** A copy of the entries in the order `sorting` asks for (its first column). */
function sorted(items: readonly DriveItem[], sorting: SortState): DriveItem[] {
  const [by] = sorting;
  if (!by) return [...items];
  const key = by.id as keyof DriveItem;
  const dir = by.desc ? -1 : 1;
  return [...items].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (typeof x === 'string' && typeof y === 'string') return dir * x.localeCompare(y);
    return x < y ? -dir : x > y ? dir : 0;
  });
}

/** Resolves after 200–400 ms, or rejects when the table aborts the request. */
function delay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 200 + Math.random() * 200);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason as Error);
    });
  });
}

/**
 * The data source: `getRows` pages the top-level entries, `hasChildren` reads a
 * field of the row, and `getChildren` loads all of a folder's entries at once,
 * sorted like the rows.
 */
export function createDriveSource(): DataSource<DriveItem> {
  return {
    pageSize: 50,
    async getRows({ start, end, sorting, signal }) {
      await delay(signal);
      return { rows: sorted(topLevel, sorting).slice(start, end), total: topLevel.length };
    },
    hasChildren: (item) => item.folder,
    async getChildren({ parent, sorting, signal }) {
      await delay(signal);
      return { rows: sorted(childrenOf.get(parent.id) ?? [], sorting) };
    },
  };
}
