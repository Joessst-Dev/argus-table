import { html, nothing, type TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';
import type { ArgusPlugin, CellContext, ColumnDef, PluginHost, RowSection } from 'argus-table';
import { resolveLabels, type EditingLabels } from './labels.js';
import { adoptStyles } from './styles.js';
import type {
  CellEditDetail,
  CellEditingOptions,
  ColumnEditOptions,
  CustomEditor,
  EditorKind,
  SelectOption,
} from './types.js';

type Def<T> = ColumnDef<T, unknown>;

/** The editors with an editing mode: the built-in ones but the checkbox, or a custom one. */
type Kind = Exclude<EditorKind, 'checkbox'> | 'custom';

/** The cell being edited. */
interface Editing<T> {
  section: RowSection;
  index: number;
  rowId: string;
  columnId: string;
  row: T;
  previous: unknown;
  kind: Kind;
  options: readonly SelectOption[];
  custom: CustomEditor<T> | undefined;
  /** The text and number editors' text; the date editor's `yyyy-mm-dd`; the select editor's option index (`''`: none). */
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

/** How editing starts: from the value, or from a text (a typed character, or empty). */
type Start = { value: true } | { text: string };

/** What a custom editor's first focusable element can be. */
const FOCUSABLE =
  'input, select, textarea, button, [tabindex]:not([tabindex="-1"]), [contenteditable]';

/**
 * Content whose double-click is its own, not the cell's: a tree row's toggle
 * (a button) and controls a column's `cell` renders.
 */
const INTERACTIVE = 'button,input,select,textarea,a[href],label,[contenteditable]';

/** Whether an event's path reaches interactive content before the cell it is in. */
function fromInteractive(event: Event): boolean {
  for (const target of event.composedPath()) {
    if (!(target instanceof Element) || target.getAttribute('role') === 'gridcell') return false;
    if (target.matches(INTERACTIVE)) return true;
  }
  return false;
}

let tables = 0;

/**
 * Cell editing (ADR 0009). Columns opt in with `meta: { edit: true }` or
 * `meta: { edit: { … } }` (`ColumnEditOptions`). Enter, F2, a typed character,
 * Delete or Backspace, or a double-click opens the cell's editor; Enter commits
 * and moves down, Tab commits and moves to the next editable column, Escape
 * cancels, and leaving the editor commits. A checkbox column toggles with a
 * click, Enter, F2 or Space.
 *
 * A commit fires `argus-cell-edit` on the table with `detail: { row, rowId,
 * index, columnId, value, previous, pinned?, depth? }`. Neither the table nor
 * the plugin changes `data`: apply the edit yourself, e.g. with `applyEdit()`.
 * An edit that leaves the value as it was fires nothing. One plugin can serve
 * several tables.
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
        if (!target || target.section === 'header' || fromInteractive(event)) return;
        const editing = state.editing;
        if (editing?.columnId === target.columnId && editing.rowId === target.rowId) return;
        const def = state.defs.get(target.columnId);
        const edit = editOptionsOf(def);
        // A checkbox toggles with a click on it.
        if (!def || !edit || kindOf(def, edit) === 'checkbox') return;
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
      const def = state.defs.get(target.columnId);
      const edit = editOptionsOf(def);
      if (!def || !edit) return false;
      const { key } = event;
      if (kindOf(def, edit) === 'checkbox') {
        if (key !== 'Enter' && key !== 'F2' && key !== ' ') return false;
        event.preventDefault();
        toggle(state, target.section, target.rowIndex, target.columnId);
        return true;
      }
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

function kindOf<T>(def: Def<T>, edit: ColumnEditOptions<T>): EditorKind | 'custom' {
  const { editor } = edit;
  if (typeof editor === 'function') return 'custom';
  if (editor) return editor;
  if (def.filter === 'number') return 'number';
  if (def.filter === 'date') return 'date';
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

/** A value as the date editor holds it: `yyyy-mm-dd` (a `Date` in local time), else `''`. */
function dateText(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${String(value.getFullYear()).padStart(4, '0')}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '';
}

/**
 * The date editor's `yyyy-mm-dd` as a value of the kind the column had: a
 * string for a string, else a `Date` at local midnight; `null` when empty.
 */
function parseDate(text: string, previous: unknown): unknown {
  if (text === '') return null;
  if (typeof previous === 'string') return text;
  const [y = 0, m = 1, d = 1] = text.split('-').map(Number);
  return new Date(y, m - 1, d);
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

/** An editor's or checkbox's accessible name: "Quantity, row 12". */
function labelOf<T>(state: TableState<T>, columnId: string, index: number): string {
  const def = state.defs.get(columnId);
  return state.labels.editor({
    column: def ? nameOf(state.host, def) : columnId,
    row: index + 1,
  });
}

/**
 * An editable column's `cell`: the editor in the cell being edited; elsewhere
 * the column's own content, or the default text (a checkbox column without a
 * `cell` of its own: a checkbox a click toggles).
 */
function cellFor<T>(state: TableState<T>, def: Def<T>) {
  return (row: T, context: CellContext<T>): unknown => {
    const section = context.pinned ?? 'body';
    const editing = state.editing;
    if (
      editing?.columnId === context.columnId &&
      editing.rowId === context.rowId &&
      editing.section === section
    ) {
      return editorOf(state, editing);
    }
    if (def.cell) return state.host.content(def.cell(row, context));
    const edit = editOptionsOf(def);
    if (edit && kindOf(def, edit) === 'checkbox') {
      return html`<input
        type="checkbox"
        class="argus-edit-check"
        tabindex="-1"
        aria-label=${labelOf(state, context.columnId, context.index)}
        ?disabled=${edit.editable ? !edit.editable(row) : false}
        .checked=${live(Boolean(context.value))}
        @click=${() => {
          toggle(state, section, context.index, context.columnId);
        }}
      />`;
    }
    return textOf(context.value);
  };
}

function editorOf<T>(state: TableState<T>, editing: Editing<T>): TemplateResult {
  const { host } = state;
  const label = labelOf(state, editing.columnId, editing.index);
  const errorId = `${state.id}-error`;
  const invalid = editing.error !== undefined;
  const custom = editing.kind === 'custom';
  const onFocusout = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (next instanceof Node && (event.currentTarget as Element).contains(next)) return;
    if (state.editing !== editing) return;
    // A custom editor's value is its own: leaving it without commit() cancels.
    if (custom) close(state, undefined);
    else commit(state, undefined);
  };
  const onInput = (event: Event) => {
    editing.draft = (event.target as HTMLInputElement | HTMLSelectElement).value;
    if (editing.error === undefined) return;
    editing.error = undefined;
    host.requestUpdate();
  };
  const describedBy = invalid ? errorId : nothing;
  let control: unknown;
  if (editing.kind === 'custom' && editing.custom) {
    control = host.content(
      editing.custom({
        value: editing.previous,
        row: editing.row,
        rowId: editing.rowId,
        columnId: editing.columnId,
        label,
        commit: (value) => {
          if (state.editing === editing) finish(state, editing, value, undefined, 'stay');
        },
        cancel: () => {
          if (state.editing === editing) close(state, 'stay');
        },
      }),
    );
  } else if (editing.kind === 'select') {
    control = html`<select
      class="argus-edit-input"
      aria-label=${label}
      aria-invalid=${invalid ? 'true' : 'false'}
      aria-describedby=${describedBy}
      @change=${onInput}
    >
      ${editing.draft === '' ? html`<option value="" selected></option>` : nothing}
      ${editing.options.map(
        (option, i) =>
          html`<option value=${String(i)} ?selected=${editing.draft === String(i)}>
            ${option.label}
          </option>`,
      )}
    </select>`;
  } else {
    control = html`<input
      class="argus-edit-input"
      type=${editing.kind === 'date' ? 'date' : 'text'}
      inputmode=${editing.kind === 'number' ? 'decimal' : nothing}
      autocomplete="off"
      aria-label=${label}
      aria-invalid=${invalid ? 'true' : 'false'}
      aria-describedby=${describedBy}
      .value=${live(editing.draft)}
      @input=${onInput}
    />`;
  }
  return html`<div
    class="argus-edit"
    data-argus-edit=${state.id}
    @keydown=${(event: KeyboardEvent) => {
      keyInEditor(state, editing, event);
    }}
    @focusout=${onFocusout}
  >
    ${control}
    ${
      invalid
        ? html`<div class="argus-edit-error" id=${errorId} popover="manual">${editing.error}</div>`
        : nothing
    }
  </div>`;
}

/**
 * Enter commits (and moves), Tab commits and moves along the row, Escape
 * cancels. A custom editor handles Enter and Tab itself: only Escape is ours.
 */
function keyInEditor<T>(state: TableState<T>, editing: Editing<T>, event: KeyboardEvent): void {
  if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    close(state, 'stay');
    return;
  }
  if (editing.kind === 'custom') return;
  if (event.key === 'Enter') {
    event.preventDefault();
    commit(state, state.enterMoves ? (event.shiftKey ? 'up' : 'down') : 'stay');
  } else if (event.key === 'Tab') {
    event.preventDefault();
    commit(state, event.shiftKey ? 'previous' : 'next');
  }
}

/** The open editor's wrapper, if it is rendered. */
function editorRoot<T>(state: TableState<T>): HTMLElement | null {
  return state.host.element.querySelector<HTMLElement>(`[data-argus-edit="${state.id}"]`);
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
    if (editorRoot(state)) return;
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
  const kind = kindOf(def, edit);
  if (kind === 'checkbox') return;
  const previous = host.value(index, columnId, section);
  const options = kind === 'select' ? optionsOf(def, edit) : [];
  let draft = '';
  if (kind === 'select') {
    const at = options.findIndex((o) => Object.is(o.value, previous));
    if (at >= 0) draft = String(at);
  } else if (kind === 'date') {
    draft = 'text' in how && how.text === '' ? '' : dateText(previous);
  } else if (kind !== 'custom') {
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
    custom: typeof edit.editor === 'function' ? edit.editor : undefined,
    draft,
    error: undefined,
  };
  host.requestUpdate();
  await host.element.updateComplete;
  const target = editorRoot(state)?.querySelector<HTMLElement>(FOCUSABLE);
  if (!target) return;
  target.focus();
  if (kind !== 'custom' && target instanceof HTMLInputElement && target.type === 'text') {
    // From the value: all of it selected, to type over. From a character: after it.
    if ('value' in how) target.select();
    else target.setSelectionRange(target.value.length, target.value.length);
  }
}

/** Parses the built-in editor's draft, then finishes the edit with it. */
function commit<T>(state: TableState<T>, move: Move): void {
  const editing = state.editing;
  if (!editing) return;
  const edit = editOptionsOf(state.defs.get(editing.columnId)) ?? {};
  let value: unknown;
  let error: string | undefined;
  if (editing.kind === 'select') {
    const option = editing.draft === '' ? undefined : editing.options[Number(editing.draft)];
    value = option ? option.value : editing.previous;
  } else if (editing.kind === 'date') {
    value = parseDate(editing.draft, editing.previous);
  } else if (edit.parse) {
    value = edit.parse(editing.draft, editing.row);
  } else if (editing.kind === 'number') {
    value = parseNumber(editing.draft);
    if (Number.isNaN(value)) error = state.labels.notANumber;
  } else {
    value = editing.draft;
  }
  finish(state, editing, value, error, move);
}

/**
 * Validates a committed value; with an error the editor stays open and shows
 * it. Else it closes, fires `argus-cell-edit` if the value changed, and moves
 * focus as `move` says.
 */
function finish<T>(
  state: TableState<T>,
  editing: Editing<T>,
  value: unknown,
  error: string | undefined,
  move: Move,
): void {
  const { host } = state;
  const edit = editOptionsOf(state.defs.get(editing.columnId)) ?? {};
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
  const { kind, draft, previous } = editing;
  const unchanged =
    Object.is(value, previous) ||
    (kind === 'date' && draft === dateText(previous)) ||
    ((kind === 'text' || kind === 'number') && draft === textOf(previous));
  if (!unchanged) fire(state, editing, value);
  moveAfter(state, editing, move);
}

/** Fires `argus-cell-edit` for the app to apply. */
function fire<T>(
  state: TableState<T>,
  cell: Pick<Editing<T>, 'row' | 'rowId' | 'index' | 'columnId' | 'previous' | 'section'>,
  value: unknown,
): void {
  const detail: CellEditDetail<T> = {
    row: cell.row,
    rowId: cell.rowId,
    index: cell.index,
    columnId: cell.columnId,
    value,
    previous: cell.previous,
    ...(cell.section === 'body' ? {} : { pinned: cell.section }),
  };
  const el = state.host.element;
  // A body row's level in a tree; no `depth` key without one, as the table's own events.
  if (cell.section === 'body' && !el.dataSource && (el.getSubRows ?? el.getParentId)) {
    detail.depth = state.host.rowDepth(cell.index);
  }
  el.dispatchEvent(new CustomEvent('argus-cell-edit', { detail, bubbles: true, composed: true }));
}

/** A checkbox column's toggle: validated, then fired; no editing mode. */
function toggle<T>(state: TableState<T>, section: RowSection, index: number, columnId: string) {
  const { host } = state;
  const def = state.defs.get(columnId);
  const edit = editOptionsOf(def);
  const row = host.row(index, section);
  const rowId = host.rowId(index, section);
  // The checkbox shows the table's value again until the app applies the change.
  host.requestUpdate();
  if (!def || !edit || row === undefined || rowId === undefined) return;
  if (edit.editable && !edit.editable(row)) {
    host.announce(state.labels.notEditable({ column: nameOf(host, def) }));
    return;
  }
  const previous = host.value(index, columnId, section);
  const value = !previous;
  const error = edit.validate?.(value, row);
  if (error !== undefined) {
    host.announce(error);
    return;
  }
  fire(state, { row, rowId, index, columnId, previous, section }, value);
}

/** Closes the editor without a change; focus goes back to the cell unless it left. */
function close<T>(state: TableState<T>, move: Move): void {
  const editing = state.editing;
  if (!editing) return;
  state.editing = undefined;
  state.host.requestUpdate();
  moveAfter(state, editing, move);
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
  const root = editorRoot(state);
  const message = root?.querySelector<HTMLElement>(':scope > .argus-edit-error');
  if (!root || !message?.isConnected) return;
  if (!message.matches(':popover-open')) message.showPopover();
  const rect = root.getBoundingClientRect();
  message.style.top = `${String(rect.bottom + 2)}px`;
  message.style.left = `${String(rect.left)}px`;
  requestAnimationFrame(() => {
    placeError(state);
  });
}
