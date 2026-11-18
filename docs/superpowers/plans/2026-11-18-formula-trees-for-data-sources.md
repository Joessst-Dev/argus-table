# Formula trees for data sources: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** With `formulas({ server: true })` and a `dataSource`, formula columns sort and filter, and `getRows` reads their syntax trees with `formulaTrees(table)`.

**Architecture:** Everything is in `@argus-table/formulas`; the table doesn't change. A new module `src/trees.ts` turns the parsed formulas into plain-JSON trees with references resolved to column ids, and keeps them per table in a module-level `WeakMap` that `formulaTrees()` reads. The plugin's `columns` hook keeps `sortable` and `filter` for columns that have a tree, and calls `table.refresh()` when the trees change while the server's results depend on them.

**Tech stack:** TypeScript (strict), Lit 3, Vitest (Node project for `*.node.test.ts`, browser project for the rest), Astro docs site with four flavours per example, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-formula-trees-for-data-sources-design.md`

## Global constraints

- No change to `packages/table` or `packages/core`.
- With `server` off (the default), behaviour is exactly as today, except the fix in Task 2 (the hook re-runs when `dataSource` is set or removed).
- Plugin budget: 12.8 kB min+gzip (`packages/formulas/.size-limit.js`), raised from 12.3 kB with the maintainer's approval (the feature costs 0.50 kB).
- Public names, exact: option `server?: boolean`; `formulaTrees(table: HTMLElement): FormulaTrees`; types `FormulaTrees`, `FormulaTree`, `FormulaOperator`.
- The tree format can only grow once released (ADR 0004). No `range` node.
- `@argus-table/formulas` stays framework-agnostic, with `argus-table` and `lit` as peers.
- Work on branch `feat/formula-trees`. All commands run in the scratchpad Linux copy (`sync.sh`, then `env.sh`); the mounted repo's `node_modules` are macOS binaries.
- Prettier on every changed file; `pnpm lint` passes.

## Review focus

1. **`dataSource` set or removed after the first render.** Today the hook only reads `dataSource` when the columns run again, so a formula column could stay sortable against a server that doesn't know it. Expected: `sortable`/`filter` follow the switch at once. Test in Task 2.
2. **A sort and a formula change in the same update.** The sort already restarts the data source's cache, so a `refresh()` on top would load twice. Expected: no `refresh()`. Test in Task 3.
3. **Setting `columns` again with the same formulas** (a framework re-render makes a new array). Expected: no `refresh()`. Test in Task 3.
4. **One `formulas()` instance serving two tables.** Expected: `formulaTrees()` gives each table its own trees. Test in Task 2.
5. **A formula reading a broken or whole-column formula.** Expected: left out of the trees and not sortable, like the column it reads. Tests in Tasks 1 and 2.

---

### Task 1: The tree conversion

**Files:**

- Create: `packages/formulas/src/trees.ts`
- Modify: `packages/formulas/src/columns.ts` (`Compiled<T>`, `entry()`, `broken()`, the `#CYCLE!` entry in `compileColumns`)
- Test: `packages/formulas/src/trees.node.test.ts`
- Also commit the spec: `docs/superpowers/specs/2026-11-18-formula-trees-for-data-sources-design.md`

**Interfaces:**

- Consumes: `lookupOf`, `Compiled<T>`, `compileColumns`, `functionTable`, `parseOrError` (`columns.ts`); `FormulaNode`, `BinaryOperator` (`engine/parse.ts`); `FunctionTable` (`engine/functions/index.ts`); `FormulaSyntaxError` (`engine/errors.ts`).
- Produces:
  - `Compiled<T>.broken: boolean`: `true` for an entry that is `#ERROR!` or `#CYCLE!` in every row (a parse error, the wrong number of arguments, a cycle), `false` otherwise.
  - In `trees.ts`: the exported types `FormulaTree`, `FormulaOperator` (exactly as the spec writes them) and `FormulaTrees` (`{ columns: Record<string, FormulaTree>; timeZone: string }`, with the spec's JSDoc).
  - `treesOf<T>(defs: readonly ColumnDef<T, unknown>[], compiled: ReadonlyMap<string, Compiled<T>>, options: { parse(formula: string): FormulaNode | FormulaSyntaxError; functions: FunctionTable }): Record<string, FormulaTree>`

- [ ] **Step 1: Branch and commit the spec**

```bash
git checkout -b feat/formula-trees
git add docs/superpowers/specs/2026-11-18-formula-trees-for-data-sources-design.md docs/superpowers/plans/2026-11-18-formula-trees-for-data-sources.md
git commit -m "docs: design and plan for formula trees with a data source"
```

- [ ] **Step 2: Write the failing tests** in `trees.node.test.ts`

Build `compiled` with `compileColumns(defs, { functions, parse: parseOrError })` and call `treesOf(defs, compiled, { parse: parseOrError, functions })`, with `functions = functionTable({ vat: { fn: (n) => Number(n) * 0.19, args: [1, 1] } })` and these data columns: `{ id: 'price', header: 'Unit price', accessor: 'price' }`, `{ id: 'qty', header: 'Quantity', accessor: 'qty' }`, `{ id: 'w', header: () => 'Weight', accessor: 'w' }`.

```ts
const ref = (column: string) => ({ type: 'ref', column });

it('turns a formula into a tree with column ids and no spans', () => {
  expect(trees({ total: '[price] * [Quantity]' })).toEqual({
    total: { type: 'binary', operator: '*', left: ref('price'), right: ref('qty') },
  });
});

it.each([
  ['[unit price]', 'price'], // text header, any case
  ['[QTY]', 'qty'], // id, any case
  ['[weight]', 'w'], // a header function's text mode
])('resolves %s to %s', (formula, id) => {
  expect(trees({ f: formula }).f).toEqual(ref(id));
});

it('keeps literals, calls, unary minus and percent', () => {
  expect(trees({ f: 'IF([qty] > 0, "yes", TRUE)' }).f).toEqual({
    type: 'call',
    name: 'IF',
    args: [
      { type: 'binary', operator: '>', left: ref('qty'), right: { type: 'number', value: 0 } },
      { type: 'text', value: 'yes' },
      { type: 'boolean', value: true },
    ],
  });
  expect(trees({ f: '-[price]' }).f).toEqual({
    type: 'unary',
    operator: '-',
    operand: ref('price'),
  });
  expect(trees({ f: '[price]%' }).f).toEqual({ type: 'percent', operand: ref('price') });
  expect(trees({ f: 'vat([price])' }).f).toEqual({
    type: 'call',
    name: 'VAT',
    args: [ref('price')],
  });
});

it('keeps a reference to another formula column as a ref', () => {
  expect(trees({ total: '[price] * [qty]', twice: '[total] * 2' }).twice).toEqual({
    type: 'binary',
    operator: '*',
    left: ref('total'),
    right: { type: 'number', value: 2 },
  });
});

it.each([
  ['a formula that does not parse', '[price] *'],
  ['an unknown column', '[Nope]'],
  ['an unknown function', 'NOPE(1)'],
  ['the wrong number of arguments', 'ROUND()'],
  ['a whole column', '[price] / SUM([[price]])'],
])('leaves out %s', (_, formula) => {
  expect(trees({ f: formula })).toEqual({});
});

it('leaves out cycles, and columns reading a left-out column', () => {
  expect(trees({ a: '[b]', b: '[a]' })).toEqual({});
  expect(
    Object.keys(
      trees({
        share: 'SUM([[price]])',
        pct: '[share] * 100',
        bad: '[price] *',
        next: '[bad] + 1',
        ok: '[qty]',
      }),
    ),
  ).toEqual(['ok']);
});

it('gives plain JSON', () => {
  const result = trees({ total: '[price] * [qty]' });
  expect(JSON.parse(JSON.stringify(result))).toEqual(result);
});
```

(`trees(formulas)` is a local helper: data columns plus `{ id, formula }` per entry, compiled, then `treesOf`.)

- [ ] **Step 3: Run them and see them fail**

Run: `pnpm --filter @argus-table/formulas exec vitest run --project engine src/trees.node.test.ts`
Expected: FAIL, `trees.ts` doesn't exist.

- [ ] **Step 4: Add `Compiled.broken`, then implement `trees.ts`**

`treesOf` includes a formula column when its parse succeeded, its compiled entry exists and is neither `broken` nor `ranges`, every `ref` resolves through `lookupOf(defs)`, every `call` names a function in `options.functions`, and every formula column it refers to is included too (memoized per id; cycles are already `broken`). The conversion maps `FormulaNode` to `FormulaTree` node by node, dropping `start`/`end` and replacing `name` with `column: target.id`. Use the plugin's parse cache (`options.parse`), not a new parse.

- [ ] **Step 5: Run the Node tests and see them pass**

Run: `pnpm --filter @argus-table/formulas exec vitest run --project engine`
Expected: PASS, the existing `columns.node.test.ts` too.

- [ ] **Step 6: Commit**

```bash
git add packages/formulas/src/trees.ts packages/formulas/src/trees.node.test.ts packages/formulas/src/columns.ts
git commit -m "feat(formulas): turn formula columns into syntax trees with column ids"
```

---

### Task 2: The `server` option and `formulaTrees()`

**Files:**

- Modify: `packages/formulas/src/trees.ts` (the per-table store and `formulaTrees`)
- Modify: `packages/formulas/src/plugin.ts` (`FormulasOptions.server`, `willUpdate`, the `columns` hook, the plugin's JSDoc)
- Modify: `packages/formulas/src/index.ts`
- Test: `packages/formulas/src/plugin.test.ts`

**Interfaces:**

- Consumes: `treesOf` and the types from Task 1.
- Produces:
  - `export function formulaTrees(table: HTMLElement): FormulaTrees` (the spec's JSDoc). `timeZone` is `Intl.DateTimeFormat().resolvedOptions().timeZone`; `columns` is `{}` for a table the plugin never saw.
  - `setTrees(table: HTMLElement, read: () => Record<string, FormulaTree>): void` in `trees.ts` (internal, not exported from `index.ts`): the `columns` hook stores a memoized reader per run, so `formulaTrees()` converts at most once per run and only when asked. The store is a module-level `WeakMap`, so any plugin instance's tables are found.
  - `index.ts` exports `formulaTrees` and the types `FormulaTree`, `FormulaTrees`, `FormulaOperator`.

- [ ] **Step 1: Write the failing browser tests** in `plugin.test.ts`, in a new `describe('with a dataSource and server: true')`

Reuse `fixture`, `settle`, `headerOf`, `texts`, `withFormulas` and the `grab` plugin pattern from the existing dataSource tests. `source(seen)` is a `DataSource<Row>` over `data` that pushes `{ sorting, trees: formulaTrees(el) }` into `seen` on each `getRows`.

```ts
test('formula columns sort, and getRows reads their trees', async () => {
  // columns: withFormulas({ id: 'total', formula: '[price] * [qty]', sortable: true }); plugins: [formulas({ server: true })]
  headerOf(el, 'total').click();
  await settle(el);
  expect(el.sorting).toEqual([{ id: 'total', desc: false }]);
  await vi.waitFor(() => expect(seen.at(-1)?.sorting).toEqual([{ id: 'total', desc: false }]));
  expect(seen.at(-1)?.trees.columns.total).toEqual({
    type: 'binary',
    operator: '*',
    left: { type: 'ref', column: 'price' },
    right: { type: 'ref', column: 'qty' },
  });
  expect(seen.at(-1)?.trees.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
});

test('formula columns keep their filter', async () => {
  // filter: 'number' on total
  expect(host?.column('total')?.filter).toBe('number');
});

test('broken and whole-column formulas, and those reading them, stay unsortable', async () => {
  // columns: bad '[price] *', share 'SUM([[price]])', pct '[share] * 100', all sortable and filter: 'number'
  for (const id of ['bad', 'share', 'pct']) {
    expect(host?.column(id)?.sortable).toBe(false);
    expect(host?.column(id)?.filter).toBeUndefined();
  }
  expect(Object.keys(formulaTrees(el).columns)).toEqual([]);
});

test('sortable and filter follow a dataSource set or removed later', async () => {
  // mount with data, formulas() (server off), total sortable with filter 'number'
  el.data = undefined;
  el.dataSource = source([]);
  await settle(el);
  expect(host?.column('total')?.sortable).toBe(false);
  el.dataSource = undefined;
  el.data = data;
  await settle(el);
  expect(host?.column('total')?.sortable).toBe(true);
});

test('formulaTrees gives each table its own trees, with one plugin for both', async () => {
  // one const plugin = formulas({ server: true }); two fixtures, total '[price] * [qty]' and total '[price] + [qty]'
  expect(formulaTrees(a).columns.total).toMatchObject({ operator: '*' });
  expect(formulaTrees(b).columns.total).toMatchObject({ operator: '+' });
});

test('formulaTrees works with data too, and gives no columns without formulas()', async () => {
  expect(formulaTrees(withData).columns.total).toBeDefined();
  expect(formulaTrees(document.createElement('argus-table')).columns).toEqual({});
});
```

The two existing tests "formula columns can't sort/filter with a dataSource" stay as they are (server off).

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm nx build header-menu && pnpm --filter @argus-table/formulas exec vitest run --project plugin src/plugin.test.ts -t "server: true"` (the plugin tests import header-menu's build)
Expected: FAIL, `formulaTrees` isn't exported.

- [ ] **Step 3: Implement**

- `FormulasOptions.server?: boolean` with the spec's JSDoc.
- `willUpdate`: when `dataSource` changed from set to unset or back, call `host.invalidateColumns()` (whether or not `server` is on). Keep the existing whole-column check.
- `columns` hook: after compiling, `setTrees(host.element, …)` with a memoized `treesOf(defs, compiled, { parse: parseOnce, functions })`. For a formula column: `const kept = !remote || (server && id in trees)`; `sortable: kept ? def.sortable : false`, `filter: kept ? def.filter : undefined`. With `server` off and a `dataSource`, don't compute the trees for this.
- The plugin's JSDoc: one sentence on `server` and `formulaTrees`.

- [ ] **Step 4: Run the formulas tests and see them pass**

Run: `pnpm nx test formulas`
Expected: PASS, both projects.

- [ ] **Step 5: Measure the size**

Run: `pnpm nx build formulas && pnpm --filter @argus-table/formulas size`
Expected: the plugin entry under 12.3 kB. If it's over, stop and ask the maintainer.

- [ ] **Step 6: Commit**

```bash
git add packages/formulas/src
git commit -m "feat(formulas): server option and formulaTrees() for data sources"
```

---

### Task 3: Reload when a formula the server uses changes

**Files:**

- Modify: `packages/formulas/src/plugin.ts` (`TableState`, `willUpdate`, the `columns` hook)
- Test: `packages/formulas/src/plugin.test.ts`

**Interfaces:**

- Consumes: the memoized trees reader from Task 2.
- Produces: `TableState` gains `trees: string | undefined` (the last run's trees as JSON, `undefined` before the first) and `restarting: boolean` (set in every `willUpdate`: `true` when `dataSource`, `sorting`, `columnFilters` or `quickFilter` changed, since the data source then starts a fresh cache itself).

- [ ] **Step 1: Write the failing tests** in the same `describe`

Each mounts with `formulas({ server: true })`, a `dataSource`, columns `total: '[price] * [qty]'` and `twice: '[total] * 2'` (both sortable), lets it settle, then `const refresh = vi.spyOn(el, 'refresh')`.

```ts
test('changing the sorted formula reloads once', async () => {
  el.sorting = [{ id: 'total', desc: true }]; await settle(el);
  el.columns = withFormulas({ id: 'total', formula: '[price] + [qty]', sortable: true }, twice);
  await settle(el);
  expect(refresh).toHaveBeenCalledTimes(1);
});

test('changing a formula the sorted one reads reloads', async () => {
  el.sorting = [{ id: 'twice', desc: false }]; await settle(el);
  // change total's formula, keep twice
  expect(refresh).toHaveBeenCalledTimes(1);
});

test('a filter on a formula column, or quick filter text, counts too', async () => {
  // once with columnFilters { total: { kind: 'number', op: 'gt', value: 1 } }, once with quickFilter 'a'
  expect(refresh).toHaveBeenCalledTimes(1);
});

test('no reload when nothing sorts or filters by formulas', async () => {
  // change total's formula with sorting [], columnFilters {}, quickFilter ''
  expect(refresh).not.toHaveBeenCalled();
});

test('no reload for the same formulas in a new array', async () => {
  el.sorting = [{ id: 'total', desc: true }]; await settle(el);
  el.columns = [...el.columns];
  await settle(el);
  expect(refresh).not.toHaveBeenCalled();
});

test('no reload when the sort changes in the same update', async () => {
  el.sorting = [{ id: 'total', desc: true }]; await settle(el);
  el.columns = /* total with a new formula */;
  el.sorting = [{ id: 'total', desc: false }];
  await settle(el);
  expect(refresh).not.toHaveBeenCalled();
});

test('no reload with server off', async () => {
  // formulas() without server, sorted by a data column, total's formula changed
  expect(refresh).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter @argus-table/formulas exec vitest run --project plugin src/plugin.test.ts -t "reload"`
Expected: FAIL on the three "reloads" tests.

- [ ] **Step 3: Implement**

In the `columns` hook, when `server` is on and there is a `dataSource`: compute the trees' JSON. If `state.trees` was defined and differs, `state.restarting` is false, and some formula column (a def with `formula`) is in `sorting` or `columnFilters`, or `quickFilter.trim()` isn't empty, then `void host.element.updateComplete.then(() => host.element.refresh())`. Store the JSON either way. Don't call `refresh()` inside the hook.

- [ ] **Step 4: Run the formulas tests, then measure the size again**

Run: `pnpm nx test formulas && pnpm nx build formulas && pnpm --filter @argus-table/formulas size`
Expected: PASS; under 12.3 kB.

- [ ] **Step 5: Commit**

```bash
git add packages/formulas/src
git commit -m "feat(formulas): reload a data source when a formula it sorts or filters by changes"
```

---

### Task 4: The docs example and its e2e

**Files:**

- Create: `apps/docs/src/examples/formulas/server.ts`
- Create: `apps/docs/src/examples/formulas/data-source/html/{index.html,main.js}`, `react/FormulaDataSource.tsx`, `vue/FormulaDataSource.vue`, `angular/formula-data-source.component.ts`
- Modify: `apps/docs/e2e/formulas.spec.ts`

**Interfaces:**

- Consumes: `formulas`, `formulaTrees`, type `FormulaTrees`/`FormulaTree` from `@argus-table/formulas`; `itemsOf`, `Item`, `dataColumns` from `examples/formulas/data.ts`.
- Produces, in `server.ts`:
  - `createFormulaSource(table: () => HTMLElement | null | undefined, onRequest: (request: FormulaRequest) => void): DataSource<Item>`: its `getRows` calls `formulaTrees(table())` (the browser side), then the pretend server (as built: the element, not a trees getter, so every flavour passes its element the way it has it)
  - `interface FormulaRequest { start: number; end: number; sorting: SortState; filters: ColumnFilterState; quickFilter: string; formulas: FormulaTrees }`
  - `describe(request: FormulaRequest): string`: one log line with the range, sorting, filters and the trees of the sorted and filtered formula columns as JSON.

- [ ] **Step 1: Write the pretend server**

Over `itemsOf(10_000)`, with a 150 ms delay and `signal.throwIfAborted()` like `filtering/data.ts`. Imports only types from `@argus-table/formulas` (a server author's code: no engine). A small evaluator: `number`, `text`, `boolean`, `ref` (a formula column's tree from `trees().columns`, else the item's field by column id), `unary`, `percent`, `binary` (arithmetic, `&`, comparisons), `call` for `IF` and `ROUND`; anything else gives `undefined`, as an unknown node type must. Sorting puts `undefined` last both ways; `number` filters support every `RangeFilterOp`, `text` filters every `TextFilterOp` (core `types.ts`); the quick filter matches the product and the formula columns' values as text (numbers `String(n)`, booleans `true`/`false`). Comments explain each rule as the docs state it.

- [ ] **Step 2: Write the four flavours**

Columns: `dataColumns` plus `{ id: 'total', header: 'Line total', formula: '[Unit price] * [Quantity] * (1 - [Discount])', sortable: true, filter: 'number', width: 120 }` and `{ id: 'size', header: 'Order size', formula: 'IF([Quantity] >= 10, "bulk", "single")', sortable: true, filter: 'text', width: 120 }`; `plugins: [formulas({ server: true }), headerMenu()]`; `columnFilters` starts as `{ total: { kind: 'number', op: 'ge', value: 200 } }`; an `<output>` shows `describe()` of the last request. Each flavour passes `() => formulaTrees(table)` with its element: the HTML flavour the element, React `ref.current`, Vue a template ref, Angular `@ViewChild` (as the export examples do). Ids and labels follow the other examples (`formulas-data-source-table`, `formulas-data-source-log`).

- [ ] **Step 3: Write the e2e**

In `formulas.spec.ts`, per flavour, on `features/formulas/` with `openFlavour(page, 'formulas/data-source', flavour)`:

```ts
test(`${flavour}: a data source sorts and filters by formula columns`, async ({ page }) => {
  // every loaded "Line total" is >= 200 (the starting filter)
  // click the "Line total" header twice (descending): the loaded totals are non-increasing
  await expect(example.locator('output')).toContainText('"sorting":[{"id":"total","desc":true}]');
  await expect(example.locator('output')).toContainText('"type":"binary"');
  await expectAccessible(page, example);
});
```

The e2e fails until Task 5 puts the example on the page; run it there.

- [ ] **Step 4: Typecheck and lint the docs**

Run: `pnpm nx typecheck docs && pnpm nx lint docs`
Expected: PASS (`check-examples.mjs` may report the example as not on a page yet; that's fixed in Task 5, so commit both together if it fails).

- [ ] **Step 5: Commit**

```bash
git add apps/docs/src/examples/formulas apps/docs/e2e/formulas.spec.ts
git commit -m "docs(formulas): example of a data source sorting by formula columns"
```

---

### Task 5: Docs, records and release note

**Files:**

- Modify: `apps/docs/src/content/docs/features/formulas.mdx` (new section "With a `dataSource`", with the example's `FlavourTabs`)
- Modify: `apps/docs/src/content/docs/guides/server-data.mdx` (one sentence linking to it)
- Modify: `packages/formulas/README.md` (a short "With a `dataSource`" section; keep the `# ` first line)
- Create: `docs/adr/0012-formula-trees-for-data-sources.md`; Modify: `docs/adr/README.md` (index), `docs/adr/0004-api-1-0.md:134` (mark done, link to 0012)
- Modify: `docs/plan/plan/09-formula-columns.md:49,88` (the syntax tree is decided; whole columns stay open)
- Modify: `skills/argus-table-integrate/scripts/lib/api.mjs` (`exports: ['formulas', 'formulaTrees']`, `options` gains `'server'`), `references/api.md`, `references/addons.md:90`
- Modify: `CLAUDE.md` (the `packages/formulas` paragraph: replace "With a `dataSource` formula columns aren't sortable." with one sentence on `server`, `formulaTrees()` in `trees.ts` and the refresh)
- Create: `.changeset/formula-trees.md`

- [ ] **Step 1: Write the "With a `dataSource`" section**

From the engine's code, not from the spec's summary: the switch, `formulaTrees()` and its shape, the node types, the rules (values and blanks, coercions from `engine/coerce.ts`, comparisons, sorting with errors and blanks last, filters on the value with errors as empty, quick filter and text filters on core `textOf()`, dates in `timeZone`), a table of the built-in functions (name, arguments, one line each, from `engine/functions/` and `editor/docs.ts`) with the behaviours the spec lists (lazy `IF`/`IFERROR`/`AND`/`OR`, local time, `DATEDIF` units, errors other than `#VALUE!`), whole-column functions as never reaching a server, unknown node types as "can't evaluate", what the promise covers (the format grows only; the rules follow the release, changes are in the changelog), the example, and a short generic-SQL sketch turning a tree into an expression for `ORDER BY`/`WHERE`. Check each rule against a test or the source.

- [ ] **Step 2: ADR 0012, ADR 0004, the plan, the skill, CLAUDE.md, README**

ADR 0012 in the format of 0011: context, decision (approach B, the switch, `FormulaTrees`, the refresh rule, the promise), the rejected approach A, consequences. The rest as listed under Files.

- [ ] **Step 3: Changeset**

```md
---
'@argus-table/formulas': minor
---

Formula columns can sort and filter with a `dataSource`: turn it on with `formulas({ server: true })`, and read each formula's syntax tree in `getRows` with `formulaTrees(table)` to sort and filter on your server. Formula columns now also stop or start sorting as soon as a `dataSource` is set or removed, without setting `columns` again.
```

- [ ] **Step 4: Verify the docs and the skill**

Run: `pnpm nx lint docs && pnpm nx typecheck docs && pnpm nx build docs && pnpm nx test skills && BROWSERS=chromium pnpm nx e2e docs --skip-nx-cache -- formulas.spec.ts --workers=3`
Expected: PASS, the new e2e in all four flavours.

- [ ] **Step 5: Commit**

```bash
git add -A apps/docs packages/formulas/README.md docs skills CLAUDE.md .changeset/formula-trees.md
git commit -m "docs: formula columns with a data source, ADR 0012"
```

---

### Task 6: Full check and pull request

- [ ] **Step 1: Run the full check in the copy**

Run: `sync.sh` then `verify.sh` (lint, tests, build, the element's manifest unchanged, `pnpm size`, `nx test skills`, Storybook twice, playground, e2e with `--skip-nx-cache --workers=3`, Prettier on the whole repo), plus the docs e2e in all engines for `formulas.spec.ts`.
Expected: everything passes; the CDN bundle unchanged at 46.17 kB; the formulas plugin under 12.3 kB.

- [ ] **Step 2: Push and open the pull request**

```bash
git push -u origin feat/formula-trees
gh pr create --title "feat(formulas): sort and filter formula columns with a data source" --body "…"
```

The body: what it does for apps, the switch, `formulaTrees()`, the refresh, the size change, the link to ADR 0012, and the attribution line. Merge once CI is green (squash, delete branch).
