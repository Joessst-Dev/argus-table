// The runtime of the Vue wrappers. The generated module describes each element
// (its properties, events, two-way properties and methods); this turns such a
// description into a component that renders the element.
import 'argus-table';
import { defineComponent, h, shallowRef, watchEffect, type PropType } from 'vue';

export interface WrapperEvent {
  /** The DOM event, e.g. `argus-sort-change`. */
  name: string;
  /** The Vue event, e.g. `sort-change`. */
  emit: string;
  /** For two-way binding: the property, and the detail field holding its new value. */
  model?: { property: string; detailKey: string };
}

export interface WrapperSpec {
  /** Component name, e.g. `ArgusTable`. */
  name: string;
  tag: string;
  /** Element properties the component passes on. */
  props: readonly string[];
  /** Those that are booleans: `<ArgusColumn sortable>` means `true`, not `''`. */
  booleans: readonly string[];
  events: readonly WrapperEvent[];
  /** Element methods the component exposes. */
  methods: readonly string[];
}

type ElementRecord = HTMLElement & Record<string, unknown>;

/** `argus-sort-change` → `onArgusSortChange`, which Vue listens to as `argus-sort-change`. */
function listenerKey(event: string): string {
  return `on${event
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')}`;
}

export function defineWrapper(spec: WrapperSpec) {
  // No type checks: the element owns its types. Booleans get Boolean casting,
  // and every default is `undefined`, so a prop that isn't bound stays unset.
  const props: Record<string, { type: PropType<unknown> | null; default: undefined }> = {};
  for (const name of spec.props) {
    props[name] = { type: spec.booleans.includes(name) ? Boolean : null, default: undefined };
  }

  const emits = spec.events.flatMap((e) =>
    e.model ? [e.emit, `update:${e.model.property}`] : [e.emit],
  );

  return defineComponent({
    name: spec.name,
    props,
    emits,
    setup(componentProps, { emit, expose, slots }) {
      const element = shallowRef<ElementRecord>();
      const values = componentProps as Record<string, unknown>;

      // Properties are set on the element directly, not through Vue's DOM prop
      // patching, which turns a removed number into 0 and a string into ''.
      // As with @lit/react: unbound props are never set, and a prop that goes
      // away sets `undefined`, which hands state back to the element.
      const applied = new Map<string, unknown>();
      watchEffect(
        () => {
          const el = element.value;
          if (!el) return;
          for (const name of spec.props) {
            const value = values[name];
            const changed = applied.has(name) ? applied.get(name) !== value : value !== undefined;
            if (!changed) continue;
            el[name] = value;
            applied.set(name, value);
          }
        },
        { flush: 'post' },
      );

      const listeners: Record<string, (event: Event) => void> = {};
      for (const e of spec.events) {
        listeners[listenerKey(e.name)] = (event) => {
          // Events bubble: skip those of a table nested in a cell.
          if (event.target !== event.currentTarget) return;
          emit(e.emit, event);
          if (e.model) {
            const detail = (event as CustomEvent<Record<string, unknown>>).detail;
            emit(`update:${e.model.property}`, detail[e.model.detailKey]);
          }
        };
      }

      const exposed: Record<string, unknown> = { element };
      for (const method of spec.methods) {
        exposed[method] = (...args: unknown[]): unknown => {
          const el = element.value;
          if (!el) throw new Error(`<${spec.name}> isn't mounted.`);
          return (el[method] as (...a: unknown[]) => unknown).apply(el, args);
        };
      }
      expose(exposed);

      return () => h(spec.tag, { ref: element, ...listeners }, slots.default?.());
    },
  });
}
