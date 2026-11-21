import type { RemoteForest } from '../table/model-types.js';
import { layoutTree } from '../table/tree-order.js';

/**
 * A data source's loaded rows as a forest, for branch selection: `ids` and
 * `parent` numbered depth first (so they are in layout order), and the rows in
 * `hiding` given one hidden child each, after the rows and out of the layout:
 * never selected, it keeps its parent's id out (a server filter's rows, a
 * group's rows the server hasn't sent). `idAt` gives a shown index's id.
 */
export function remoteForest(
  ids: string[],
  parent: number[],
  hiding: readonly number[],
  idAt: (index: number) => string | undefined,
): RemoteForest {
  const rows = new Map(ids.map((id, row) => [id, row]));
  const shown = ids.map((_, row) => row);
  for (const row of hiding) {
    parent.push(row);
    ids.push(`\u0000${ids[row] ?? ''}`);
  }
  const tree = { ids, rows: ids, parent: Int32Array.from(parent) };
  const layout = layoutTree(tree, shown);
  const childCount = Int32Array.from(layout.keptChildren);
  for (const row of hiding) childCount[row] = (childCount[row] ?? 0) + 1;
  return {
    tree: { ...tree, childCount, indexOf: (id) => rows.get(id) },
    layout,
    at: (index) => {
      const id = idAt(index);
      return id === undefined ? undefined : rows.get(id);
    },
  };
}
