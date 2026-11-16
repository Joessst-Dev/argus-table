import { html, nothing, type TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';
import type { ArgusPlugin, CellContext, ColumnDef, PluginHost, RowSection } from 'argus-table';
import { resolveLabels, type EditingLabels } from './labels.js';
import { adoptStyles } from './styles.js';
import type {
  CellEditDetail,
  CellEditingOptions,
  ColumnEditOptions,
  EditorKind,
  SelectOption,
} from './types.js';

type Def<T> = ColumnDef<T, unknown>;

/** The cell being edited. */
interface Editing<T> {
  section: RowSection;
  index: number;
  rowId: string;
  columnId: string;
  row: T;
  previous: unknown;
  kind: EditorKind;
  options: readonly SelectOption[];
  /** The text and number editors' text; the select editor's option index (`''`: none). */
  draft: string;
  error: string | undefined;
}

/** What a table's editing holds, per table (one plugin can serve several). */
interface TableState<T> {
  host: PluginHost<T>;
  /** The definitions the `columns` hook saw, by id. */
  defs: Map<string, Def<T>>;
  editing: Editing<T> | undefined;
  /** Unique per table: the editor's `data-argus-edit` and the message's id. */
  id: string;
  labels: EditingLabels;
  enterMoves: boolean;
  typeToEdit: boolean;
}

/** Where focus goes after a commit: a neighbour, the cell itself, or nowhere (focus left). */
type Move = 'down' | 'up' | 'next' | 'previous' | 'stay' | undefined;

/** How editing starts: from the value, empty, or from a typed character. */
type Start = { value: true } | { text: string };

let tables = 0;

/**
 * Cell editing (ADR 0009). Columns opt in with `meta: { edit: true }` or
 * `meta: { edit: { … } }` (`ColumnEditOptions`). Enter, F2, a typed character,
 * Delete or Backspace, or a double-click opens the cell's editor; Enter commits
 * and moves down, Tab commits and moves to the next editable column, Escape
 * cancels, and leaving the editor commits.
 *
 * A commit fires `argus-cell-edit` on the table with `detail: { row, rowId,
 * index, columnId, value, previous, pinned? }`. Neither the table nor the plugin
 * changes `data`: apply the edit yourself, e.g. with `applyEdit()`. An edit that
 * leaves the value as it was fires nothing. One plugin can serve several tables.
 */
export function cellEditing<T = unknown>(options: CellEditingOptions = {}): ArgusPlugin<T> {
  const states = new WeakMap<HTMLElement, TableState<T>>();
  const labels = resolveLabels(options.labels);

  const stateOf = (host: PluginHost<T>): TableState<T> => {
    let state = states.get(host.element);
    if (!state) {
      tables++;
      state = {
        host,
        defs: new Map(),
        editing: undefined,
        id: `argus-edit-${String(tables)}`,
        labels,
        enterMoves: options.enterMoves !== false,
        typeToEdit: options.typeToEdit !== false,
      };
      states.set(host.element, state);
    }
    return state;
  };

  return {
    name: 'editing',

    connect(host) {
      const state = stateOf(host);
      adoptStyles(host.element);
      const onDblclick = (event: MouseEvent) => {
        const target = host.cellOf(event);
        if (!target || target.section === 'header') return;
        const editing = state.editing;
        if (editing?.columnId === target.columnId && editing.rowId === target.rowId) return;
        if (!editOptionsOf(state.defs.get(target.columnId))) return;
        void start(state, target.section, target.rowIndex, target.columnId, { value: true });
      };
      host.element.addEventListener('dblclick', onDblclick);
      return () => {
        host.element.removeEventListener('dblclick', onDblclick);
        state.editing = undefined;
      };
    },

    columns(defs, host) {
      const state = stateOf(host);
      state.defs = new Map(defs.map((def) => [def.id, def]));
      return defs.map((def) => (editOptionsOf(def) ? { ...def, cell: cellFor(state, def) } : def));
    },

    editable(columnId, host) {
      return editOptionsOf(stateOf(host).defs.get(columnId)) !== undefined;
    },

    keydown(event, target, host) {
      if (target.section === 'header' || event.altKey || event.ctrlKey || event.metaKey) {
        return false;
      }
      const state = stateOf(host);
      if (!editOptionsOf(state.defs.get(target.columnId))) return false;
      const { key } = event;
      let how: Start;
      if (key === 'Enter' || key === 'F2') how = { value: true };
      else if (key === 'Delete' || key === 'Backspace') how = { text: '' };
      // Space stays the table's: it selects rows.
      else if (state.typeToEdit && key.length === 1 && key !== ' ') how = { text: key };
      else return false;
      event.preventDefault();
      void start(state, target.section, target.rowIndex, target.columnId, how);
      return true;
    },
  };
}

/** How a column is edited, or `undefined` if it isn't. Formula columns never are. */
function editOptionsOf<T>(def: Def<T> | undefined): ColumnEditOptions<T> | undefined {
  if (!def || def.formula !== undefined) return undefined;
  const edit = def.meta?.edit;
  if (edit === true) return {};
  return typeof edit === 'object' ? edit : undefined;
}

function kindOf<T>(def: Def<T>, edit: ColumnEditOptions<T>): EditorKind {
  if (edit.editor) return edit.editor;
  if (def.filter === 'number') return 'number';
  return def.filter === 'set' && def.filterOptions?.length ? 'select' : 'text';
}

function optionsOf<T>(def: Def<T>, edit: ColumnEditOptions<T>): readonly SelectOption[] {
  return (
    edit.options ?? (def.filterOptions ?? []).map((value) => ({ value, label: textOf(value) }))
  );
}

/** A value as the text editors show it: the table's default cell text. */
function textOf(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleString();
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- objects are handled above
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** The number editor's text to a number; `null` when empty, `NaN` when it isn't one. */
function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  // A decimal comma (`3,5`) when there is no point.
  return Number.isNaN(value) && !trimmed.includes('.') ? Number(trimmed.replace(',', '.')) : value;
}

/** The column's name for labels: its text header, or its id. */
function nameOf<T>(host: PluginHost<T>, def: Def<T>): string {
  return host.headerText(def) ?? def.id;
}

/** An editable column's `cell`: the editor in the cell being edited, the column's own content elsewhere. */
function cellFor<T>(state: TableState<T>, def: Def<T>) {
  return (row: T, context: CellContext<T>): unknown => {
    const editing = state.editing;
    if (
      editing?.columnId === context.columnId &&
      editing.rowId === context.rowId &&
      editing.section === (context.pinned ?? 'body')
    ) {
      return editorOf(state, editing);
    }
    return def.cell ? state.host.content(def.cell(row, context)) : textOf(context.value);
  };
}

function editorOf<T>(state: TableState<T>, editing: Editing<T>): TemplateResult {
  const { host, labels } = state;
  const def = state.defs.get(editing.columnId);
  const label = labels.editor({
    column: def ? nameOf(host, def) : editing.columnId,
    row: editing.index + 1,
  });
  const errorId = `${state.id}-error`;
  const invalid = editing.error !== undefined;
  const onFocusout = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (next instanceof Node && (event.currentTarget as Element).contains(next)) return;
    if (state.editing === editing) commit(state, undefined);
  };
  const onInput = (event: Event) => {
    editing.draft = (event.target as HTMLInputElement | HTMLSelectElement).value;
    if (editing.error === undefined) return;
    editing.error = undefined;
    host.requestUpdate();
  };
  const select = () => {
    const none = editing.draft === '';
    return html`<select
      class="argus-edit-input"
      aria-label=${label}
      aria-invalid=${invalid ? 'true' : 'false'}
      aria-describedby=${invalid ? errorId : nothing}
      @change=${onInput}
    >
      ${none ? html`<option value="" selected></option>` : nothing}
      ${editing.options.map(
        (option, i) =>
          html`<option value=${String(i)} ?selected=${editing.draft === String(i)}>
            ${option.label}
          </option>`,
      )}
    </select>`;
  };
  return html`<div
    class="argus-edit"
    data-argus-edit=${state.id}
    @keydown=${(event: KeyboardEvent) => {
      keyInEditor(state, event);
    }}
    @focusout=${onFocusout}
  >
    ${
      editing.kind === 'select'
        ? select()
        : html`<input
            class="argus-edit-input"
            type="text"
            inputmode=${editing.kind === 'number' ? 'decimal' : nothing}
            autocomplete="off"
            aria-label=${label}
            aria-invalid=${invalid ? 'true' : 'false'}
            aria-describedby=${invalid ? errorId : nothing}
            .value=${live(editing.draft)}
            @input=${onInput}
          />`
    }
    ${
      invalid
        ? html`<div class="argus-edit-error" id=${errorId} popover="manual">${editing.error}</div>`
        : nothing
    }
  </div>`;
}

/** Enter commits (and moves), Tab commits and moves along the row, Escape cancels. */
function keyInEditor<T>(state: TableState<T>, event: KeyboardEvent): void {
  if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
  switch (event.key) {
    case 'Escape':
      event.preventDefault();
      cancel(state);
      return;
    case 'Enter':
      event.preventDefault();
      commit(state, state.enterMoves ? (event.shiftKey ? 'up' : 'down') : 'stay');
      return;
    case 'Tab':
      event.preventDefault();
      commit(state, event.shiftKey ? 'previous' : 'next');
      return;
  }
}

/** The open editor's input or select, if it is rendered. */
function editorInput<T>(state: TableState<T>): HTMLInputElement | HTMLSelectElement | null {
  return state.host.element.querySelector<HTMLInputElement | HTMLSelectElement>(
    `[data-argus-edit="${state.id}"] > .argus-edit-input`,
  );
}

/** Opens a cell's editor and focuses it once rendered. */
async function start<T>(
  state: TableState<T>,
  section: RowSection,
  index: number,
  columnId: string,
  how: Start,
): Promise<void> {
  const { host } = state;
  if (state.editing) {
    // An editor whose row went away (new data) isn't rendered: drop it.
    if (editorInput(state)) return;
    state.editing = undefined;
  }
  const def = state.defs.get(columnId);
  const edit = editOptionsOf(def);
  const row = host.row(index, section);
  const rowId = host.rowId(index, section);
  if (!def || !edit || row === undefined || rowId === undefined) return;
  if (edit.editable && !edit.editable(row)) {
    host.announce(state.labels.notEditable({ column: nameOf(host, def) }));
    return;
  }
  const previous = host.value(index, columnId, section);
  const kind = kindOf(def, edit);
  const options = kind === 'select' ? optionsOf(def, edit) : [];
  let draft: string;
  if (kind === 'select') {
    const at = options.findIndex((o) => Object.is(o.value, previous));
    draft = at < 0 ? '' : String(at);
  } else {
    draft = 'text' in how ? how.text : textOf(previous);
  }
  state.editing = {
    section,
    index,
    rowId,
    columnId,
    row,
    previous,
    kind,
    options,
    draft,
    error: undefined,
  };
  host.requestUpdate();
  await host.element.updateComplete;
  const input = editorInput(state);
  if (!input) return;
  input.focus();
  if (input instanceof HTMLInputElement) {
    // From the value: all of it selected, to type over. From a character: after it.
    if ('value' in how) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
  }
}

/**
 * Parses and validates the editor's value; with an error it stays open and
 * shows it. Else it closes, fires `argus-cell-edit` if the value changed, and
 * moves focus as `move` says.
 */
function commit<T>(state: TableState<T>, move: Move): void {
  const editing = state.editing;
  if (!editing) return;
  const { host } = state;
  const edit = editOptionsOf(state.defs.get(editing.columnId)) ?? {};
  let value: unknown;
  let error: string | undefined;
  if (editing.kind === 'select') {
    const option = editing.draft === '' ? undefined : editing.options[Number(editing.draft)];
    value = option ? option.value : editing.previous;
  } else if (edit.parse) {
    value = edit.parse(editing.draft, editing.row);
  } else if (editing.kind === 'number') {
    value = parseNumber(editing.draft);
    if (Number.isNaN(value)) error = state.labels.notANumber;
  } else {
    value = editing.draft;
  }
  error ??= edit.validate?.(value, editing.row);
  if (error !== undefined) {
    editing.error = error;
    host.announce(error);
    host.requestUpdate();
    void host.element.updateComplete.then(() => {
      placeError(state);
    });
    return;
  }
  state.editing = undefined;
  host.requestUpdate();
  const unchanged =
    Object.is(value, editing.previous) ||
    (editing.kind !== 'select' && editing.draft === textOf(editing.previous));
  if (!unchanged) {
    const detail: CellEditDetail<T> = {
      row: editing.row,
      rowId: editing.rowId,
      index: editing.index,
      columnId: editing.columnId,
      value,
      previous: editing.previous,
      ...(editing.section === 'body' ? {} : { pinned: editing.section }),
    };
    host.element.dispatchEvent(
      new CustomEvent('argus-cell-edit', { detail, bubbles: true, composed: true }),
    );
  }
  moveAfter(state, editing, move);
}

/** Closes the editor without a change; focus goes back to the cell. */
function cancel<T>(state: TableState<T>): void {
  const editing = state.editing;
  if (!editing) return;
  state.editing = undefined;
  state.host.requestUpdate();
  moveAfter(state, editing, 'stay');
}

/** Focuses the cell a commit moves to (the edited row's id goes with it, through a sort). */
function moveAfter<T>(state: TableState<T>, editing: Editing<T>, move: Move): void {
  if (move === undefined) return;
  const { host } = state;
  let { index, columnId } = editing;
  if (move === 'down') index = Math.min(index + 1, host.rowCount(editing.section) - 1);
  else if (move === 'up') index = Math.max(index - 1, 0);
  else if (move !== 'stay') {
    const ids = host
      .columns()
      .filter((c) => !c.hidden && editOptionsOf(state.defs.get(c.id)))
      .map((c) => c.id);
    columnId = ids[ids.indexOf(columnId) + (move === 'next' ? 1 : -1)] ?? columnId;
  }
  host.focusCell(index, columnId, editing.section);
}

/** Shows the validation message under the editor, following it while it is shown. */
function placeError<T>(state: TableState<T>): void {
  const input = editorInput(state);
  const message = input?.parentElement?.querySelector<HTMLElement>('.argus-edit-error');
  if (!input || !message?.isConnected) return;
  if (!message.matches(':popover-open')) message.showPopover();
  const rect = input.getBoundingClientRect();
  message.style.top = `${String(rect.bottom + 2)}px`;
  message.style.left = `${String(rect.left)}px`;
  requestAnimationFrame(() => {
    placeError(state);
  });
}
