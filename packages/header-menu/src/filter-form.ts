import { html, nothing, type TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';
import type {
  ColumnFilter,
  ColumnInfo,
  FilterKind,
  FilterValue,
  PluginHost,
  RangeFilterOp,
  TextFilterOp,
} from 'argus-table';

/** Debounce for typed values: the table filters once typing pauses. */
export const FILTER_DEBOUNCE_MS = 250;

/** What the filter form of one column holds while it is open. */
export interface FilterForm {
  columnId: string;
  kind: FilterKind;
  /** The operator of a text, number or date filter. */
  op: TextFilterOp | RangeFilterOp;
  /** The typed value, and the upper bound of `between`, as the inputs hold them. */
  value: string;
  to: string;
  /** For a set filter: the values offered, those checked, and the search text. */
  values: FilterValue[];
  truncated: boolean;
  checked: Set<FilterValue>;
  search: string;
  /** A typed change not applied yet. */
  timer: ReturnType<typeof setTimeout> | undefined;
}

const TEXT_OPS: readonly { op: TextFilterOp; label: string }[] = [
  { op: 'contains', label: 'Contains' },
  { op: 'equals', label: 'Equals' },
  { op: 'startsWith', label: 'Starts with' },
  { op: 'empty', label: 'Is empty' },
  { op: 'notEmpty', label: 'Is not empty' },
];

const NUMBER_OPS: readonly { op: RangeFilterOp; label: string }[] = [
  { op: 'eq', label: 'Equals' },
  { op: 'ne', label: 'Does not equal' },
  { op: 'gt', label: 'Greater than' },
  { op: 'ge', label: 'At least' },
  { op: 'lt', label: 'Less than' },
  { op: 'le', label: 'At most' },
  { op: 'between', label: 'Between' },
  { op: 'empty', label: 'Is empty' },
  { op: 'notEmpty', label: 'Is not empty' },
];

const DATE_OPS: readonly { op: RangeFilterOp; label: string }[] = [
  { op: 'eq', label: 'On' },
  { op: 'ne', label: 'Not on' },
  { op: 'gt', label: 'After' },
  { op: 'ge', label: 'On or after' },
  { op: 'lt', label: 'Before' },
  { op: 'le', label: 'On or before' },
  { op: 'between', label: 'Between' },
  { op: 'empty', label: 'Is empty' },
  { op: 'notEmpty', label: 'Is not empty' },
];

const opsOf = (kind: FilterKind) =>
  kind === 'text' ? TEXT_OPS : kind === 'number' ? NUMBER_OPS : DATE_OPS;

/** Whether an operator takes no value. */
const valueless = (op: string) => op === 'empty' || op === 'notEmpty';

/** A set value as the list shows it. */
const setLabel = (value: FilterValue) => (value === null ? '(Empty)' : String(value));

/**
 * A form for a column's filter, filled from the filter it has. `undefined` when the
 * column can't be filtered, or (a set filter) the table can't list its values.
 */
export function startForm<T>(host: PluginHost<T>, column: ColumnInfo): FilterForm | undefined {
  const kind = column.filter;
  if (kind === undefined) return undefined;
  const current = column.columnFilter?.kind === kind ? column.columnFilter : undefined;
  const form: FilterForm = {
    columnId: column.id,
    kind,
    op: kind === 'text' ? 'contains' : 'eq',
    value: '',
    to: '',
    values: [],
    truncated: false,
    checked: new Set(),
    search: '',
    timer: undefined,
  };
  if (kind === 'set') {
    const list = host.filterValues(column.id);
    if (!list) return undefined;
    form.values = list.values;
    form.truncated = list.truncated;
    form.checked = new Set(current?.kind === 'set' ? current.values : list.values);
    return form;
  }
  if (current && current.kind !== 'set') {
    form.op = current.op;
    form.value = current.value === undefined ? '' : String(current.value);
    if (current.kind !== 'text') form.to = current.to === undefined ? '' : String(current.to);
  }
  return form;
}

/**
 * The filter a form describes, or `undefined` when it keeps every row (no value to
 * match, every value of a set checked): the column is then not filtered.
 */
export function filterOf(form: FilterForm): ColumnFilter | undefined {
  const { kind, op } = form;
  if (kind === 'set') {
    // Every value listed checked keeps every row, even past a truncated list.
    const all = form.values.every((v) => form.checked.has(v));
    return all ? undefined : { kind, values: form.values.filter((v) => form.checked.has(v)) };
  }
  if (kind === 'text') {
    const textOp = op as TextFilterOp;
    if (valueless(op)) return { kind, op: textOp };
    return form.value === '' ? undefined : { kind, op: textOp, value: form.value };
  }
  const rangeOp = op as RangeFilterOp;
  if (valueless(op)) return { kind, op: rangeOp };
  const read = (text: string) => (kind === 'number' ? numberOf(text) : text || undefined);
  const value = read(form.value);
  const to = op === 'between' ? read(form.to) : undefined;
  if (value === undefined && to === undefined) return undefined;
  return kind === 'number'
    ? { kind, op: rangeOp, value: value as number | undefined, to: to as number | undefined }
    : { kind, op: rangeOp, value: value as string | undefined, to: to as string | undefined };
}

function numberOf(text: string): number | undefined {
  if (text.trim() === '') return undefined;
  const n = Number(text);
  return Number.isNaN(n) ? undefined : n;
}

/** What the form needs from the menu: where its labels come from and how it acts. */
export interface FormContext {
  /** The column's label, for the form's name. */
  label: string;
  /** A prefix for the ids of the form's fields. */
  id: string;
  /** Applies the form now (a change that shouldn't wait). */
  apply(): void;
  /** Applies the form once typing pauses. */
  applySoon(): void;
  /** Renders the form again (an operator or the search changed). */
  rerender(): void;
  /** Closes the form; with `focusHeader`, focus goes back to the column's header. */
  close(focusHeader: boolean): void;
  /** Clears the column's filter and closes the form. */
  clear(): void;
}

/** The filter form: a non-modal dialog in a popover, under the header's menu button. */
export function renderForm(form: FilterForm, ctx: FormContext): TemplateResult {
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      ctx.close(true);
    } else if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') {
      const type = (event.target as HTMLInputElement).type;
      if (type === 'checkbox') return;
      event.preventDefault();
      ctx.apply();
      ctx.close(true);
    }
  };
  return html`<div
    class="argus-header-filter"
    popover="auto"
    role="dialog"
    aria-label=${`Filter ${ctx.label}`}
    data-column=${form.columnId}
    @keydown=${onKeydown}
    @toggle=${(event: Event) => {
      // Light dismiss: a press outside the form.
      if ((event as ToggleEvent).newState === 'closed') ctx.close(false);
    }}
  >
    ${form.kind === 'set' ? setFields(form, ctx) : conditionFields(form, ctx)}
    <div class="argus-header-filter-actions">
      <button
        type="button"
        class="argus-header-filter-button"
        @click=${() => {
          ctx.clear();
        }}
      >
        Clear
      </button>
      <button
        type="button"
        class="argus-header-filter-button"
        @click=${() => {
          ctx.apply();
          ctx.close(true);
        }}
      >
        Done
      </button>
    </div>
  </div>`;
}

/** An operator and one or two values: text, number and date filters. */
function conditionFields(form: FilterForm, ctx: FormContext): TemplateResult {
  const type = form.kind === 'number' ? 'number' : form.kind === 'date' ? 'date' : 'text';
  const input = (key: 'value' | 'to', label: string) =>
    html`<label class="argus-header-filter-field"
      >${label}
      <input
        type=${type}
        step=${type === 'number' ? 'any' : nothing}
        .value=${live(form[key])}
        @input=${(event: Event) => {
          form[key] = (event.target as HTMLInputElement).value;
          // A date picker sends one input per pick: no typing to wait for.
          if (type === 'date') ctx.apply();
          else ctx.applySoon();
        }}
    /></label>`;
  return html`<label class="argus-header-filter-field"
      >Condition
      <select
        .value=${live(form.op)}
        @change=${(event: Event) => {
          form.op = (event.target as HTMLSelectElement).value as FilterForm['op'];
          ctx.apply();
          ctx.rerender();
        }}
      >
        ${opsOf(form.kind).map(
          ({ op, label }) =>
            html`<option value=${op} ?selected=${op === form.op}>${label}</option>`,
        )}
      </select></label
    >
    ${
      valueless(form.op)
        ? nothing
        : form.op === 'between'
          ? html`${input('value', 'From')}${input('to', 'To')}`
          : input('value', 'Value')
    }`;
}

/** A searchable list of checkboxes: set filters. */
function setFields(form: FilterForm, ctx: FormContext): TemplateResult {
  const needle = form.search.toLowerCase();
  const shown = needle
    ? form.values.filter((v) => setLabel(v).toLowerCase().includes(needle))
    : form.values;
  const checkedCount = shown.filter((v) => form.checked.has(v)).length;
  const listId = `${ctx.id}-values`;
  return html`<label class="argus-header-filter-field"
      >Search values
      <input
        type="search"
        .value=${live(form.search)}
        @input=${(event: Event) => {
          form.search = (event.target as HTMLInputElement).value;
          ctx.rerender();
        }}
    /></label>
    <label class="argus-header-filter-check argus-header-filter-all"
      ><input
        type="checkbox"
        aria-controls=${listId}
        .checked=${live(shown.length > 0 && checkedCount === shown.length)}
        .indeterminate=${live(checkedCount > 0 && checkedCount < shown.length)}
        @change=${(event: Event) => {
          const on = (event.target as HTMLInputElement).checked;
          for (const v of shown) {
            if (on) form.checked.add(v);
            else form.checked.delete(v);
          }
          ctx.apply();
          ctx.rerender();
        }}
      />${needle ? 'Select all shown' : 'Select all'}</label
    >
    <div class="argus-header-filter-values" id=${listId} role="group" aria-label="Values">
      ${shown.map(
        (v) =>
          html`<label class="argus-header-filter-check"
            ><input
              type="checkbox"
              .checked=${live(form.checked.has(v))}
              @change=${(event: Event) => {
                if ((event.target as HTMLInputElement).checked) form.checked.add(v);
                else form.checked.delete(v);
                ctx.apply();
                ctx.rerender();
              }}
            />${setLabel(v)}</label
          >`,
      )}
      ${shown.length === 0 ? html`<p class="argus-header-filter-note">No values</p>` : nothing}
    </div>
    ${
      form.truncated
        ? html`<p class="argus-header-filter-note">
            Showing the first ${String(form.values.length)} values
          </p>`
        : nothing
    }`;
}
