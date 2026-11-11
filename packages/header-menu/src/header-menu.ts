import { html, nothing, type TemplateResult } from 'lit';
import type {
  ArgusPlugin,
  CellContent,
  ColumnDef,
  ColumnInfo,
  ColumnPin,
  PluginHost,
} from 'argus-table';
import {
  FILTER_DEBOUNCE_MS,
  filterOf,
  renderForm,
  startForm,
  type FilterForm,
} from './filter-form.js';
import { adoptStyles } from './styles.js';

/** Which column's menu is open in one table, and the table's API. */
interface TableState<T> {
  host: PluginHost<T>;
  open: string | undefined;
  /** Whether the open menu was open when the press on its button started (that press closes it). */
  pressedOpen: boolean;
  /** Prefix of the ids that tie each menu to its header label. */
  ids: string;
  /** Each column's text header (or its id), for items and announcements about it, hidden ones too. */
  labels: Map<string, string>;
  options: Required<HeaderMenuOptions>;
  /** The open filter form, if any (never at the same time as a menu). */
  form: FilterForm | undefined;
}

/** What `headerMenu()` puts in the menu besides sorting and fitting widths. */
export interface HeaderMenuOptions {
  /** Pin to start, Pin to end and Don't pin, for columns with `pinnable` (the default). Default: `true`. */
  pin?: boolean;
  /**
   * Hide column for columns with `hideable` (the default), and a "Hidden columns"
   * group to show them again. Default: `true`.
   */
  hide?: boolean;
  /**
   * Filter… for columns with a `filter` kind, which opens a form to set the column's
   * filter, and Clear filter on a filtered column. Default: `true`.
   */
  filter?: boolean;
}

let tables = 0;

const SORT_ITEMS = [
  { direction: 'asc', label: 'Sort ascending' },
  { direction: 'desc', label: 'Sort descending' },
  { direction: null, label: 'Unsorted' },
] as const;

const PIN_ITEMS = [
  { pin: 'start', label: 'Pin to start', done: 'pinned to the start' },
  { pin: 'end', label: 'Pin to end', done: 'pinned to the end' },
  { pin: false, label: "Don't pin", done: 'unpinned' },
] as const satisfies readonly { pin: ColumnPin | false; label: string; done: string }[];

/**
 * An item another plugin adds to the column menu, through `headerMenuItems`.
 * Labels are the plugin's own (the built-in ones are in English).
 */
export interface HeaderMenuItem {
  label: string;
  /** Extra text after the label, dimmed: the current formula, a shortcut. Part of the item's name. */
  detail?: string;
  /** Marks an item that removes something; styled with `--argus-menu-danger-fg`. */
  danger?: boolean;
  /**
   * Runs when the item is chosen, after the menu closes. Focus is the item's to
   * place: the menu doesn't move it back to the header (open a dialog, or call
   * `host.focusHeader()`).
   */
  run(): void;
}

/** Items that belong together, after a separator, with an optional heading ("Formula"). */
export interface HeaderMenuGroup {
  label?: string;
  items: readonly HeaderMenuItem[];
}

/**
 * A plugin that adds items to the column menu: any plugin in the table's
 * `plugins` with this method, before or after `headerMenu()`. It runs while a
 * header renders and when its menu opens, so keep it cheap. A column with
 * items gets a menu button even when it can't sort or resize.
 */
export interface HeaderMenuContributor<T = unknown> {
  headerMenuItems(columnId: string, host: PluginHost<T>): readonly HeaderMenuGroup[];
}

const ICON = html`<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
  <circle cx="8" cy="3" r="1.5" fill="currentColor" />
  <circle cx="8" cy="8" r="1.5" fill="currentColor" />
  <circle cx="8" cy="13" r="1.5" fill="currentColor" />
</svg>`;

/**
 * A column menu for `<argus-table>`: a button in each header opens a menu to
 * sort the column ascending or descending, clear its sort, filter it or clear
 * its filter, pin it to a side or unpin it, fit its width to its content, hide
 * it, and show hidden columns again. Items that don't apply to a column are left out.
 *
 * ```ts
 * import { headerMenu } from '@argus-table/header-menu';
 * table.plugins = [headerMenu()];
 * ```
 *
 * On a focused header, Alt+ArrowDown opens the menu, and so do the context
 * menu key, Shift+F10 and a right-click. In the menu, arrow keys move, Enter
 * or Space runs an item, and Escape closes it; focus goes back to the header.
 * One plugin can serve several tables.
 */
export function headerMenu<T = unknown>(options: HeaderMenuOptions = {}): ArgusPlugin<T> {
  const states = new WeakMap<HTMLElement, TableState<T>>();
  const resolved = {
    pin: options.pin !== false,
    hide: options.hide !== false,
    filter: options.filter !== false,
  };

  const stateOf = (host: PluginHost<T>): TableState<T> => {
    let state = states.get(host.element);
    if (!state) {
      tables++;
      state = {
        host,
        open: undefined,
        pressedOpen: false,
        ids: `argus-hm-${String(tables)}`,
        labels: new Map(),
        options: resolved,
        form: undefined,
      };
      states.set(host.element, state);
    }
    return state;
  };

  return {
    name: 'header-menu',

    connect(host) {
      const state = stateOf(host);
      adoptStyles(host.element);
      // Right-click, the context menu key and Shift+F10 on a header open its menu.
      const onContextMenu = (event: MouseEvent) => {
        const target = host.cellOf(event);
        if (target?.section !== 'header' || !hasMenu(state, host.column(target.columnId))) return;
        event.preventDefault();
        void open(state, target.columnId);
      };
      host.element.addEventListener('contextmenu', onContextMenu);
      return () => {
        host.element.removeEventListener('contextmenu', onContextMenu);
        state.open = undefined;
        clearTimeout(state.form?.timer);
        state.form = undefined;
      };
    },

    columns(defs, host) {
      const state = stateOf(host);
      state.labels = new Map(defs.map((def) => [def.id, textOf(def)]));
      return defs.map((def, index) => ({
        ...def,
        header: () => header(state, def, `${state.ids}-${String(index)}`),
      }));
    },

    keydown(event, target, host) {
      if (target.section !== 'header' || event.key !== 'ArrowDown' || !event.altKey) return false;
      const state = stateOf(host);
      if (!hasMenu(state, host.column(target.columnId))) return false;
      event.preventDefault();
      void open(state, target.columnId);
      return true;
    },
  };
}

/** The groups other plugins add to a column's menu; a plugin that throws is reported and skipped. */
function contributions<T>(host: PluginHost<T>, columnId: string): HeaderMenuGroup[] {
  const groups: HeaderMenuGroup[] = [];
  for (const plugin of host.element.plugins) {
    const contributor = plugin as Partial<HeaderMenuContributor<T>>;
    if (typeof contributor.headerMenuItems !== 'function') continue;
    try {
      for (const group of contributor.headerMenuItems(columnId, host)) {
        if (group.items.length) groups.push(group);
      }
    } catch (error) {
      console.error(`argus-table: plugin "${plugin.name}" threw in headerMenuItems`, error);
    }
  }
  return groups;
}

/** A column's text header, or its id when the header isn't text. */
function textOf<T>(def: ColumnDef<T>): string {
  const { header } = def;
  return typeof header === 'string' || typeof header === 'number' ? String(header) : def.id;
}

const labelOf = <T>(state: TableState<T>, id: string) => state.labels.get(id) ?? id;

/** Whether the menu can pin and unpin this column. */
const canPin = <T>(state: TableState<T>, column: ColumnInfo) =>
  state.options.pin && column.pinnable && state.host.setPin !== undefined;

/**
 * Whether the menu can filter this column: it allows it, the column has a filter kind,
 * and for a set filter the table can list the values (with a `dataSource`, only from
 * `filterOptions`).
 */
const canFilter = <T>(state: TableState<T>, column: ColumnInfo) =>
  state.options.filter &&
  column.filter !== undefined &&
  state.host.setFilter !== undefined &&
  (column.filter !== 'set' ||
    (state.host.filterValues !== undefined &&
      (state.host.element.dataSource === undefined ||
        state.host.filterValues(column.id) !== undefined)));

/** The columns shown and hidden, when the menu hides and shows columns. */
function visibility<T>(state: TableState<T>): { shown: ColumnInfo[]; hidden: ColumnInfo[] } {
  const { host } = state;
  if (!state.options.hide || !host.setHidden || !host.columns) return { shown: [], hidden: [] };
  const all = host.columns();
  return { shown: all.filter((c) => !c.hidden), hidden: all.filter((c) => c.hidden) };
}

/** Whether the menu can hide this column: it allows it, and another column stays shown. */
const canHide = (column: ColumnInfo, shown: readonly ColumnInfo[]) =>
  column.hideable && shown.length > 1;

/**
 * Columns with something in the menu: sortable, resizable, pinnable or hideable
 * ones, every column while some are hidden (to show them), and columns with items
 * from other plugins.
 */
function hasMenu<T>(state: TableState<T>, column: ColumnInfo | undefined): column is ColumnInfo {
  if (column === undefined) return false;
  if (column.sortable || column.resizable || canPin(state, column) || canFilter(state, column)) {
    return true;
  }
  const { shown, hidden } = visibility(state);
  if (hidden.length > 0 || canHide(column, shown)) return true;
  return contributions(state.host, column.id).length > 0;
}

/** The column's own header, then the menu button, then the menu while it is open. */
function header<T>(state: TableState<T>, def: ColumnDef<T>, labelId: string): CellContent {
  const raw = typeof def.header === 'function' ? def.header() : def.header;
  const column = state.host.column(def.id);
  if (!hasMenu(state, column)) return raw ?? '';
  // Through the table, so framework content (React, Vue) renders in our template too.
  const own = state.host.content ? state.host.content(raw) : raw;
  const isOpen = state.open === def.id;
  const menuId = `${labelId}-menu`;
  return html`<span class="argus-header-menu-header"
    ><span class="argus-header-menu-label" id=${labelId}>${own ?? nothing}</span
    ><button
      class="argus-header-menu-button"
      type="button"
      tabindex="-1"
      aria-label="Column menu"
      aria-haspopup="menu"
      aria-expanded=${isOpen ? 'true' : 'false'}
      aria-controls=${isOpen ? menuId : nothing}
      aria-keyshortcuts="Alt+ArrowDown"
      @pointerdown=${() => {
        state.pressedOpen = isOpen;
      }}
      @click=${() => {
        const wasOpen = state.pressedOpen;
        state.pressedOpen = false;
        // A press on the button of an open menu closes it (light dismiss already may have).
        if (wasOpen || state.open === def.id) close(state, undefined);
        else void open(state, def.id);
      }}
    >
      ${ICON}</button
    >${isOpen ? menu(state, column, labelId, menuId) : nothing}${
      state.form?.columnId === def.id ? filterForm(state, state.form, labelId) : nothing
    }</span
  >`;
}

interface MenuItemOptions {
  /** A radio item (`menuitemradio`): whether it is checked. */
  checked?: boolean;
  /** The group it belongs to (`data-group`): the menu opens on the checked item of `sort`. */
  group?: string;
  /** It opens a dialog (`aria-haspopup`). */
  dialog?: boolean;
  danger?: boolean;
}

/** One item of the menu: a button that runs `run` on a click (or Enter). */
function menuItem(
  label: string | TemplateResult,
  run: () => void,
  { checked, group, dialog = false, danger = false }: MenuItemOptions = {},
): TemplateResult {
  return html`<button
    class=${danger ? 'argus-header-menu-item argus-header-menu-item-danger' : 'argus-header-menu-item'}
    type="button"
    role=${checked === undefined ? 'menuitem' : 'menuitemradio'}
    tabindex="-1"
    data-group=${group ?? nothing}
    aria-checked=${checked === undefined ? nothing : String(checked)}
    aria-haspopup=${dialog ? 'dialog' : nothing}
    @click=${run}
  >
    ${label}
  </button>`;
}

function menu<T>(
  state: TableState<T>,
  column: ColumnInfo,
  labelId: string,
  menuId: string,
): TemplateResult {
  const { id } = column;
  const sortItems = column.sortable
    ? SORT_ITEMS.map((item) =>
        menuItem(
          item.label,
          () => {
            close(state, id);
            state.host.setSort(id, item.direction);
          },
          { checked: (column.sorted ?? null) === item.direction, group: 'sort' },
        ),
      )
    : undefined;
  const pinItems = canPin(state, column)
    ? PIN_ITEMS.map((item) =>
        menuItem(
          item.label,
          () => {
            close(state, id);
            if ((column.pin ?? false) === item.pin) return;
            state.host.setPin?.(id, item.pin);
            state.host.announce(`${labelOf(state, id)} ${item.done}`);
          },
          { checked: (column.pin ?? false) === item.pin },
        ),
      )
    : undefined;
  const filterItems = canFilter(state, column)
    ? [
        menuItem(
          'Filter…',
          () => {
            close(state, undefined);
            void openFilter(state, id);
          },
          { dialog: true },
        ),
        column.filterValue
          ? menuItem('Clear filter', () => {
              close(state, id);
              clearFilter(state, id);
            })
          : nothing,
      ]
    : undefined;
  const { shown, hidden } = visibility(state);
  const hide = canHide(column, shown)
    ? menuItem('Hide column', () => {
        hideColumn(state, id, shown);
      })
    : undefined;
  const show = (columns: readonly ColumnInfo[], label: string) =>
    menuItem(label, () => {
      close(state, id);
      for (const c of columns) state.host.setHidden?.(c.id, false);
      state.host.announce(
        columns.length === 1
          ? `${labelOf(state, columns[0]?.id ?? '')} shown`
          : `${String(columns.length)} columns shown`,
      );
    });
  const showLabelId = `${menuId}-hidden`;
  const showGroup = hidden.length
    ? html`<div role="group" aria-labelledby=${showLabelId}>
        <div class="argus-header-menu-group-label" id=${showLabelId}>Hidden columns</div>
        ${hidden.map((c) => show([c], `Show ${labelOf(state, c.id)}`))}
        ${hidden.length > 1 ? show(hidden, 'Show all') : nothing}
      </div>`
    : undefined;
  const groups = contributions(state.host, id).map((group, g) => {
    const items = group.items.map((item) =>
      menuItem(
        html`<span class="argus-header-menu-item-label">${item.label}</span>${
            item.detail
              ? html` <span class="argus-header-menu-item-detail">${item.detail}</span>`
              : nothing
          }`,
        () => {
          close(state, undefined);
          item.run();
        },
        { danger: item.danger },
      ),
    );
    if (group.label === undefined) return items;
    const labelId = `${menuId}-g${String(g)}`;
    return html`<div role="group" aria-labelledby=${labelId}>
      <div class="argus-header-menu-group-label" id=${labelId}>${group.label}</div>
      ${items}
    </div>`;
  });
  const fit = column.resizable
    ? menuItem('Fit width', () => {
        void fitWidth(state, id, labelId);
      })
    : undefined;
  return html`<div
    class="argus-header-menu"
    id=${menuId}
    popover="auto"
    role="menu"
    aria-labelledby=${labelId}
    data-column=${id}
    @keydown=${(event: KeyboardEvent) => {
      onMenuKey(state, id, event);
    }}
    @toggle=${(event: Event) => {
      // Light dismiss: a press outside, or Escape handled by the browser.
      if ((event as ToggleEvent).newState === 'closed' && state.open === id)
        close(state, undefined);
    }}
  >
    ${[sortItems, filterItems, pinItems, fit, hide, showGroup, ...groups]
      .filter((section) => section !== undefined)
      .map((section, i) => (i ? [html`<div role="separator"></div>`, section] : section))}
  </div>`;
}

/** The open filter form, wired to the table. */
function filterForm<T>(state: TableState<T>, form: FilterForm, labelId: string): TemplateResult {
  const { host } = state;
  const apply = () => {
    clearTimeout(form.timer);
    form.timer = undefined;
    // A form that was closed meanwhile applied what it had when it closed.
    if (state.form !== form) return;
    host.setFilter?.(form.columnId, filterOf(form));
  };
  return renderForm(form, {
    label: labelOf(state, form.columnId),
    id: `${labelId}-filter`,
    apply,
    applySoon: () => {
      clearTimeout(form.timer);
      form.timer = setTimeout(apply, FILTER_DEBOUNCE_MS);
    },
    rerender: () => {
      host.requestUpdate();
    },
    close: (focusHeader) => {
      if (state.form !== form) return;
      // A typed change still waiting is applied, not lost.
      if (form.timer !== undefined) apply();
      state.form = undefined;
      if (focusHeader) host.focusHeader(form.columnId);
      else host.requestUpdate();
    },
    clear: () => {
      if (state.form !== form) return;
      clearTimeout(form.timer);
      state.form = undefined;
      clearFilter(state, form.columnId);
      host.focusHeader(form.columnId);
    },
  });
}

/** Clears a column's filter. The table announces the rows it leaves. */
function clearFilter<T>(state: TableState<T>, columnId: string): void {
  state.host.setFilter?.(columnId, undefined);
}

/** Opens a column's filter form under its menu button and focuses its first field. */
async function openFilter<T>(state: TableState<T>, columnId: string): Promise<void> {
  const column = state.host.column(columnId);
  const form = column && startForm(state.host, column);
  if (!form) return;
  state.form = form;
  const popover = await openPopover(
    state,
    `.argus-header-filter[data-column="${CSS.escape(columnId)}"]`,
    () => state.form === form,
  );
  popover?.querySelector<HTMLElement>('input, select')?.focus();
}

/** Opens a column's menu, places it under its button and focuses its checked (or first) item. */
async function open<T>(state: TableState<T>, columnId: string): Promise<void> {
  state.open = columnId;
  const popover = await openPopover(
    state,
    `.argus-header-menu[data-column="${CSS.escape(columnId)}"]`,
    () => state.open === columnId,
  );
  if (!popover) return;
  const items = itemsOf(popover);
  // The sort the column has, else the first item.
  const checked = items.find(
    (item) => item.dataset.group === 'sort' && item.getAttribute('aria-checked') === 'true',
  );
  (checked ?? items[0])?.focus();
}

/**
 * Renders, then shows a menu or filter form popover (`selector`) and keeps it
 * under its button while `isOpen()`. `undefined` if it closed in the meantime.
 */
async function openPopover<T>(
  state: TableState<T>,
  selector: string,
  isOpen: () => boolean,
): Promise<HTMLElement | undefined> {
  state.host.requestUpdate();
  await state.host.element.updateComplete;
  const popover = state.host.element.querySelector<HTMLElement>(selector);
  if (!popover || !isOpen()) return undefined;
  if (!popover.matches(':popover-open')) popover.showPopover();
  follow(isOpen, popover);
  return popover;
}

/** Closes the open menu; with a column, focus goes back to its header. */
function close<T>(state: TableState<T>, focusColumn: string | undefined): void {
  if (state.open === undefined) return;
  state.open = undefined;
  if (focusColumn === undefined) state.host.requestUpdate();
  else state.host.focusHeader(focusColumn);
}

/**
 * Hides a column, with focus on the header that takes its place: the next
 * shown column, else the one before it.
 */
function hideColumn<T>(state: TableState<T>, columnId: string, shown: readonly ColumnInfo[]): void {
  const at = shown.findIndex((c) => c.id === columnId);
  const next = shown[at + 1] ?? shown[at - 1];
  close(state, next?.id);
  state.host.setHidden?.(columnId, true);
  state.host.announce(`${labelOf(state, columnId)} hidden`);
}

async function fitWidth<T>(state: TableState<T>, columnId: string, labelId: string) {
  const { host } = state;
  const label =
    host.element.querySelector(`[id="${CSS.escape(labelId)}"]`)?.textContent.trim() ?? '';
  const before = host.column(columnId)?.width;
  close(state, columnId);
  await host.element.autosizeColumns([columnId]);
  const after = host.column(columnId)?.width;
  if (after !== undefined && after !== before) {
    host.announce(`${label === '' ? columnId : label} fitted to ${String(Math.round(after))} px`);
  }
}

function onMenuKey<T>(state: TableState<T>, columnId: string, event: KeyboardEvent): void {
  const popover = event.currentTarget as HTMLElement;
  const items = itemsOf(popover);
  const at = items.indexOf(event.target as HTMLElement);
  let next: number;
  switch (event.key) {
    case 'ArrowDown':
      next = (at + 1) % items.length;
      break;
    case 'ArrowUp':
      next = (at - 1 + items.length) % items.length;
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = items.length - 1;
      break;
    case 'Escape':
    case 'Tab':
      event.preventDefault();
      event.stopPropagation();
      close(state, columnId);
      return;
    default:
      return;
  }
  event.preventDefault();
  items[next]?.focus();
}

const itemsOf = (popover: HTMLElement) => [
  ...popover.querySelectorAll<HTMLElement>('.argus-header-menu-item'),
];

/**
 * Keeps a menu or filter form under its column's menu button while it is open: the
 * table scrolls inside its own shadow root, where scroll events don't reach the page.
 * Once a frame, for one popover at a time.
 */
function follow(isOpen: () => boolean, popover: HTMLElement): void {
  const button = popover.parentElement?.querySelector('.argus-header-menu-button');
  const step = () => {
    if (!isOpen() || !popover.isConnected || !(button instanceof HTMLElement)) return;
    place(popover, button);
    requestAnimationFrame(step);
  };
  step();
}

/**
 * Below the button, its inline-end edge on the button's (the left edge in RTL),
 * within the viewport; above the button when there is no room below.
 */
function place(popover: HTMLElement, button: HTMLElement): void {
  const gap = 2;
  const margin = 4;
  const anchor = button.getBoundingClientRect();
  const { width, height } = popover.getBoundingClientRect();
  const rtl = getComputedStyle(button).direction === 'rtl';
  const viewWidth = document.documentElement.clientWidth;
  const viewHeight = document.documentElement.clientHeight;
  let left = rtl ? anchor.left : anchor.right - width;
  left = Math.min(Math.max(left, margin), Math.max(margin, viewWidth - width - margin));
  let top = anchor.bottom + gap;
  if (top + height > viewHeight - margin && anchor.top - gap - height >= margin) {
    top = anchor.top - gap - height;
  }
  popover.style.left = `${String(Math.round(left))}px`;
  popover.style.top = `${String(Math.round(top))}px`;
}
