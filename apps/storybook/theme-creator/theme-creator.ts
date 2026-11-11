// <argus-theme-creator>: the Storybook theme creator. Private to the docs:
// pick a preset, change seeds, override tokens and part options, see the
// result in light and dark, export CSS. The preview tables live in this
// element's shadow root, with the generated sheet adopted there, so the
// toolbar's theme doesn't reach them.
import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { ref } from 'lit/directives/ref.js';
import type { ArgusTable, ColumnDef, ColumnGroup, DataSource, PinnedRows } from 'argus-table';
import 'argus-table';
import { headerMenu } from '@argus-table/header-menu';
import { formulas } from '@argus-table/formulas';
import { orderColumns, orders, totals, getOrderId, type Order } from '../stories/theme-orders.js';
import { TOKENS, type TokenGroup, type TokenInfo } from './catalog.js';
import { parseColor, toHex } from './color.js';
import { checkContrast, fixAccent, fixFor, type ContrastResult } from './contrast.js';
import { autoDarkAccent, autoText, tokensOf } from './derive.js';
import {
  DENSITIES,
  SCHEMES,
  fileName,
  inScheme,
  partKey,
  type BaseId,
  type Density,
  type PartOptionName,
  type PartOptions,
  type SchemeName,
  type SeedName,
  type Seeds,
  type ThemeDraft,
  type Value,
} from './model.js';
import { parseTheme, parseValue } from './parse.js';
import { BASE_LABELS, isPreset, newDraft } from './presets.js';
import { effectiveSeeds, readPartOptions, resolveTheme, type ResolvedTheme } from './resolve.js';
import { serializeTheme, valueText } from './serialize.js';
import { clearDraft, decodeDraft, hashDraft, loadDraft, saveDraft, shareLink } from './share.js';
import { lookupIn, resolveColor } from './values.js';

const SEED_LABELS: Record<SeedName, string> = {
  accent: 'Accent',
  surface: 'Surface',
  text: 'Text',
  header: 'Header',
  lines: 'Lines and shape',
  rows: 'Rows',
  type: 'Typography',
  depth: 'Depth',
};

const GROUP_LABELS: Record<TokenGroup, string> = {
  table: 'Table',
  'header-menu': 'Column menu (@argus-table/header-menu)',
  formulas: 'Formula editor (@argus-table/formulas)',
};

const PART_LABELS: Record<PartOptionName, string> = {
  headerSize: 'Header label size',
  headerWeight: 'Header label weight',
  uppercase: 'Uppercase header labels',
  sortedAccent: 'Sorted column’s header in the accent colour',
  tabularNums: 'Tabular numbers in cells',
  pinnedBold: 'Bold pinned rows',
  pinnedSeparator: 'Line between pinned rows and the body',
  checkboxAccent: 'Checkboxes in the accent colour',
  skeletonRadius: 'Rounded skeleton bars',
};

// The preview: the orders the theme stories use, plus a formula column, a
// column group, a set filter, a sort, two selected rows and a totals row.
const columns: ColumnDef<Order>[] = [
  ...orderColumns.map((column) =>
    column.id === 'status'
      ? { ...column, cell: undefined }
      : column.id === 'city'
        ? { ...column, filter: 'set' as const }
        : column,
  ),
];
columns.splice(columns.length - 1, 0, {
  id: 'vat',
  header: 'VAT',
  formula: 'ROUND([Total] * 0.19, 2)',
  width: 110,
});
const columnGroups: ColumnGroup[] = [
  { id: 'where', header: 'Customer', columns: ['customer', 'city'] },
];
const pinnedRows: PinnedRows<Order> = { bottom: [totals] };
const plugins = [formulas(), headerMenu()];
const filters = { city: { kind: 'set' as const, values: ['Lisbon', 'Oslo', 'Quito', 'Hanoi'] } };
const started = new WeakSet<Element>();
/** A sort, a filter and a selection to start with, left to the user afterwards (uncontrolled). */
const initialState = (element?: Element) => {
  if (!element || started.has(element)) return;
  started.add(element);
  void (element as ArgusTable<Order>).setState({
    sorting: [{ id: 'total', desc: true }],
    columnFilters: filters,
    selection: ['o2', 'o4'],
  });
};
const loadingColumns = orderColumns.map((c) => ({ ...c, cell: undefined, pin: undefined }));
/** Pages that never arrive: skeleton rows. */
const loading: DataSource<Order> = {
  pageSize: 20,
  getRows: () => new Promise(() => undefined),
};

type Preview = 'both' | SchemeName;

const without = <T extends object>(record: T, key: string): T =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key)) as T;

@customElement('argus-theme-creator')
export class ArgusThemeCreator extends LitElement {
  static override styles = css`
    :host {
      display: grid;
      grid-template-columns: minmax(280px, 340px) minmax(0, 1fr) minmax(300px, 400px);
      gap: 16px;
      padding: 16px;
      color-scheme: light dark;
      font:
        14px/1.4 system-ui,
        sans-serif;
      color: CanvasText;
      background: Canvas;
      box-sizing: border-box;
      min-block-size: 100vh;
    }
    @media (width < 1200px) {
      :host {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    h1 {
      font-size: 1.25rem;
      margin: 0 0 4px;
    }
    h2 {
      font-size: 1rem;
      margin: 16px 0 8px;
    }
    p {
      margin: 0 0 8px;
    }
    .muted {
      color: color-mix(in srgb, CanvasText 70%, Canvas);
      font-size: 0.85em;
    }
    details {
      border: 1px solid color-mix(in srgb, CanvasText 18%, Canvas);
      border-radius: 6px;
      margin-block: 6px;
      padding: 0 8px;
    }
    details[open] {
      padding-block-end: 8px;
    }
    summary {
      cursor: pointer;
      padding-block: 6px;
      font-weight: 600;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .badge {
      font-weight: 400;
      font-size: 0.75em;
      padding: 0 6px;
      border-radius: 999px;
      background: color-mix(in srgb, LinkText 18%, Canvas);
    }
    .field {
      display: grid;
      grid-template-columns: 9em minmax(0, 1fr);
      gap: 4px 8px;
      align-items: center;
      margin-block: 6px;
    }
    .pair {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    input[type='text'],
    input[type='number'],
    select,
    textarea {
      font: inherit;
      min-inline-size: 0;
      box-sizing: border-box;
    }
    input[type='text'] {
      inline-size: 100%;
    }
    input[type='number'] {
      inline-size: 5em;
    }
    input[type='color'] {
      inline-size: 36px;
      block-size: 28px;
      padding: 0;
    }
    textarea {
      inline-size: 100%;
      min-block-size: 8em;
      font-family: ui-monospace, monospace;
      font-size: 12px;
    }
    button {
      font: inherit;
    }
    .sizes {
      display: grid;
      grid-template-columns: auto auto auto;
      gap: 4px 8px;
      align-items: center;
    }
    .token {
      border-block-start: 1px solid color-mix(in srgb, CanvasText 12%, Canvas);
      padding-block: 6px;
    }
    .token code {
      font-size: 0.85em;
    }
    .token .pair input[type='text'] {
      inline-size: auto;
      flex: 1 1 8em;
    }
    .toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      margin-block-end: 8px;
    }
    fieldset {
      border: none;
      padding: 0;
      margin: 0;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    legend {
      float: inline-start;
      margin-inline-end: 4px;
    }
    .previews {
      display: grid;
      gap: 12px;
    }
    .previews.both {
      grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
    }
    .pane {
      padding: 12px;
      border-radius: 8px;
      background: Canvas;
      color: CanvasText;
      border: 1px solid color-mix(in srgb, CanvasText 15%, Canvas);
      display: grid;
      gap: 8px;
      min-inline-size: 0;
    }
    .pane[data-argus-theme='light'] {
      color-scheme: light;
    }
    .pane[data-argus-theme='dark'] {
      color-scheme: dark;
    }
    .pane h3 {
      margin: 0;
      font-size: 0.9rem;
    }
    .pane argus-table.main {
      block-size: 380px;
    }
    .pane argus-table.loading {
      block-size: 120px;
    }
    table.contrast {
      border-collapse: collapse;
      inline-size: 100%;
      font-size: 0.9em;
    }
    table.contrast th,
    table.contrast td {
      text-align: start;
      padding: 3px 4px;
      border-block-end: 1px solid color-mix(in srgb, CanvasText 12%, Canvas);
    }
    .fail {
      color: light-dark(#b42318, #ff8a80);
      font-weight: 600;
    }
    .unknown {
      font-style: italic;
    }
    pre {
      max-block-size: 480px;
      overflow: auto;
      padding: 8px;
      border-radius: 6px;
      background: color-mix(in srgb, CanvasText 6%, Canvas);
      font-size: 12px;
    }
    .actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .status {
      min-block-size: 1.4em;
      font-size: 0.85em;
    }
    .warnings {
      font-size: 0.85em;
      padding-inline-start: 1.2em;
    }
    .rule {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: start;
    }
    .rule pre {
      margin: 4px 0;
      flex: 1;
    }
    .rule.removed pre {
      text-decoration: line-through;
      opacity: 0.6;
    }
  `;

  @state() private draft: ThemeDraft = newDraft('default');
  @state() private preview: Preview = 'both';
  @state() private density: Density = 'comfortable';
  @state() private status = '';
  @state() private warnings: string[] = [];
  @state() private importText = '';
  /** The dark accent follows the light one. */
  @state() private linkAccent = true;

  #themeSheet = new CSSStyleSheet();
  #resolved: ResolvedTheme = resolveTheme(this.draft);
  #css = '';
  #contrast: ContrastResult[] = [];
  #saveTimer: ReturnType<typeof setTimeout> | undefined;
  #loaded = false;

  /** The generated stylesheet, as last applied to the preview. */
  get css(): string {
    return this.#css;
  }

  override createRenderRoot() {
    const root = super.createRenderRoot() as ShadowRoot;
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, this.#themeSheet];
    return root;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.#loaded) void this.#load();
  }

  /** A link's theme, else the saved draft, else the default preset. */
  async #load(): Promise<void> {
    this.#loaded = true;
    const hashes = [hashDraft(location.href)];
    try {
      if (window.top && window.top !== window) hashes.push(hashDraft(window.top.location.href));
    } catch {
      // Another origin: only this frame's link counts.
    }
    for (const hash of hashes) {
      if (!hash) continue;
      const draft = await decodeDraft(hash);
      if (draft) {
        this.draft = draft;
        this.status = 'Opened the theme from the link.';
        return;
      }
      this.status = 'The link’s theme couldn’t be read; started from the default.';
    }
    const saved = loadDraft();
    if (saved) {
      this.draft = saved;
      this.status = 'Restored your saved draft.';
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('draft' as keyof ArgusThemeCreator)) {
      this.#resolved = resolveTheme(this.draft);
      const basedOn = isPreset(this.draft.preset)
        ? `the ${BASE_LABELS[this.draft.preset]} theme`
        : undefined;
      this.#css = serializeTheme(this.#resolved, {
        name: this.draft.name,
        ...(basedOn ? { basedOn } : {}),
      });
      this.#contrast = checkContrast(this.#resolved);
      this.#themeSheet.replaceSync(this.#css);
      this.#scheduleSave();
    }
  }

  #scheduleSave() {
    clearTimeout(this.#saveTimer);
    const draft = this.draft;
    this.#saveTimer = setTimeout(() => {
      saveDraft(draft);
    }, 300);
  }

  #update(patch: Partial<ThemeDraft>) {
    this.draft = { ...this.draft, ...patch };
  }

  get #seeds(): Seeds {
    return effectiveSeeds(this.draft);
  }

  #setSeed<K extends SeedName>(name: K, value: Seeds[K]) {
    this.#update({ seeds: { ...this.draft.seeds, [name]: value } });
  }

  #resetSeed(name: SeedName) {
    this.#update({ seeds: without(this.draft.seeds, name) });
  }

  #setOverride(token: string, value: Value | undefined) {
    const overrides = without(this.draft.overrides, token);
    this.#update({ overrides: value === undefined ? overrides : { ...overrides, [token]: value } });
  }

  #setPart<K extends PartOptionName>(name: K, value: PartOptions[K]) {
    this.#update({ parts: { ...this.draft.parts, [name]: value } });
  }

  #choosePreset(id: BaseId) {
    if (id === 'imported') return;
    this.draft = { ...newDraft(id, this.draft.name) };
    this.warnings = [];
    this.status = `Started from ${BASE_LABELS[id]}.`;
  }

  #import(text: string) {
    const { theme, warnings } = parseTheme(text);
    this.draft = {
      ...newDraft('default', this.draft.name),
      preset: 'imported',
      base: theme,
    };
    this.warnings = warnings;
    const count = Object.keys(theme.tokens).length;
    this.status = `Imported ${String(count)} tokens and ${String(theme.parts.length)} part rules${warnings.length ? `, ${String(warnings.length)} left out` : ''}.`;
  }

  async #onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.importText = await file.text();
    this.#import(this.importText);
  }

  async #copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.status = done;
    } catch {
      this.status = 'The clipboard isn’t available here; select the text and copy it.';
    }
  }

  #download() {
    const url = URL.createObjectURL(new Blob([this.#css], { type: 'text/css' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName(this.draft);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    this.status = `Downloaded ${link.download}.`;
  }

  async #share() {
    const link = await shareLink(this.draft, location);
    await this.#copy(link, 'Copied a link to this theme.');
  }

  #reset() {
    clearDraft();
    this.draft = newDraft('default');
    this.warnings = [];
    this.importText = '';
    this.status = 'Started over from the default theme; the saved draft is gone.';
  }

  #openMenu(scheme: SchemeName) {
    const table = this.renderRoot.querySelector<ArgusTable>(
      `.pane[data-argus-theme='${scheme}'] argus-table.main`,
    );
    const button = table?.querySelector<HTMLButtonElement>('.argus-header-menu-button');
    button?.click();
  }

  protected override render(): TemplateResult {
    return html`
      <section aria-labelledby="controls-title">${this.#renderControls()}</section>
      <section aria-labelledby="preview-title">${this.#renderPreview()}</section>
      <section aria-labelledby="output-title">${this.#renderOutput()}</section>
    `;
  }

  // Controls

  #renderControls() {
    const { draft } = this;
    return html`
      <h1 id="controls-title">Theme creator</h1>
      <p class="muted">
        Start from a theme, change a few seeds, then fine-tune any token. Your work is saved in this
        browser.
      </p>
      <div class="field">
        <label for="name">Name</label>
        <input
          id="name"
          type="text"
          .value=${live(draft.name)}
          @change=${(e: Event) => {
            this.#update({ name: (e.target as HTMLInputElement).value });
          }}
        />
        <label for="preset">Start from</label>
        <select
          id="preset"
          @change=${(e: Event) => {
            this.#choosePreset((e.target as HTMLSelectElement).value as BaseId);
          }}
        >
          ${(Object.keys(BASE_LABELS) as BaseId[]).map(
            (id) =>
              html`<option
                value=${id}
                ?selected=${draft.preset === id}
                ?disabled=${id === 'imported'}
              >
                ${BASE_LABELS[id]}
              </option>`,
          )}
        </select>
      </div>

      <h2>Seeds</h2>
      ${this.#seedSection('accent', this.#accentControls())}
      ${this.#seedSection('surface', this.#pairControls('surface', 'Background'))}
      ${this.#seedSection('text', this.#textControls())}
      ${this.#seedSection('header', this.#headerControls())}
      ${this.#seedSection('lines', this.#lineControls())}
      ${this.#seedSection('rows', this.#rowControls())}
      ${this.#seedSection('type', this.#typeControls())}
      ${this.#seedSection('depth', this.#depthControls())}

      <h2>Parts</h2>
      ${this.#renderParts()}

      <h2>Tokens</h2>
      <p class="muted">Every token, as the theme sets it. A change here wins over the seeds.</p>
      ${(['table', 'header-menu', 'formulas'] as TokenGroup[]).map((group) =>
        this.#renderTokenGroup(group),
      )}

      <h2>Import</h2>
      ${this.#renderImport()}

      <h2>Start over</h2>
      <button type="button" @click=${this.#reset}>Discard the saved draft</button>
    `;
  }

  #seedSection(name: SeedName, body: TemplateResult) {
    const touched = name in this.draft.seeds;
    return html`<details ?open=${name === 'accent' || name === 'surface'}>
      <summary>
        ${SEED_LABELS[name]} ${touched ? html`<span class="badge">changed</span>` : nothing}
      </summary>
      ${body}
      <p class="muted">Sets ${tokensOf(name, this.#seeds).join(', ') || 'nothing yet'}.</p>
      ${
        touched
          ? html`<button
              type="button"
              @click=${() => {
                this.#resetSeed(name);
              }}
            >
              Back to the base theme
            </button>`
          : nothing
      }
    </details>`;
  }

  #colorField(id: string, label: string, value: string, set: (value: string) => void) {
    const hex = toHex(parseColor(value) ?? { r: 0, g: 0, b: 0, a: 1 });
    return html`<label for=${id}>${label}</label>
      <span class="pair">
        <input
          id=${id}
          type="color"
          .value=${live(hex)}
          @input=${(e: Event) => {
            set((e.target as HTMLInputElement).value);
          }}
        />
        <input
          type="text"
          aria-label=${`${label} (CSS colour)`}
          .value=${live(value)}
          @change=${(e: Event) => {
            const text = (e.target as HTMLInputElement).value.trim();
            if (parseColor(text)) set(text);
            else this.status = `“${text}” isn’t a colour.`;
          }}
        />
      </span>`;
  }

  #accentControls() {
    const { accent, surface } = this.#seeds;
    return html`<div class="field">
      ${this.#colorField('accent-light', 'Light', accent.light, (light) => {
        this.#setSeed('accent', {
          light,
          dark: this.linkAccent ? autoDarkAccent(light, surface.dark) : accent.dark,
        });
      })}
      ${this.#colorField('accent-dark', 'Dark', accent.dark, (dark) => {
        this.linkAccent = false;
        this.#setSeed('accent', { ...accent, dark });
      })}
      <span></span>
      <label
        ><input
          type="checkbox"
          .checked=${live(this.linkAccent)}
          @change=${(e: Event) => {
            this.linkAccent = (e.target as HTMLInputElement).checked;
          }}
        />
        Dark follows light</label
      >
    </div>`;
  }

  #pairControls(name: 'surface' | 'text', label: string) {
    const pair = this.#seeds[name];
    return html`<div class="field">
      ${SCHEMES.map((scheme) =>
        this.#colorField(`${name}-${scheme}`, `${label}, ${scheme}`, pair[scheme], (value) => {
          this.#setSeed(name, { ...pair, [scheme]: value });
        }),
      )}
    </div>`;
  }

  #textControls() {
    const { surface } = this.#seeds;
    return html`${this.#pairControls('text', 'Text')}
      <button
        type="button"
        @click=${() => {
          this.#setSeed('text', { light: autoText(surface.light), dark: autoText(surface.dark) });
        }}
      >
        Pick for the surface
      </button>`;
  }

  #headerControls() {
    const { header } = this.#seeds;
    const set = (patch: Partial<Seeds['header']>) => {
      this.#setSeed('header', { ...header, ...patch });
    };
    return html`<fieldset>
        <legend>Background</legend>
        ${(['body', 'tinted', 'accent'] as const).map(
          (style) =>
            html`<label
              ><input
                type="radio"
                name="header-style"
                .checked=${live(header.style === style)}
                @change=${() => {
                  set({ style });
                }}
              />${{ body: 'Body', tinted: 'Tinted', accent: 'Accent' }[style]}</label
            >`,
        )}
      </fieldset>
      <div class="field">
        <label for="header-strength">Strength</label>
        <input
          id="header-strength"
          type="range"
          min="0"
          max="100"
          .value=${live(String(header.strength))}
          ?disabled=${header.style === 'body'}
          @input=${(e: Event) => {
            set({ strength: Number((e.target as HTMLInputElement).value) });
          }}
        />
        <span></span>
        <label
          ><input
            type="checkbox"
            .checked=${live(header.muted)}
            @change=${(e: Event) => {
              set({ muted: (e.target as HTMLInputElement).checked });
            }}
          />
          Muted header text</label
        >
      </div>`;
  }

  #lineControls() {
    const { lines } = this.#seeds;
    const set = (patch: Partial<Seeds['lines']>) => {
      this.#setSeed('lines', { ...lines, ...patch });
    };
    const num = (e: Event) => Number((e.target as HTMLInputElement).value);
    return html`<div class="field">
      <label for="lines-strength">Border contrast</label>
      <input
        id="lines-strength"
        type="range"
        min="0"
        max="100"
        .value=${live(String(lines.strength))}
        @input=${(e: Event) => {
          set({ strength: num(e) });
        }}
      />
      <label for="lines-width">Border width (px)</label>
      <input
        id="lines-width"
        type="number"
        min="0"
        max="4"
        .value=${live(String(lines.width))}
        @change=${(e: Event) => {
          set({ width: num(e) });
        }}
      />
      <label for="lines-radius">Corner radius (px)</label>
      <input
        id="lines-radius"
        type="number"
        min="0"
        max="32"
        .value=${live(String(lines.radius))}
        @change=${(e: Event) => {
          set({ radius: num(e) });
        }}
      />
      <span></span>
      <label
        ><input
          type="checkbox"
          .checked=${live(lines.outline)}
          @change=${(e: Event) => {
            set({ outline: (e.target as HTMLInputElement).checked });
          }}
        />
        Border around the table</label
      >
    </div>`;
  }

  #rowControls() {
    const { rows } = this.#seeds;
    const set = (patch: Partial<Seeds['rows']>) => {
      this.#setSeed('rows', { ...rows, ...patch });
    };
    const size = (kind: 'height' | 'padding', density: Density) =>
      html`<input
        type="number"
        min="0"
        max="120"
        aria-label=${`${kind === 'height' ? 'Row height' : 'Cell padding'}, ${density} (px)`}
        .value=${live(String(rows[kind][density]))}
        @change=${(e: Event) => {
          set({
            [kind]: { ...rows[kind], [density]: Number((e.target as HTMLInputElement).value) },
          });
        }}
      />`;
    return html`<p>
        <label
          ><input
            type="checkbox"
            .checked=${live(rows.stripes)}
            @change=${(e: Event) => {
              set({ stripes: (e.target as HTMLInputElement).checked });
            }}
          />
          Striped rows</label
        >
        <label
          ><input
            type="checkbox"
            .checked=${live(rows.hover)}
            @change=${(e: Event) => {
              set({ hover: (e.target as HTMLInputElement).checked });
            }}
          />
          Hover colour</label
        >
      </p>
      <div class="sizes">
        <span></span><span class="muted">Height</span><span class="muted">Padding</span>
        ${DENSITIES.map((d) => html`<span>${d}</span>${size('height', d)}${size('padding', d)}`)}
      </div>`;
  }

  #typeControls() {
    const { type } = this.#seeds;
    const text = (key: keyof Seeds['type'], label: string, placeholder: string) =>
      html`<label for=${`type-${key}`}>${label}</label>
        <input
          id=${`type-${key}`}
          type="text"
          placeholder=${placeholder}
          .value=${live(type[key])}
          @change=${(e: Event) => {
            this.#setSeed('type', { ...type, [key]: (e.target as HTMLInputElement).value });
          }}
        />`;
    return html`<div class="field">
        ${text('family', 'Font family', 'The page’s font')} ${text('size', 'Size', '1em')}
        <label for="type-weight">Weight</label>
        <select
          id="type-weight"
          @change=${(e: Event) => {
            this.#setSeed('type', { ...type, weight: (e.target as HTMLSelectElement).value });
          }}
        >
          ${['', '300', '400', '500', '600'].map(
            (w) =>
              html`<option value=${w} ?selected=${type.weight === w}>${w || 'Default'}</option>`,
          )}
        </select>
        ${text('mono', 'Monospace', 'ui-monospace, monospace')}
      </div>
      <p class="muted">The theme loads no fonts: load them on your page.</p>`;
  }

  #depthControls() {
    const { depth } = this.#seeds;
    const range = (key: keyof Seeds['depth'], label: string) =>
      html`<label for=${`depth-${key}`}>${label}</label>
        <input
          id=${`depth-${key}`}
          type="range"
          min="0"
          max="100"
          .value=${live(String(depth[key]))}
          @input=${(e: Event) => {
            this.#setSeed('depth', {
              ...depth,
              [key]: Number((e.target as HTMLInputElement).value),
            });
          }}
        />`;
    return html`<div class="field">
      ${range('pinned', 'Pinned columns')} ${range('popover', 'Menus and dialogs')}
    </div>`;
  }

  #renderParts() {
    const { draft } = this;
    const kept = draft.base.parts.filter((r) => !draft.removedParts.includes(partKey(r)));
    const options = { ...readPartOptions(kept), ...draft.parts };
    const toggle = (name: Exclude<PartOptionName, 'headerSize' | 'headerWeight'>) =>
      html`<label style="display: block"
        ><input
          type="checkbox"
          .checked=${live(options[name])}
          @change=${(e: Event) => {
            this.#setPart(name, (e.target as HTMLInputElement).checked);
          }}
        />
        ${PART_LABELS[name]}</label
      >`;
    return html`<div class="field">
        <label for="part-size">${PART_LABELS.headerSize}</label>
        <input
          id="part-size"
          type="text"
          placeholder="Like the cells"
          .value=${live(options.headerSize)}
          @change=${(e: Event) => {
            this.#setPart('headerSize', (e.target as HTMLInputElement).value.trim());
          }}
        />
        <label for="part-weight">${PART_LABELS.headerWeight}</label>
        <select
          id="part-weight"
          @change=${(e: Event) => {
            this.#setPart('headerWeight', (e.target as HTMLSelectElement).value);
          }}
        >
          ${['', '400', '500', '600', '700'].map(
            (w) =>
              html`<option value=${w} ?selected=${options.headerWeight === w}>
                ${w || 'Default'}
              </option>`,
          )}
        </select>
      </div>
      ${toggle('uppercase')} ${toggle('sortedAccent')} ${toggle('tabularNums')}
      ${toggle('pinnedBold')} ${toggle('pinnedSeparator')} ${toggle('checkboxAccent')}
      ${toggle('skeletonRadius')}
      ${
        Object.keys(draft.parts).length > 0 || draft.removedParts.length > 0
          ? html`<button
              type="button"
              @click=${() => {
                this.#update({ parts: {}, removedParts: [] });
              }}
            >
              Parts as in the base theme
            </button>`
          : nothing
      }
      ${
        draft.base.parts.length > 0
          ? html`<details>
              <summary>The base theme’s part rules</summary>
              <p class="muted">The options above change these; remove one to drop it entirely.</p>
              ${draft.base.parts.map((rule) => {
                const key = partKey(rule);
                const removed = draft.removedParts.includes(key);
                return html`<div class=${removed ? 'rule removed' : 'rule'}>
                  <pre tabindex="0">
::part(${rule.parts.join('), ::part(')}) { ${rule.declarations.map(([p, v]) => `${p}: ${v};`).join(' ')} }</pre>
                  <button
                    type="button"
                    aria-label=${`${removed ? 'Restore' : 'Remove'} ::part(${key})`}
                    @click=${() => {
                      this.#update({
                        removedParts: removed
                          ? draft.removedParts.filter((k) => k !== key)
                          : [...draft.removedParts, key],
                      });
                    }}
                  >
                    ${removed ? 'Restore' : 'Remove'}
                  </button>
                </div>`;
              })}
            </details>`
          : nothing
      }`;
  }

  #renderTokenGroup(group: TokenGroup) {
    const tokens = TOKENS.filter((t) => t.group === group);
    const changed = tokens.filter((t) => t.name in this.draft.overrides).length;
    return html`<details>
      <summary>
        ${GROUP_LABELS[group]}
        ${changed ? html`<span class="badge">${changed} changed</span>` : nothing}
      </summary>
      ${tokens.map((t) => this.#renderToken(t))}
    </details>`;
  }

  #renderToken(info: TokenInfo) {
    const value = this.#resolved.tokens[info.name];
    const overridden = info.name in this.draft.overrides;
    const id = `token${info.name}`;
    const lookup = lookupIn(this.#resolved.tokens);
    let editor: TemplateResult;
    if (info.kind === 'color') {
      editor = html`<div class="pair">
        ${SCHEMES.map((scheme) => {
          const text = value === undefined ? '' : inScheme(value, scheme);
          const color = resolveColor(text || `var(${info.name})`, scheme, lookup);
          const set = (next: string) => {
            const current = value ?? '';
            const pair = {
              light: inScheme(current, 'light'),
              dark: inScheme(current, 'dark'),
              [scheme]: next,
            };
            this.#setOverride(info.name, pair);
          };
          return html`<input
              type="color"
              aria-label=${`${info.name}, ${scheme}`}
              .value=${live(toHex(color ?? { r: 0, g: 0, b: 0, a: 1 }))}
              @input=${(e: Event) => {
                set((e.target as HTMLInputElement).value);
              }}
            /><input
              type="text"
              aria-label=${`${info.name}, ${scheme} (CSS)`}
              placeholder=${info.default ?? 'Element default'}
              .value=${live(text)}
              @change=${(e: Event) => {
                set((e.target as HTMLInputElement).value.trim());
              }}
            />`;
        })}
      </div>`;
    } else {
      editor = html`<input
        id=${id}
        type="text"
        placeholder=${info.default ?? 'Element default'}
        .value=${live(value === undefined ? '' : valueText(value))}
        @change=${(e: Event) => {
          const text = (e.target as HTMLInputElement).value.trim();
          this.#setOverride(info.name, text === '' ? undefined : parseValue(text));
        }}
      />`;
    }
    return html`<div class="token">
      ${
        info.kind === 'color'
          ? html`<code>${info.name}</code>`
          : html`<label for=${id}><code>${info.name}</code></label>`
      }
      ${overridden ? html`<span class="badge">changed</span>` : nothing}
      <div class="muted">${info.description}</div>
      ${editor}
      ${
        overridden
          ? html`<button
              type="button"
              @click=${() => {
                this.#setOverride(info.name, undefined);
              }}
            >
              Reset ${info.name}
            </button>`
          : nothing
      }
    </div>`;
  }

  #renderImport() {
    return html`<p class="muted">
        Paste a theme (yours, or one of @argus-table/themes) to keep working on it.
      </p>
      <label for="import-css">Theme CSS</label>
      <textarea
        id="import-css"
        .value=${live(this.importText)}
        @input=${(e: Event) => {
          this.importText = (e.target as HTMLTextAreaElement).value;
        }}
      ></textarea>
      <div class="actions">
        <button
          type="button"
          ?disabled=${this.importText.trim() === ''}
          @click=${() => {
            this.#import(this.importText);
          }}
        >
          Import
        </button>
        <label
          >Or a file: <input type="file" accept=".css,text/css" @change=${this.#onFile}
        /></label>
      </div>
      ${
        this.warnings.length
          ? html`<ul class="warnings">
              ${this.warnings.map((w) => html`<li>${w}</li>`)}
            </ul>`
          : nothing
      }`;
  }

  // Preview

  #renderPreview() {
    const schemes = this.preview === 'both' ? SCHEMES : [this.preview];
    return html`
      <h2 id="preview-title" style="margin-block-start: 0">Preview</h2>
      <div class="toolbar">
        <fieldset>
          <legend>Show</legend>
          ${(['both', 'light', 'dark'] as const).map(
            (p) =>
              html`<label
                ><input
                  type="radio"
                  name="preview"
                  .checked=${live(this.preview === p)}
                  @change=${() => {
                    this.preview = p;
                  }}
                />${{ both: 'Both', light: 'Light', dark: 'Dark' }[p]}</label
              >`,
          )}
        </fieldset>
        <label
          >Density
          <select
            @change=${(e: Event) => {
              this.density = (e.target as HTMLSelectElement).value as Density;
            }}
          >
            ${DENSITIES.map(
              (d) => html`<option value=${d} ?selected=${this.density === d}>${d}</option>`,
            )}
          </select></label
        >
      </div>
      <div class=${`previews ${this.preview === 'both' ? 'both' : ''}`}>
        ${schemes.map((scheme) => this.#renderPane(scheme))}
      </div>
    `;
  }

  #renderPane(scheme: SchemeName) {
    const label = scheme === 'light' ? 'Light' : 'Dark';
    return html`<div class="pane" data-argus-theme=${scheme}>
      <div class="toolbar" style="margin: 0">
        <h3>${label}</h3>
        <button
          type="button"
          @click=${() => {
            this.#openMenu(scheme);
          }}
        >
          Open a column menu
        </button>
      </div>
      <argus-table
        class="main"
        aria-label=${`Orders, ${scheme} preview`}
        density=${this.density}
        selection-mode="multi"
        selection-checkboxes
        .columns=${columns}
        .columnGroups=${columnGroups}
        .data=${orders}
        .pinnedRows=${pinnedRows}
        .getRowId=${getOrderId}
        .plugins=${plugins}
        ${ref(initialState)}
      ></argus-table>
      <argus-table
        class="loading"
        aria-label=${`Loading rows, ${scheme} preview`}
        density=${this.density}
        .columns=${loadingColumns}
        .dataSource=${loading}
      ></argus-table>
    </div>`;
  }

  // Output

  #renderOutput() {
    const failing = this.#contrast.filter((r) => r.pass === false).length;
    const byCheck = new Map<string, ContrastResult[]>();
    for (const r of this.#contrast)
      byCheck.set(r.check.id, [...(byCheck.get(r.check.id) ?? []), r]);
    const cell = (r: ContrastResult | undefined) => {
      if (!r) return html`<td></td>`;
      if (r.ratio === undefined) return html`<td class="unknown">not checked</td>`;
      const fix = fixFor(r, this.#resolved);
      const accent = fixAccent(r, this.#resolved, this.#seeds.accent);
      return html`<td class=${r.pass ? '' : 'fail'}>
        ${r.ratio.toFixed(2)} ${r.pass ? '✓' : '✗'}
        ${
          fix
            ? html`<button
                type="button"
                aria-label=${`Fix ${r.check.label}, ${r.scheme}`}
                @click=${() => {
                  this.#setOverride(fix.token, fix.value);
                  this.status = `Changed ${fix.token} to pass.`;
                }}
              >
                Fix
              </button>`
            : nothing
        }
        ${
          accent
            ? html`<button
                type="button"
                aria-label=${`Fix ${r.check.label}, ${r.scheme}: change the accent`}
                @click=${() => {
                  this.#setSeed('accent', accent);
                  this.status = `Changed the ${r.scheme} accent to pass.`;
                }}
              >
                Fix
              </button>`
            : nothing
        }
      </td>`;
    };
    return html`
      <h2 id="output-title" style="margin-block-start: 0">Your theme</h2>
      <div class="actions">
        <button
          type="button"
          @click=${() => {
            void this.#copy(this.#css, 'Copied the CSS.');
          }}
        >
          Copy CSS
        </button>
        <button type="button" @click=${this.#download}>Download ${fileName(this.draft)}</button>
        <button
          type="button"
          @click=${() => {
            void this.#share();
          }}
        >
          Copy a link
        </button>
      </div>
      <p class="muted">Load it after argus-table, in place of a theme from @argus-table/themes.</p>
      <p role="status" class="status">${this.status}</p>

      <h2>Contrast (WCAG AA)</h2>
      <p class=${failing ? 'fail' : 'muted'}>
        ${
          failing === 0
            ? 'Every checked pair passes.'
            : failing === 1
              ? '1 check fails.'
              : `${String(failing)} checks fail.`
        }
        Text needs 4.5:1, the focus ring 3:1. Canvas and CanvasText are checked as this browser
        draws them.
      </p>
      <table class="contrast">
        <thead>
          <tr>
            <th scope="col">Pair</th>
            <th scope="col">Light</th>
            <th scope="col">Dark</th>
          </tr>
        </thead>
        <tbody>
          ${[...byCheck.values()].map((results) => {
            const [first] = results;
            if (!first) return nothing;
            return html`<tr>
              <th scope="row" style="font-weight: 400">${first.check.label}</th>
              ${cell(results.find((r) => r.scheme === 'light'))}
              ${cell(results.find((r) => r.scheme === 'dark'))}
            </tr>`;
          })}
        </tbody>
      </table>

      <h2>CSS</h2>
      <pre tabindex="0" aria-label="Generated CSS"><code>${this.#css}</code></pre>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'argus-theme-creator': ArgusThemeCreator;
  }
}
