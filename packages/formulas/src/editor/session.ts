import type { ColumnDef, PluginHost } from 'argus-table';
import {
  compileColumns,
  display,
  formulaRefs,
  lookupOf,
  nameOf,
  parseOrError,
  readerOf,
  rowSource,
  type FormulaFunction,
} from '../columns.js';
import { compile } from '../engine/compile.js';
import { FormulaSyntaxError, isFormulaError } from '../engine/errors.js';
import type { FunctionTable } from '../engine/functions/index.js';
import { analyze } from '../engine/graph.js';
import { nodesOf, refsOf, type FormulaNode } from '../engine/parse.js';
import { tokenize } from '../engine/tokenize.js';
import { DOCS, type FunctionDoc } from './docs.js';
import { openEditor, type PreviewTable } from './editor.js';
import { EDITOR_LABELS } from './labels.js';
import { resolveLabels, type FormulasEditorLabels, type FormulasLabels } from '../labels.js';

// What the plugin loads when the editor first opens: the editor, and the
// checks, preview and column changes around it.

/** What's wrong with a formula, and where: the part to underline. */
export interface Problem {
  message: string;
  start: number;
  end: number;
}

/**
 * The first problem with column `id`'s formula among `defs` (which hold it),
 * for the editor: a syntax error, an unknown function or column, a wrong number
 * of arguments, or a cycle. `undefined` when it's fine.
 */
export function checkFormula<T>(
  defs: readonly ColumnDef<T, unknown>[],
  id: string,
  functions: FunctionTable,
): Problem | undefined {
  const formula = defs.find((d) => d.id === id)?.formula ?? '';
  const tree = parseOrError(formula);
  if (tree instanceof FormulaSyntaxError) {
    return { message: tree.message, start: tree.start, end: tree.end };
  }
  const lookup = lookupOf(defs);
  // The first unknown column or function, left to right.
  for (const n of nodesOf(tree)) {
    if ((n.type === 'ref' || n.type === 'range') && !lookup(n.name)) {
      const written = n.type === 'ref' ? `[${n.name}]` : `[[${n.name}]]`;
      return { message: `There is no column ${written}.`, start: n.start, end: n.end };
    }
    if (n.type === 'call' && !functions[n.name]) {
      return {
        message: `There is no function ${n.name}.`,
        start: n.start,
        end: n.start + n.name.length,
      };
    }
  }
  try {
    compile(tree, { functions, ref: () => () => undefined });
  } catch (error) {
    if (!(error instanceof FormulaSyntaxError)) throw error;
    return { message: error.message, start: error.start, end: error.end };
  }
  const uses = new Map<string, string[]>();
  for (const def of defs) {
    if (def.formula === undefined) continue;
    const t = def.id === id ? tree : parseOrError(def.formula);
    if (t instanceof FormulaSyntaxError) continue;
    uses.set(def.id, formulaRefs(t, lookup));
  }
  if (analyze(uses).cyclic.has(id)) {
    return {
      message: 'The formula depends on its own result.',
      start: 0,
      end: formula.length,
    };
  }
  return undefined;
}

const TOTALS = new Set(['SUM', 'MIN', 'MAX', 'AVERAGE', 'COUNT', 'COUNTA', 'COUNTBLANK']);

/**
 * A note on a formula that is fine but likely not what was meant: a total of a
 * single value of the row (`SUM([amount])`), where the whole column was meant.
 */
export function noteOn(
  formula: string,
  labels: Pick<FormulasEditorLabels, 'rowValueTotal'> = EDITOR_LABELS,
): string | undefined {
  const tree = parseOrError(formula);
  if (tree instanceof FormulaSyntaxError) return undefined;
  for (const n of nodesOf(tree)) {
    if (n.type !== 'call' || !TOTALS.has(n.name) || n.args.length !== 1) continue;
    const [only] = n.args;
    if (only?.type === 'ref') {
      return labels.rowValueTotal({ fn: n.name, column: only.name });
    }
  }
  return undefined;
}

/** The id of the column being added, in the preview and the checks. */
const DRAFT = '\u0000new';
const PREVIEW_ROWS = 5;

/** An id for a new column from its name: `gross`, `gross-2`… */
function newId<T>(name: string, defs: readonly ColumnDef<T, unknown>[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'formula';
  const taken = new Set(defs.map((d) => d.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${String(n)}`;
  return id;
}

/**
 * The columns with each formula name that led to column `id` by its old header
 * renamed to `name`. Names by id stay as they are.
 */
function renameRefs<T>(
  defs: readonly ColumnDef<T, unknown>[],
  id: string,
  name: string,
): ColumnDef<T, unknown>[] {
  const lookup = lookupOf(defs);
  return defs.map((def) => {
    if (def.formula === undefined || def.id === id) return def;
    const source = def.formula;
    let out = '';
    let at = 0;
    for (const token of tokenize(source, true)) {
      if (token.kind !== 'ref' && token.kind !== 'range') continue;
      if (token.value === id || lookup(token.value)?.id !== id) continue;
      const written = token.kind === 'ref' ? `[${name}]` : `[[${name}]]`;
      out += `${source.slice(at, token.start)}${written}`;
      at = token.end;
    }
    return at ? { ...def, formula: out + source.slice(at) } : def;
  });
}

function checkName<T>(
  defs: readonly ColumnDef<T, unknown>[],
  columnId: string | undefined,
  name: string,
  labels: FormulasEditorLabels,
): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return labels.nameMissing;
  if (/[[\]]/.test(trimmed)) return labels.nameBrackets;
  const lower = trimmed.toLowerCase();
  const clash = defs.find(
    (d) => d.id !== columnId && (nameOf(d).toLowerCase() === lower || d.id.toLowerCase() === lower),
  );
  return clash ? labels.nameTaken({ name: trimmed }) : undefined;
}

export type Mode = 'add' | 'edit' | 'view';

export interface Session<T> {
  host: PluginHost<T>;
  /** The columns as the plugin got them. */
  defs: readonly ColumnDef<T, unknown>[];
  mode: Mode;
  /** The column the editor opened from: the one edited, or the one to add after. */
  columnId: string;
  focus: 'name' | 'formula';
  container: HTMLElement;
  functions: FunctionTable;
  own: Readonly<Record<string, FormulaFunction>>;
  parse: (formula: string) => FormulaNode | FormulaSyntaxError;
  /** The labels given to `formulas()`; the editor's own go over its defaults. */
  labels: Partial<FormulasLabels>;
}

/** A change the user saved, for the plugin to propose through its events. */
export type Outcome<T> =
  | { kind: 'add'; column: ColumnDef<T, unknown>; columns: ColumnDef<T, unknown>[] }
  | {
      kind: 'change';
      column: ColumnDef<T, unknown>;
      previous: ColumnDef<T, unknown>;
      columns: ColumnDef<T, unknown>[];
    };

/** The columns with the draft in place: added after the column, or replacing it. */
function withDraft<T>(
  session: Session<T>,
  name: string,
  formula: string,
): { defs: ColumnDef<T, unknown>[]; id: string } {
  const { defs, mode, columnId } = session;
  if (mode !== 'add') {
    return {
      defs: defs.map((d) => (d.id === columnId ? { ...d, header: name.trim(), formula } : d)),
      id: columnId,
    };
  }
  const at = defs.findIndex((d) => d.id === columnId);
  const out = [...defs];
  out.splice(at < 0 ? out.length : at + 1, 0, { id: DRAFT, header: name.trim(), formula });
  return { defs: out, id: DRAFT };
}

/**
 * The first rows (in the table's order) with the formula's result: the first
 * column, up to two columns the formula names, and the result.
 */
function preview<T>(
  session: Session<T>,
  defs: ColumnDef<T, unknown>[],
  id: string,
  labels: FormulasEditorLabels,
): PreviewTable {
  const { host } = session;
  const compiled = compileColumns(defs, {
    functions: session.functions,
    parse: session.parse,
    rows: rowSource(host),
  });
  const draft = compiled.get(id);
  const lookup = lookupOf(defs);
  const draftDef = defs.find((d) => d.id === id);
  const tree = session.parse(draftDef?.formula ?? '');
  const first = defs.find((d) => d.id !== id);
  const shown: ColumnDef<T, unknown>[] = first ? [first] : [];
  if (!(tree instanceof FormulaSyntaxError)) {
    for (const name of refsOf(tree)) {
      const target = lookup(name);
      if (target && target.id !== id && !shown.includes(target) && shown.length < 3) {
        shown.push(target);
      }
    }
  }
  const rows: T[] = [];
  for (let i = 0; i < PREVIEW_ROWS; i++) {
    const row = host.row(i);
    if (row === undefined) break;
    rows.push(row);
  }
  const cell = (value: unknown) =>
    isFormulaError(value) ? { text: value.code, error: value.message } : { text: display(value) };
  const valueOf = (def: ColumnDef<T, unknown>, row: T, index: number) => {
    const c = compiled.get(def.id);
    return c ? c.result(row, index) : readerOf(def)({ row, index });
  };
  const numeric = (def: ColumnDef<T, unknown>) => {
    const type = compiled.get(def.id)?.type;
    return type === 'number' || type === 'date' || def.align === 'end';
  };
  const draftName = draftDef && typeof draftDef.header === 'string' ? draftDef.header : '';
  return {
    columns: [
      ...shown.map((def) => ({ label: nameOf(def), numeric: numeric(def), draft: false })),
      {
        label: session.mode === 'add' ? labels.newColumn({ name: draftName }) : draftName || id,
        numeric: draft?.type === 'number' || draft?.type === 'date',
        draft: true,
      },
    ],
    rows: rows.map((row, index) => [
      ...shown.map((def) => cell(valueOf(def, row, index))),
      // A formula that can't be read yet (still being typed) shows nothing.
      cell(draft && !(tree instanceof FormulaSyntaxError) ? draft.result(row, index) : undefined),
    ]),
    type: draft?.type,
  };
}

/** Opens the editor and resolves with the change the user saved, if any. */
export async function edit<T>(session: Session<T>): Promise<Outcome<T> | undefined> {
  const { defs, mode, columnId, functions } = session;
  const current = defs.find((d) => d.id === columnId);
  if (!current) return undefined;
  const labels = resolveLabels(EDITOR_LABELS, session.labels);
  const docs: Record<string, FunctionDoc> = { ...DOCS };
  for (const [name, fn] of Object.entries(session.own)) {
    docs[name.toUpperCase()] = {
      group: 'Yours',
      params: fn.params ?? [],
      description: fn.description ?? '',
    };
  }
  const result = await openEditor({
    mode,
    labels,
    focus: session.focus,
    name: mode === 'add' ? '' : nameOf(current),
    formula: mode === 'add' ? '' : (current.formula ?? ''),
    container: session.container,
    columns: defs.filter((d) => mode === 'add' || d.id !== columnId).map(nameOf),
    functions: Object.keys(functions).sort(),
    docs,
    check(name, formula) {
      const draft = withDraft(session, name, formula);
      return {
        name: checkName(defs, mode === 'add' ? undefined : columnId, name, labels),
        formula: formula.trim()
          ? checkFormula(draft.defs, draft.id, functions)
          : { message: labels.formulaMissing, start: 0, end: 0 },
        note: noteOn(formula, labels),
      };
    },
    preview(name, formula) {
      const draft = withDraft(session, name, formula);
      return preview(session, draft.defs, draft.id, labels);
    },
  });
  if (!result || mode === 'view') return undefined;

  if (mode === 'add') {
    const column: ColumnDef<T, unknown> = {
      id: newId(result.name, defs),
      header: result.name,
      formula: result.formula,
      sortable: true,
    };
    const at = defs.indexOf(current) + 1;
    return { kind: 'add', column, columns: [...defs.slice(0, at), column, ...defs.slice(at)] };
  }
  const renamed = result.name !== nameOf(current);
  if (!renamed && result.formula === current.formula) return undefined;
  const column: ColumnDef<T, unknown> = {
    ...current,
    header: renamed ? result.name : current.header,
    formula: result.formula,
  };
  // Other formulas' names resolve against the old columns, where the old header still leads here.
  const columns = (renamed ? renameRefs(defs, columnId, result.name) : defs).map((d) =>
    d.id === columnId ? column : d,
  );
  return { kind: 'change', column, previous: current, columns };
}
