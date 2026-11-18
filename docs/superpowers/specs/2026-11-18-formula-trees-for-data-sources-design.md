# Formula columns with a `dataSource` (design)

Status: draft, 18 November 2026; builder check done.

## Why

With a `dataSource`, sorting and filtering happen on the server, and the server doesn't know what a formula column computes. So today `formulas()` drops `sortable` and `filter` from every formula column when the table has a `dataSource` (`packages/formulas/src/plugin.ts:327`): formula columns show their values (computed in the browser for the loaded rows) but can't be sorted or filtered. ADR 0004 lists the way out as an open addition after 1.0: "Passing a formula's syntax tree to `getRows` so formula columns can sort and filter with a `dataSource`."

This closes that item for **any** `dataSource` user, not for a particular backend: argus-table gives a stable, documented tree format and turns sorting and filtering back on when the app says its server understands formulas. A working example shows how a server uses the trees.

## Goals

- An app whose server can evaluate formulas turns that on with one switch, and formula columns then sort and filter with a `dataSource` as their definitions say (`sortable`, `filter`), including from the column menu and the quick filter.
- The app's `getRows` can get every formula column's syntax tree, with column references resolved to column ids, in a documented format that is public API under ADR 0004's compatibility policy.
- The docs explain the format and the rules a server must follow to match what the browser shows, and a four-flavour example runs a pretend server that sorts and filters by formula columns.

## Non-goals

- No change to `argus-table` or `@argus-table/core`: no new property, plugin hook, `RowsRequest` field or core bytes. The table keeps ignoring `formula`.
- No server implementation shipped as a package: no SQL translator, no Node evaluator export.
- Per-column opt-in (the maintainer chose all or nothing).
- Whole-column references (`[[price]]`) with a `dataSource`: those formulas stay `#N/A` and unsortable, switch or not (the browser can't compute their values without every row).

## Anti-goals

- Any change for existing apps: with the switch off (the default), behaviour is exactly as today.
- A server author who follows the docs and still sorts or filters differently from what the browser computes, without the docs having said where to look (the rules below, and the engine's source for a function's exact results).

## Constraints

- `@argus-table/formulas` stays framework-agnostic with `argus-table` as a type-only peer; its plugin budget is 12.3 kB min+gzip (`.size-limit.js`); the new code goes in the plugin chunk (it's small) unless it doesn't fit.
- Public API rules (ADR 0004): the switch, the function and the tree types are additions; once released, the tree format can only grow (new node types or fields), never change.
- Repo conventions: a changeset (`@argus-table/formulas`, minor), an ADR for the format, docs examples in four flavours (`check-examples.mjs` fails on a missing one), the integrate skill's `api.mjs` and `references/` list add-on options (`nx test skills` checks them), user-visible text through labels (none expected here).

## Approaches considered

- **A. A plugin hook in the table adds fields to each `RowsRequest`.** The trees arrive in the request, and the table could reload when they change. Rejected: new table API, an ADR and core bytes, for a need only one add-on has.
- **B. Everything in `@argus-table/formulas` (chosen).** The add-on exports a function the app's `getRows` calls to read the current trees; when a formula the server's results depend on changes, the add-on calls `table.refresh()`. No table change.

The maintainer picked B.

## The design

### The switch

`formulas({ server: true })`, a new `FormulasOptions` member (the name is my call):

```ts
/**
 * Your `dataSource` evaluates formulas: formula columns sort and filter as
 * their definitions say, and `getRows` reads their syntax trees with
 * `formulaTrees(table)`. Default `false`: with a `dataSource`, formula columns
 * don't sort or filter. No effect with `data`.
 */
server?: boolean;
```

With `server: true` and a `dataSource`, the plugin's `columns` hook keeps a formula column's `sortable` and `filter`, except for a column that is **broken** (its formula doesn't parse, or names an unknown column or function: `#ERROR!`, `#REF!`, `#NAME?`, a cycle) or **uses whole columns** (`Compiled.ranges`), or that reads such a column, directly or through other formula columns (its value depends on one the server can't compute): those stay unsortable and unfilterable, as today. (Following the dependencies is my call.)

### `formulaTrees(table)`

Exported from `@argus-table/formulas` (the name and the shape are my call):

```ts
/** What a `dataSource` needs to sort and filter by formula columns. */
export interface FormulaTrees {
  /** Each formula column's syntax tree, by column id. */
  columns: Record<string, FormulaTree>;
  /**
   * The browser's IANA time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`):
   * `TODAY()`, `YEAR()` and the other date functions use local time.
   */
  timeZone: string;
}

/**
 * The syntax trees of a table's formula columns, for a `dataSource` that sorts
 * and filters by them (`formulas({ server: true })`). Column references are
 * resolved to column ids. Leaves out columns whose formula is broken or uses
 * whole columns, and those that read them. `columns` is `{}` for a table
 * without `formulas()`.
 */
export function formulaTrees(table: HTMLElement): FormulaTrees;
```

An object rather than a bare record, because a record keyed by column ids could never take another field once released: the time zone is needed now (a server can't match the date functions without it), and later releases can add fields (ADR 0004 allows additions).

It reads the per-table state the plugin already keeps (the `WeakMap` keyed by the element), from the last run of the `columns` hook, so it matches the columns the table is showing. It returns the trees whether or not `server` is on (a harmless read; the switch only governs sorting and filtering). The result is plain JSON (no spans, no functions), so an app can send it to any backend.

Every formula column is included, not only those the request sorts or filters by: the quick filter searches every shown column, and a formula can read another formula column, so the server needs them all anyway, and they're small.

### The tree format: `FormulaTree`

The parser's `FormulaNode` (`engine/parse.ts`) without source spans and with references resolved:

```ts
export type FormulaTree =
  | { type: 'number'; value: number }
  | { type: 'text'; value: string }
  | { type: 'boolean'; value: boolean }
  /** This row's value of another column, by its id (a formula column's id too: its tree is in the same record). */
  | { type: 'ref'; column: string }
  /** A function call; `name` is upper case: a built-in function or one of yours (`functions`). */
  | { type: 'call'; name: string; args: FormulaTree[] }
  | { type: 'unary'; operator: '-' | '+'; operand: FormulaTree }
  /** Postfix `%`: divides by 100. */
  | { type: 'percent'; operand: FormulaTree }
  | { type: 'binary'; operator: FormulaOperator; left: FormulaTree; right: FormulaTree };

export type FormulaOperator =
  '+' | '-' | '*' | '/' | '^' | '&' | '=' | '<>' | '<' | '<=' | '>' | '>=';
```

No `range` node: columns using whole columns are left out. A later release that supports them adds the node type (an addition under ADR 0004; the docs tell servers to treat an unknown node type as "can't evaluate").

A reference resolves through the same lookup the plugin compiles with (`lookupOf` in `columns.ts`: id, then text header, then id in any case, then the header's text), so `[Price]` and `[price]` both become `{ type: 'ref', column: 'price' }`.

### Keeping the server's results current

A server's order and filtered rows depend on formulas the table can change without a new sort or filter (the formula editor proposes a change; the app applies it by setting `columns`). After the `columns` hook compiles, the plugin compares the trees with the previous run's (as JSON). When a tree changed, or a formula column was added or removed, and `server` is on, the table has a `dataSource`, and the server's results can depend on formulas (some formula column is in `sorting` or has a `columnFilters` entry, or `quickFilter` isn't empty), the plugin calls `host.element.refresh()` once, after the update (not inside the hook). Other changes need no reload: values on screen are computed in the browser anyway.

My call: "some formula column is sorted or filtered" rather than "the changed column is": a sorted column can read the one that changed, and the simpler rule covers that without walking dependencies. The cost is an occasional reload that wasn't needed.

### The rules a server has to follow

The docs (new section of the Formulas page, see below) spell out what the browser computes, taken from `engine/coerce.ts`, `engine/functions/` and the plugin, so a server can match it:

- Values: numbers, text, booleans, dates; blank (`null`, `undefined`, `''`); errors (`#DIV/0!`, `#VALUE!`, `#NUM!`, `#N/A`, …).
- Coercions: to number (blank 0, `TRUE` 1, numeric text its number, other text `#VALUE!`), to text (numbers with 15 significant digits, booleans `TRUE` / `FALSE`, dates `YYYY-MM-DD[ hh:mm:ss]`), comparisons (as the comparison operators do in `engine/`), `&` joins text.
- Sorting: by the value; errors (the accessor's `undefined`) and blanks sort last in both directions, as `undefined` does in the table.
- Filters: the column's `ColumnFilter` applies to the formula's value; errors count as empty.
- Quick filter and text filters: the value's text as core's `textOf()` gives it (`packages/core/src/filters/filter.ts`: numbers as `String(n)`, booleans `true` / `false`, dates as their ISO day), which is what the table matches with `data`. Not the cell's text (`display()` in `columns.ts`), which shows dates in the browser's locale, so a server couldn't reproduce it, and switching between `data` and a `dataSource` would give different rows. (My call.)
- Dates: in the time zone `formulaTrees()` reports.
- Functions: a table of the built-ins (`engine/functions/`): name, arguments and one line on what each returns, plus a short list of behaviours a server can't guess from that: `IF`, `IFERROR`, `AND` and `OR` evaluate lazily (an error in a branch not taken doesn't show), `TODAY()` and the date parts use local time, `DATEDIF`'s units, and the error each function gives for a bad argument where that isn't `#VALUE!`. For exact results the docs point to the source. The app's own `functions` are the app's to implement on the server. Functions that only take whole columns (`SUMIF`, the lookups) are listed as never reaching a server. (My call on the depth: a full per-function specification would be the largest piece of work and need its own tests against the engine.)

The builder writes this section from the engine's code, not from this summary, and checks each rule against a test or the source.

**What the promise covers** (my call, recorded in ADR 0012): the tree format and the `FormulaTrees` shape are public API under ADR 0004 and can only grow. The documented rules describe what the browser computes in the release you use; a fix to the engine may change one in a minor release, and its changelog entry says so. Freezing them would make every engine fix a major release.

### Docs and example

- **Formulas page** (`apps/docs/src/content/docs/features/formulas.mdx`): a section "With a `dataSource`": the switch, `formulaTrees()`, the format, the rules above, what stays unsupported (whole columns, broken formulas), and a short sketch (prose plus a code block, not a runnable example) of turning a tree into a SQL expression for `ORDER BY` / `WHERE`. The server-data guide (`guides/server-data.mdx`) links to it.
- **Example** `apps/docs/src/examples/formulas/data-source/{html,react,vue,angular}`: orders from a pretend server with two formula columns (e.g. `[price] * [quantity]` and an `IF(...)`), sortable and with a number filter, and the header menu. The pretend server (`examples/formulas/server.ts`, shared by the flavours like `examples/filtering/data.ts`) sorts and filters by evaluating `formulaTrees(table).columns` with a small hand-written evaluator for the functions the example uses, written as a server author would (not importing `@argus-table/formulas`' engine), and logs each request like the filtering example does. React, Vue and Angular get the element the way the export examples do (`table.current`, a template ref, `@ViewChild`).
- An e2e spec for the example in `apps/docs/e2e/formulas.spec.ts` (per flavour, like the others): sorting by a formula column reorders the rows; a filter on it narrows them.

### Records

- **ADR 0012** "Formula trees for data sources": the decision (approach B, the switch, the format, refresh), and ADR 0004's list item marked done with a link.
- `docs/plan/plan/09-formula-columns.md`: the open question about the syntax tree marked decided.
- The integrate skill: `references/addons.md:90` ("With a `dataSource`, formula columns don't sort or filter") updated; `scripts/lib/api.mjs` and `references/api.md` get the `server` option and `formulaTrees` (`nx test skills` checks add-on options).
- `CLAUDE.md`'s `packages/formulas` paragraph: one sentence on `server` / `formulaTrees` / the refresh.
- Changeset: `@argus-table/formulas` minor, from the user's point of view.

## Tests

- Node (`columns.node.test.ts` or a new `trees.node.test.ts`): the tree conversion: spans gone, refs resolved by id / header / case / header text, nested formula refs kept as refs, broken and whole-column formulas left out and so are the columns reading them, custom function names upper case.
- Browser (`plugin.test.ts`): with a `dataSource`, `server: false` drops `sortable` / `filter` (as today); `server: true` keeps them, except for broken and whole-column columns; `formulaTrees(table)` returns the trees and a time zone; changing the formula of the sorted column calls `refresh()` once (spy), and so does changing a column the sorted one reads; changing a formula while no formula column is sorted or filtered and `quickFilter` is empty doesn't; a table without `formulas()` gives `columns: {}`.
- Docs e2e as above.

## Size

The new code goes in the plugin chunk: `formulaTrees()` is synchronous (`getRows` calls it) and the refresh check runs on every update, so neither can be loaded later. The plan measures it early; if the plugin no longer fits 12.3 kB, raising the budget needs the maintainer's approval first.

## Left to the builder

- Where the tree conversion lives (`engine/` stays DOM-free; the lookup is in `columns.ts`).
- The comparison for refresh (a JSON string of the trees is fine).
- How the example's React, Vue and Angular flavours get the element (within the outline above).
- The example's columns and data, within the outline above.
- The SQL sketch's dialect (generic SQL is fine).
