import {
  cloneVNode,
  defineComponent,
  Fragment,
  h,
  isVNode,
  render,
  type AppContext,
  type ComponentInternalInstance,
  type PropType,
  type VNode,
  type VNodeChild,
} from 'vue';
import type {
  ArgusPlugin,
  CellContent,
  CellContext,
  ColumnDef,
  ColumnGroup,
  ContentRenderer,
  PluginHost,
} from 'argus-table';

/** What a header or cell may return in Vue: VNodes, or what the table renders itself. */
export type VueCellContent = CellContent | VNodeChild;

/** A column whose `header` and `cell` may return VNodes (`h(...)`). */
export type VueColumnDef<T = unknown> = ColumnDef<T, VueCellContent>;

/** A column group (`columnGroups`) whose `header` may be Vue content. */
export type VueColumnGroup = ColumnGroup<VueCellContent>;

/** What a `#header-<id>` slot gets. */
export interface HeaderSlotProps {
  columnId: string;
}

/** What a `#group-<id>` slot gets. */
export interface GroupSlotProps {
  groupId: string;
}

/**
 * The app context cells render with: the wrapper's app (global components,
 * directives, `app.provide`), with the injections `<ArgusTable>` itself sees, so
 * cells also get what its ancestors `provide()`. Vue resolves a root's injections
 * from `vnode.appContext.provides`; `provides` is internal to the instance.
 */
function contextOf(instance: ComponentInternalInstance): AppContext {
  const provides = (instance as unknown as { provides?: AppContext['provides'] }).provides;
  return provides ? { ...instance.appContext, provides } : instance.appContext;
}

/**
 * Renders VNodes from `header`, `cell` and slots into the table's pooled targets with
 * Vue's `render()`, which patches what a target already shows: a pooled cell updates
 * its components as it shows other rows. Synchronous, so there's nothing to flush.
 */
export function vueRenderer(instance: ComponentInternalInstance): ContentRenderer {
  const appContext = contextOf(instance);
  return {
    render(target, content) {
      let vnode: VNode = isVNode(content) ? content : h(Fragment, null, content as VNodeChild[]);
      // A VNode already mounted somewhere (cached by the caller) is copied, not reused.
      if (vnode.el) vnode = cloneVNode(vnode);
      vnode.appContext = appContext;
      render(vnode, target);
    },
    release(target) {
      render(null, target);
    },
  };
}

/** Slots on `<ArgusTable>` that give a column its cells or header, and a column group its header. */
const CELL = 'cell-';
const HEADER = 'header-';
const GROUP = 'group-';

type Slots = Readonly<Record<string, ((props: never) => VNodeChild) | undefined>>;

/** The names of the cell and header slots, to notice when they change. */
export function slotKey(slots: Slots): string {
  return Object.keys(slots)
    .filter((name) => name.startsWith(CELL) || name.startsWith(HEADER) || name.startsWith(GROUP))
    .sort()
    .join('\n');
}

/**
 * Renders one slot. The slot runs in this component's own render, so Vue tracks
 * the parent state it reads: when that changes, the cell renders again by itself,
 * without the table. A compiled slot is "stable", so the parent changing doesn't
 * re-render `<ArgusTable>` (or call the slot) otherwise.
 */
const ArgusSlot = defineComponent({
  name: 'ArgusSlot',
  props: {
    slots: { type: Object as PropType<Slots>, required: true },
    name: { type: String, required: true },
    slotProps: { type: Object, required: true },
  },
  setup(props) {
    return () => {
      const slot = props.slots[props.name] as ((p: object) => VNodeChild) | undefined;
      return slot?.(props.slotProps);
    };
  },
});

/**
 * The plugin that turns `#cell-<id>` and `#header-<id>` slots into a column's `cell`
 * and `header`, and `#group-<id>` slots into a column group's `header`. First among the table's plugins, so `formulas()` and `headerMenu()`
 * wrap what it gives. Each cell renders through `ArgusSlot`, which looks the slot up
 * when it renders, so the latest slot function always runs.
 */
export function slotPlugin(
  slots: Slots,
  connected: (host: PluginHost | undefined) => void,
): ArgusPlugin {
  const render = (name: string, slotProps: object) =>
    h(ArgusSlot, { slots, name, slotProps }) as unknown as CellContent;
  return {
    name: 'vue-slots',
    connect(host) {
      connected(host);
      return () => {
        connected(undefined);
      };
    },
    columns(defs) {
      return defs.map((def) => {
        const id = def.id;
        const cell = slots[CELL + id] !== undefined;
        const header = slots[HEADER + id] !== undefined;
        if (!cell && !header) return def;
        return {
          ...def,
          ...(cell && {
            cell: (_row: unknown, context: CellContext<unknown>) => render(CELL + id, context),
          }),
          ...(header && { header: () => render(HEADER + id, { columnId: id }) }),
        };
      });
    },
    columnGroups(groups) {
      const withSlots = (group: ColumnGroup): ColumnGroup => {
        const id = group.id;
        const columns = group.columns.map((c) => (typeof c === 'string' ? c : withSlots(c)));
        const changed = columns.some((c, i) => c !== group.columns[i]);
        if (slots[GROUP + id] === undefined) return changed ? { ...group, columns } : group;
        return { ...group, columns, header: () => render(GROUP + id, { groupId: id }) };
      };
      return groups.map(withSlots);
    },
  };
}
