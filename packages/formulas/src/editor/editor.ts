import { html, nothing, render, type TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';
import type { Mode, Problem } from './session.js';
import type { ValueType } from '../engine/functions/index.js';
import { callAt, completionAt, highlight, type Completion } from './assist.js';
import type { FunctionDoc } from './docs.js';
import { adoptEditorStyles } from './styles.js';

/** One cell of the preview: its text, and the explanation when it's an error. */
export interface PreviewCell {
  text: string;
  error?: string;
}

export interface PreviewTable {
  columns: readonly { label: string; numeric: boolean; draft: boolean }[];
  rows: readonly (readonly PreviewCell[])[];
  type: ValueType | undefined;
}

export interface EditorOptions {
  mode: Mode;
  /** The field focused first. */
  focus: 'name' | 'formula';
  name: string;
  formula: string;
  /** Where the dialog goes: inside the table's light DOM, so it inherits the table's tokens. */
  container: HTMLElement;
  /** Names of the columns the formula can use, for the insert buttons and completion. */
  columns: readonly string[];
  /** Function names, upper case. */
  functions: readonly string[];
  docs: Readonly<Record<string, FunctionDoc>>;
  /** What's wrong with the name and the formula as typed, if anything. */
  check(name: string, formula: string): { name?: string; formula?: Problem };
  preview(name: string, formula: string): PreviewTable;
}

export interface EditorResult {
  name: string;
  formula: string;
}

let editors = 0;

const TITLES = { add: 'Add formula column', edit: 'Edit formula column', view: 'Formula column' };
const TYPES: Record<ValueType, string> = {
  number: 'number',
  text: 'text',
  boolean: 'TRUE or FALSE',
  date: 'date',
  unknown: 'depends on the row',
};

const CLOSE_ICON = html`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path
    d="M6 6l12 12M18 6L6 18"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
</svg>`;

/**
 * Opens the formula editor as a modal dialog in `options.container` and
 * resolves with the name and formula when the user saves, or `undefined` when
 * they cancel. The dialog is removed again when it closes.
 */
export function openEditor(options: EditorOptions): Promise<EditorResult | undefined> {
  const { container, mode } = options;
  const readOnly = mode === 'view';
  const ids = `argus-fe-${String(++editors)}`;
  adoptEditorStyles(container);

  let name = options.name;
  let formula = options.formula;
  let cursor = formula.length;
  let completion: Completion | undefined;
  let active = 0;
  /** The user closed the suggestions; they come back with the next edit. */
  let dismissed = true;
  let functionsOpen = false;
  /** Errors show once the user has typed, or tried to save. */
  let touched = mode !== 'add';
  let result: EditorResult | undefined;

  return new Promise((resolve) => {
    const dialog = (): HTMLDialogElement | null =>
      container.querySelector<HTMLDialogElement>(`[id="${ids}"]`);
    const input = (): HTMLInputElement | null =>
      container.querySelector<HTMLInputElement>(`[id="${ids}-formula"]`);

    const sync = () => {
      const field = input();
      const mirror = field?.previousElementSibling;
      if (field && mirror instanceof HTMLElement) mirror.scrollLeft = field.scrollLeft;
    };

    const refresh = () => {
      const field = input();
      if (field) cursor = field.selectionStart ?? formula.length;
      completion =
        readOnly || dismissed
          ? undefined
          : completionAt(formula, cursor, options.columns, options.functions);
      if (active >= (completion?.items.length ?? 0)) active = 0;
      update();
      requestAnimationFrame(sync);
    };

    /** Replaces `from`–`to` of the formula with `text` and puts the cursor after it. */
    const insert = (text: string, from?: number, to?: number) => {
      const field = input();
      if (!field) return;
      field.focus();
      field.setRangeText(
        text,
        from ?? field.selectionStart ?? formula.length,
        to ?? field.selectionEnd ?? formula.length,
        'end',
      );
      formula = field.value;
      touched = true;
      dismissed = !text.endsWith('[');
      refresh();
    };

    const accept = (index: number) => {
      const item = completion?.items[index];
      if (!completion || !item) return;
      insert(item.insert, completion.from, completion.to);
      dismissed = true;
      refresh();
    };

    const submit = () => {
      touched = true;
      const problems = options.check(name, formula);
      if (problems.name || problems.formula) {
        update();
        const target = problems.name ? `${ids}-name` : `${ids}-formula`;
        container.querySelector<HTMLElement>(`[id="${target}"]`)?.focus();
        return;
      }
      result = { name: name.trim(), formula: formula.trim() };
      dialog()?.close();
    };

    const onFormulaKey = (event: KeyboardEvent) => {
      const items = completion?.items ?? [];
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!items.length) {
          if (event.key === 'ArrowDown' && event.altKey) {
            dismissed = false;
            refresh();
            event.preventDefault();
          }
          return;
        }
        event.preventDefault();
        active = (active + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        update();
      } else if ((event.key === 'Enter' || event.key === 'Tab') && items.length) {
        event.preventDefault();
        accept(active);
      } else if (event.key === 'Escape' && items.length) {
        // Closes the suggestions, not the dialog.
        event.preventDefault();
        event.stopPropagation();
        dismissed = true;
        refresh();
      }
    };

    const signature = (): TemplateResult | typeof nothing => {
      if (readOnly) return nothing;
      const call = callAt(formula, cursor);
      const doc = call && options.docs[call.name];
      if (!call || !doc) return nothing;
      // Past a `…`, the arguments before it repeat: SUM's `value`, IFS's pairs.
      const repeat = doc.params.indexOf('…');
      const current =
        repeat > 0 && call.argument >= repeat ? call.argument % repeat : call.argument;
      const params = doc.params.map((param, i) =>
        i === current ? html`<strong>${param}</strong>` : param,
      );
      return html`<div class="argus-formula-hint" id=${`${ids}-hint`}>
        <code>${call.name}(${params.map((p, i) => (i ? html`, ${p}` : p))})</code>
        <span>${doc.description}</span>
      </div>`;
    };

    const mirror = (problem: Problem | undefined) =>
      highlight(formula).map((segment) => {
        const end = segment.start + segment.text.length;
        const bad =
          problem !== undefined &&
          segment.kind !== 'plain' &&
          segment.start < Math.max(problem.end, problem.start + 1) &&
          end > problem.start;
        return html`<span class=${`argus-formula-${segment.kind}${bad ? ' argus-formula-bad' : ''}`}
          >${segment.text}</span
        >`;
      });

    const functionList = () => {
      const groups = new Map<string, string[]>();
      for (const fn of options.functions) {
        const group = options.docs[fn]?.group ?? 'Yours';
        groups.set(group, [...(groups.get(group) ?? []), fn]);
      }
      return html`<div class="argus-formula-functions" id=${`${ids}-functions`}>
        ${[...groups].map(
          ([group, names]) =>
            html`<div role="group" aria-label=${`${group} functions`}>
              <span class="argus-formula-functions-group" aria-hidden="true">${group}</span>
              ${names.map(
                (fn) =>
                  html`<button
                    type="button"
                    class="argus-formula-chip argus-formula-chip-function"
                    title=${options.docs[fn]?.description ?? ''}
                    @click=${() => {
                      insert(`${fn}(`);
                    }}
                  >
                    ${fn}
                  </button>`,
              )}
            </div>`,
        )}
      </div>`;
    };

    const previewTable = (preview: PreviewTable) =>
      preview.rows.length
        ? html`<table class="argus-formula-preview" aria-labelledby=${`${ids}-preview`}>
            <thead>
              <tr>
                ${preview.columns.map(
                  (c) =>
                    html`<th
                      scope="col"
                      class=${c.draft ? 'argus-formula-preview-draft' : ''}
                      data-align=${c.numeric ? 'end' : 'start'}
                    >
                      ${c.label}
                    </th>`,
                )}
              </tr>
            </thead>
            <tbody>
              ${preview.rows.map(
                (row) =>
                  html`<tr>
                    ${row.map(
                      (cell, i) =>
                        html`<td data-align=${preview.columns[i]?.numeric ? 'end' : 'start'}>
                          ${
                            cell.error === undefined
                              ? cell.text
                              : html`<span class="argus-formula-error" title=${cell.error}
                                  >${cell.text}</span
                                >`
                          }
                        </td>`,
                    )}
                  </tr>`,
              )}
            </tbody>
          </table>`
        : html`<p class="argus-formula-note">No rows to preview yet.</p>`;

    const view = (): TemplateResult => {
      const problems = touched ? options.check(name, formula) : {};
      // Not while suggestions are open: the name being typed isn't finished.
      const formulaProblem =
        (formula.trim() || touched) && !completion ? problems.formula : undefined;
      const preview = options.preview(name, formula);
      const items = completion?.items ?? [];
      const listId = `${ids}-list`;
      const hint = signature();
      const describedBy = [
        formulaProblem ? `${ids}-problem` : '',
        hint === nothing ? '' : `${ids}-hint`,
      ]
        .filter(Boolean)
        .join(' ');
      return html`<dialog
        class="argus-formula-editor"
        id=${ids}
        aria-labelledby=${`${ids}-title`}
        @close=${() => {
          render(nothing, container);
          resolve(result);
        }}
      >
        <form
          @submit=${(event: SubmitEvent) => {
            event.preventDefault();
            if (readOnly) dialog()?.close();
            else submit();
          }}
        >
          <div class="argus-formula-editor-head">
            <h2 id=${`${ids}-title`}>${TITLES[mode]}</h2>
            <button
              type="button"
              class="argus-formula-close"
              aria-label="Close"
              @click=${() => dialog()?.close()}
            >
              ${CLOSE_ICON}
            </button>
          </div>

          <div class="argus-formula-row">
            <label for=${`${ids}-name`}>Column name</label>
            <input
              id=${`${ids}-name`}
              type="text"
              autocomplete="off"
              .value=${live(name)}
              ?readonly=${readOnly}
              aria-invalid=${problems.name ? 'true' : 'false'}
              aria-describedby=${problems.name ? `${ids}-name-problem` : nothing}
              @input=${(event: InputEvent) => {
                name = (event.target as HTMLInputElement).value;
                touched = true;
                update();
              }}
            />
            ${
              problems.name
                ? html`<p class="argus-formula-problem" id=${`${ids}-name-problem`}>
                    ${problems.name}
                  </p>`
                : nothing
            }
          </div>

          <div class="argus-formula-row">
            <label for=${`${ids}-formula`}>Formula</label>
            <div class="argus-formula-field">
              <div class="argus-formula-mirror" aria-hidden="true">${mirror(formulaProblem)}</div>
              <input
                id=${`${ids}-formula`}
                type="text"
                spellcheck="false"
                autocomplete="off"
                autocapitalize="off"
                placeholder=${readOnly ? '' : 'ROUND([Total] * 1.19, 2)'}
                role=${readOnly ? nothing : 'combobox'}
                aria-autocomplete=${readOnly ? nothing : 'list'}
                aria-expanded=${readOnly ? nothing : items.length ? 'true' : 'false'}
                aria-controls=${readOnly || !items.length ? nothing : listId}
                aria-activedescendant=${items.length ? `${listId}-${String(active)}` : nothing}
                aria-invalid=${formulaProblem ? 'true' : 'false'}
                aria-describedby=${describedBy || nothing}
                .value=${live(formula)}
                ?readonly=${readOnly}
                @input=${(event: InputEvent) => {
                  formula = (event.target as HTMLInputElement).value;
                  touched = true;
                  dismissed = false;
                  refresh();
                }}
                @keydown=${onFormulaKey}
                @keyup=${(event: KeyboardEvent) => {
                  if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
                    refresh();
                  }
                }}
                @click=${refresh}
                @scroll=${sync}
                @blur=${() => {
                  dismissed = true;
                  completion = undefined;
                  update();
                }}
              />
              ${
                items.length
                  ? html`<ul
                      class="argus-formula-suggestions"
                      role="listbox"
                      id=${listId}
                      aria-label="Suggestions"
                    >
                      ${items.map(
                        (item, i) =>
                          html`<li
                            role="option"
                            id=${`${listId}-${String(i)}`}
                            aria-selected=${i === active ? 'true' : 'false'}
                            @pointerdown=${(event: PointerEvent) => {
                              // Keeps focus in the input.
                              event.preventDefault();
                            }}
                            @click=${() => {
                              accept(i);
                            }}
                          >
                            <span>${item.label}</span>
                            <span class="argus-formula-suggestion-kind">
                              ${item.kind === 'boolean' ? 'value' : item.kind}
                            </span>
                          </li>`,
                      )}
                    </ul>`
                  : nothing
              }
            </div>
            ${
              formulaProblem
                ? html`<p class="argus-formula-problem" id=${`${ids}-problem`}>
                    ${formulaProblem.message}
                  </p>`
                : nothing
            }
            ${hint}
          </div>

          ${
            readOnly
              ? nothing
              : html`<div
                    class="argus-formula-insert"
                    role="group"
                    aria-labelledby=${`${ids}-insert`}
                  >
                    <span id=${`${ids}-insert`}>Insert column</span>
                    ${options.columns.map(
                      (column) =>
                        html`<button
                          type="button"
                          class="argus-formula-chip"
                          @click=${() => {
                            insert(`[${column}]`);
                          }}
                        >
                          ${column}
                        </button>`,
                    )}
                    <button
                      type="button"
                      class="argus-formula-all"
                      aria-expanded=${functionsOpen ? 'true' : 'false'}
                      aria-controls=${`${ids}-functions`}
                      @click=${() => {
                        functionsOpen = !functionsOpen;
                        update();
                      }}
                    >
                      All functions
                    </button>
                  </div>
                  ${functionsOpen ? functionList() : nothing}`
          }

          <div class="argus-formula-row">
            <div class="argus-formula-preview-head">
              <span id=${`${ids}-preview`}
                >Preview, first ${String(preview.rows.length || 5)} rows</span
              >
              ${
                preview.type && !formulaProblem
                  ? html`<span>Result: ${TYPES[preview.type]}</span>`
                  : nothing
              }
            </div>
            ${previewTable(preview)}
          </div>

          <div class="argus-formula-actions">
            ${
              readOnly
                ? html`<button type="submit" class="argus-formula-primary">Close</button>`
                : html`<button type="button" @click=${() => dialog()?.close()}>Cancel</button>
                    <button type="submit" class="argus-formula-primary">
                      ${mode === 'add' ? 'Add column' : 'Save'}
                    </button>`
            }
          </div>
        </form>
      </dialog>`;
    };

    function update() {
      render(view(), container);
    }

    update();
    const element = dialog();
    if (!element) {
      resolve(undefined);
      return;
    }
    element.showModal();
    const first = container.querySelector<HTMLInputElement>(`[id="${ids}-${options.focus}"]`);
    first?.focus();
    if (first && options.focus === 'formula') {
      first.setSelectionRange(formula.length, formula.length);
    } else {
      first?.select();
    }
  });
}
