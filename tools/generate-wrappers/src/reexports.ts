// Every wrapper re-exports argus-table's public types, so apps import them from
// one package. The lists are written by hand in each wrapper's index.ts (with the
// wrapper's own exports around them); `--check` keeps them equal to the table's.

/** The type names a module exports with `export type X` and `export type { … }`. */
export function exportedTypes(source: string): Set<string> {
  const names = new Set([...source.matchAll(/^export type (\w+)/gm)].map((m) => m[1] ?? ''));
  for (const [, block = ''] of source.matchAll(/export type \{([^}]*)\}/g)) {
    for (const name of block.split(',')) {
      const local =
        name
          .trim()
          .split(/\s+as\s+/)
          .pop() ?? '';
      if (local) names.add(local);
    }
  }
  names.delete('');
  return names;
}

/** The names a wrapper re-exports from `argus-table`, aliases (the element classes) aside. */
export function reexportedTypes(source: string): Set<string> {
  const names = new Set<string>();
  for (const [, block = ''] of source.matchAll(/export type \{([^}]*)\} from 'argus-table';/g)) {
    for (const name of block.split(',')) {
      const trimmed = name.trim();
      if (trimmed && !trimmed.includes(' as ')) names.add(trimmed);
    }
  }
  return names;
}

/** What a wrapper's re-exports lack and have too many, against the table's types. */
export function compareReexports(
  tableTypes: string,
  wrapperIndex: string,
): { missing: string[]; extra: string[] } {
  const want = exportedTypes(tableTypes);
  const got = reexportedTypes(wrapperIndex);
  return {
    missing: [...want].filter((n) => !got.has(n)).sort(),
    extra: [...got].filter((n) => !want.has(n)).sort(),
  };
}
