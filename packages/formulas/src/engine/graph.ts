/**
 * Orders formula columns so each comes after the formula columns it uses, and
 * finds the ones in a cycle (Tarjan's strongly connected components). `uses`
 * maps each formula column to the formula columns it names.
 *
 * A column is in `cyclic` if it can reach itself: a column naming itself, or
 * every column of a loop. A column that only uses one of those isn't, though
 * its value is the cycle's error.
 */
export function analyze(uses: ReadonlyMap<string, readonly string[]>): {
  order: string[];
  cyclic: Set<string>;
} {
  const order: string[] = [];
  const cyclic = new Set<string>();
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  let counter = 0;

  const visit = (id: string): void => {
    index.set(id, counter);
    low.set(id, counter);
    counter++;
    stack.push(id);
    onStack.add(id);
    for (const next of uses.get(id) ?? []) {
      if (!uses.has(next)) continue;
      if (!index.has(next)) {
        visit(next);
        low.set(id, Math.min(low.get(id) ?? 0, low.get(next) ?? 0));
      } else if (onStack.has(next)) {
        low.set(id, Math.min(low.get(id) ?? 0, index.get(next) ?? 0));
      }
    }
    if (low.get(id) !== index.get(id)) return;
    // `id` is the root of a component: pop it.
    const component: string[] = [];
    let member: string | undefined;
    do {
      member = stack.pop();
      if (member === undefined) break;
      onStack.delete(member);
      component.push(member);
    } while (member !== id);
    if (component.length > 1 || uses.get(id)?.includes(id)) {
      for (const m of component) cyclic.add(m);
    }
    // Components come out dependencies first.
    order.push(...component.reverse());
  };

  for (const id of uses.keys()) if (!index.has(id)) visit(id);
  return { order, cyclic };
}
