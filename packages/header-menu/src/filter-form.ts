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
import type { HeaderMenuLabels } from './labels.js';

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

const TEXT_OPS: readonly TextFilterOp[] = ['contains', 'equals', 'startsWith', 'empty', 'notEmpty'];

const RANGE_OPS: readonly RangeFilterOp[] = [
  'eq',
  'ne',
  'gt',
  'ge',
  'lt',
  'le',
  'between',
  'empty',
  'notEmpty',
];

/** A kind's operators, with their labels. */
const opsOf = (kind: FilterKind, labels: HeaderMenuLabels) => {
  if (kind === 'text') return TEXT_OPS.map((op) => ({ op, label: labels.textOperators[op] }));
  const names = kind === 'number' ? labels.numberOperators : labels.dateOperators;
  return RANGE_OPS.map((op) => ({ op, label: names[op] }));
};

/** Whether an operator takes no value. */
const valueless = (op: string) => op === 'empty' || op === 'notEmpty';

/** A set value as the list shows it. */
const setLabel = (value: FilterValue, labels: HeaderMenuLabels) =>
  value === null ? labels.emptyValue : String(value);

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
  /** The menu's text. */
  labels: HeaderMenuLabels;
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
    aria-label=${ctx.labels.filterDialog({ column: ctx.label })}
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
        ${ctx.labels.clear}
      </button>
      <button
        type="button"
        class="argus-header-filter-button"
        @click=${() => {
          ctx.apply();
          ctx.close(true);
        }}
      >
        ${ctx.labels.done}
      </button>
    </div>
  </div>`;
}

/** An operator and one or two values: text, number and date filters. */
function conditionFields(form: FilterForm, ctx: FormContext): TemplateResult {
  const type = form.kind === 'number' ? 'number' : form.kind === 'date' ? 'date' : 'text';
  const { labels } = ctx;
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
      >${labels.condition}
      <select
        .value=${live(form.op)}
        @change=${(event: Event) => {
          form.op = (event.target as HTMLSelectElement).value as FilterForm['op'];
          ctx.apply();
          ctx.rerender();
        }}
      >
        ${opsOf(form.kind, labels).map(
          ({ op, label }) =>
            html`<option value=${op} ?selected=${op === form.op}>${label}</option>`,
        )}
      </select></label
    >
    ${
      valueless(form.op)
        ? nothing
        : form.op === 'between'
          ? html`${input('value', labels.from)}${input('to', labels.to)}`
          : input('value', labels.value)
    }`;
}

/** A searchable list of checkboxes: set filters. */
function setFields(form: FilterForm, ctx: FormContext): TemplateResult {
  const { labels } = ctx;
  const needle = form.search.toLowerCase();
  const shown = needle
    ? form.values.filter((v) => setLabel(v, labels).toLowerCase().includes(needle))
    : form.values;
  const checkedCount = shown.filter((v) => form.checked.has(v)).length;
  const listId = `${ctx.id}-values`;
  return html`<label class="argus-header-filter-field"
      >${labels.searchValues}
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
      />${needle ? labels.selectAllShown : labels.selectAll}</label
    >
    <div class="argus-header-filter-values" id=${listId} role="group" aria-label=${labels.values}>
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
            />${setLabel(v, labels)}</label
          >`,
      )}
      ${
        shown.length === 0
          ? html`<p class="argus-header-filter-note">${labels.noValues}</p>`
          : nothing
      }
    </div>
    ${
      form.truncated
        ? html`<p class="argus-header-filter-note">
            ${labels.valuesLimited({ count: form.values.length })}
          </p>`
        : nothing
    }`;
}
