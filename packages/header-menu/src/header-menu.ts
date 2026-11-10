import { html, nothing, type TemplateResult } from 'lit';
import type { ArgusPlugin, CellContent, ColumnDef, ColumnInfo, PluginHost } from 'argus-table';
import { adoptStyles } from './styles.js';

/** Which column's menu is open in one table, and the table's API. */
interface TableState<T> {
  host: PluginHost<T>;
  open: string | undefined;
  /** Whether the open menu was open when the press on its button started (that press closes it). */
  pressedOpen: boolean;
  /** Prefix of the ids that tie each menu to its header label. */
  ids: string;
}

let tables = 0;

const SORT_ITEMS = [
  { direction: 'asc', label: 'Sort ascending' },
  { direction: 'desc', label: 'Sort descending' },
  { direction: null, label: 'Unsorted' },
] as const;

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
 * A column menu for `<argus-table>`: a button in each header of a sortable or
 * resizable column opens a menu to sort the column ascending or descending,
 * clear its sort, or fit its width to its content.
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
export function headerMenu<T = unknown>(): ArgusPlugin<T> {
  const states = new WeakMap<HTMLElement, TableState<T>>();

  const stateOf = (host: PluginHost<T>): TableState<T> => {
    let state = states.get(host.element);
    if (!state) {
      tables++;
      state = { host, open: undefined, pressedOpen: false, ids: `argus-hm-${String(tables)}` };
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
        if (target?.section !== 'header' || !hasMenu(host, host.column(target.columnId))) return;
        event.preventDefault();
        void open(state, target.columnId);
      };
      host.element.addEventListener('contextmenu', onContextMenu);
      return () => {
        host.element.removeEventListener('contextmenu', onContextMenu);
        state.open = undefined;
      };
    },

    columns(defs, host) {
      const state = stateOf(host);
      return defs.map((def, index) => ({
        ...def,
        header: () => header(state, def, `${state.ids}-${String(index)}`),
      }));
    },

    keydown(event, target, host) {
      if (target.section !== 'header' || event.key !== 'ArrowDown' || !event.altKey) return false;
      if (!hasMenu(host, host.column(target.columnId))) return false;
      event.preventDefault();
      void open(stateOf(host), target.columnId);
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

/** Columns with something in the menu: sortable or resizable ones, or with items from other plugins. */
function hasMenu<T>(host: PluginHost<T>, column: ColumnInfo | undefined): column is ColumnInfo {
  if (column === undefined) return false;
  return column.sortable || column.resizable || contributions(host, column.id).length > 0;
}

/** The column's own header, then the menu button, then the menu while it is open. */
function header<T>(state: TableState<T>, def: ColumnDef<T>, labelId: string): CellContent {
  const own = typeof def.header === 'function' ? def.header() : def.header;
  const column = state.host.column(def.id);
  if (!hasMenu(state.host, column)) return own ?? '';
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
    >${isOpen ? menu(state, column, labelId, menuId) : nothing}</span
  >`;
}

function menu<T>(
  state: TableState<T>,
  column: ColumnInfo,
  labelId: string,
  menuId: string,
): TemplateResult {
  const { id } = column;
  const sortItems = column.sortable
    ? SORT_ITEMS.map(
        (item) =>
          html`<button
            class="argus-header-menu-item"
            type="button"
            role="menuitemradio"
            tabindex="-1"
            aria-checked=${(column.sorted ?? null) === item.direction ? 'true' : 'false'}
            @click=${() => {
              close(state, id);
              state.host.setSort(id, item.direction);
            }}
          >
            ${item.label}
          </button>`,
      )
    : [];
  const groups = contributions(state.host, id).map((group, g) => {
    const items = group.items.map(
      (item) =>
        html`<button
          class=${
            item.danger
              ? 'argus-header-menu-item argus-header-menu-item-danger'
              : 'argus-header-menu-item'
          }
          type="button"
          role="menuitem"
          tabindex="-1"
          @click=${() => {
            close(state, undefined);
            item.run();
          }}
        >
          <span class="argus-header-menu-item-label">${item.label}</span>${
            item.detail
              ? html` <span class="argus-header-menu-item-detail">${item.detail}</span>`
              : nothing
          }
        </button>`,
    );
    if (group.label === undefined) return items;
    const labelId = `${menuId}-g${String(g)}`;
    return html`<div role="group" aria-labelledby=${labelId}>
      <div class="argus-header-menu-group-label" id=${labelId}>${group.label}</div>
      ${items}
    </div>`;
  });
  const fit = column.resizable
    ? html`<button
        class="argus-header-menu-item"
        type="button"
        role="menuitem"
        tabindex="-1"
        @click=${() => {
          void fitWidth(state, id, labelId);
        }}
      >
        Fit width
      </button>`
    : nothing;
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
    ${[column.sortable ? sortItems : undefined, column.resizable ? fit : undefined, ...groups]
      .filter((section) => section !== undefined)
      .map((section, i) => (i ? [html`<div role="separator"></div>`, section] : section))}
  </div>`;
}

/** Opens a column's menu, places it under its button and focuses its checked (or first) item. */
async function open<T>(state: TableState<T>, columnId: string): Promise<void> {
  state.open = columnId;
  state.host.requestUpdate();
  await state.host.element.updateComplete;
  const popover = menuOf(state, columnId);
  if (!popover || state.open !== columnId) return;
  if (!popover.matches(':popover-open')) popover.showPopover();
  follow(state, columnId, popover);
  const items = itemsOf(popover);
  const checked = items.find((item) => item.getAttribute('aria-checked') === 'true');
  (checked ?? items[0])?.focus();
}

/** Closes the open menu; with a column, focus goes back to its header. */
function close<T>(state: TableState<T>, focusColumn: string | undefined): void {
  if (state.open === undefined) return;
  state.open = undefined;
  if (focusColumn === undefined) state.host.requestUpdate();
  else state.host.focusHeader(focusColumn);
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

function menuOf<T>(state: TableState<T>, columnId: string): HTMLElement | null {
  return state.host.element.querySelector<HTMLElement>(
    `.argus-header-menu[data-column="${CSS.escape(columnId)}"]`,
  );
}

const itemsOf = (popover: HTMLElement) => [
  ...popover.querySelectorAll<HTMLElement>('.argus-header-menu-item'),
];

/**
 * Keeps the menu under its button while it is open: the table scrolls inside
 * its own shadow root, where scroll events don't reach the page. Once a frame,
 * for one menu at a time.
 */
function follow<T>(state: TableState<T>, columnId: string, popover: HTMLElement): void {
  const button = popover.previousElementSibling;
  const step = () => {
    if (state.open !== columnId || !popover.isConnected || !(button instanceof HTMLElement)) return;
    place(popover, button);
    requestAnimationFrame(step);
  };
  step();
}

/**
 * Below the button, its inline-end edge on the button's (the left edge in RTL),
 * within the viewport; above the button when there is no room below.
 */
export function place(popover: HTMLElement, button: HTMLElement): void {
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
