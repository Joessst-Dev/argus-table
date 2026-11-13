// Reads argus-table's Custom Elements Manifest into the model the framework
// emitters work from. Anything a wrapper depends on is checked here, so a
// renamed property or event fails the generator instead of quietly dropping
// out of a wrapper.
import { ADDON_EVENTS } from './addon-events.ts';

/** The subset of the Custom Elements Manifest schema the generator reads. */
export interface Manifest {
  modules: readonly {
    declarations?: readonly ManifestDeclaration[];
  }[];
}

interface ManifestDeclaration {
  kind: string;
  name: string;
  tagName?: string;
  customElement?: boolean;
  members?: readonly {
    kind: string;
    name: string;
    static?: boolean;
    privacy?: string;
    type?: { text: string };
    attribute?: string;
    description?: string;
  }[];
  events?: readonly { name: string; type?: { text: string }; description?: string }[];
}

export interface ElementProperty {
  /** The element's property name, e.g. `columnSizing`. */
  name: string;
  /** The type as written in the source, e.g. `readonly ColumnDef<T>[]`. */
  type: string;
  /** The attribute the property reads, e.g. `row-height`; none for property-only ones. */
  attribute?: string;
  /** The property's JSDoc. */
  description: string;
}

export interface ElementEvent {
  /** The DOM event name, e.g. `argus-sorting-change`. */
  name: string;
  /** The event type as documented with `@fires {…}`, e.g. `CustomEvent<SortingChangeDetail>`. */
  type: string;
  /** The `@fires` description. */
  description: string;
  /** React prop: `onSortingChange`. */
  react: string;
  /** Vue emit: `sorting-change`. */
  vue: string;
  /** Angular output: `sortingChange`. */
  angular: string;
  /**
   * An add-on's event (`ADDON_EVENTS`): the wrapper module its types come from,
   * instead of `argus-table`.
   */
  from?: string;
}

/** A property kept in sync with an event: two-way binding in Vue and Angular. */
export interface ElementModel {
  property: string;
  /** The DOM event that carries the new value. */
  event: string;
  /** The field of the event's detail that holds the new value. */
  detailKey: string;
}

export interface ElementInfo {
  tagName: string;
  /** Whether the element class takes the row type `T` (some member type mentions it). */
  generic: boolean;
  /** The class name exported by `argus-table`, e.g. `ArgusTable`. */
  className: string;
  properties: readonly ElementProperty[];
  events: readonly ElementEvent[];
  methods: readonly string[];
  models: readonly ElementModel[];
}

/** The elements every wrapper covers. */
const TAGS = ['argus-table', 'argus-column', 'argus-column-group'] as const;
export type Tag = (typeof TAGS)[number];

/** Public methods that aren't API for wrapper users (they serve the table itself). */
const INTERNAL_METHODS: Readonly<Record<Tag, readonly string[]>> = {
  'argus-table': [],
  'argus-column': ['toColumnDef'],
  'argus-column-group': ['toColumnGroup'],
};

const EVENT_PREFIX = 'argus-';

/** `sorting-change` → `SortingChange`. */
function pascal(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** `sorting-change` → `sortingChange`. */
function camel(kebab: string): string {
  const p = pascal(kebab);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/** The names an `argus-*` event gets in each framework. */
export function eventNames(name: string): Pick<ElementEvent, 'react' | 'vue' | 'angular'> {
  if (!name.startsWith(EVENT_PREFIX)) {
    throw new Error(`Event "${name}" doesn't start with "${EVENT_PREFIX}".`);
  }
  const short = name.slice(EVENT_PREFIX.length);
  return { react: `on${pascal(short)}`, vue: short, angular: camel(short) };
}

/** `columnSizing` → `column-sizing`. */
function kebab(camelCase: string): string {
  return camelCase.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * The event that reports a change of a property, by the naming rule of ADR 0004:
 * `columnSizing` → `argus-column-sizing-change`, with the value in `detail.columnSizing`.
 */
export function changeEventOf(property: string): string {
  return `${EVENT_PREFIX}${kebab(property)}-change`;
}

function findElement(manifest: Manifest, tag: Tag): ManifestDeclaration {
  for (const mod of manifest.modules) {
    for (const decl of mod.declarations ?? []) {
      if (decl.tagName === tag) return decl;
    }
  }
  throw new Error(`<${tag}> isn't in the manifest.`);
}

/** Reads one element. Throws when a model or an event type is missing. */
export function readElement(manifest: Manifest, tag: Tag): ElementInfo {
  const decl = findElement(manifest, tag);
  const members = (decl.members ?? []).filter(
    (m) => !m.static && (m.privacy === undefined || m.privacy === 'public'),
  );

  const properties = members
    .filter((m) => m.kind === 'field')
    .map((m) => {
      if (!m.type) throw new Error(`<${tag}> property "${m.name}" has no type in the manifest.`);
      const property = { name: m.name, type: m.type.text, description: m.description ?? '' };
      return m.attribute ? { ...property, attribute: m.attribute } : property;
    });

  const own = (decl.events ?? []).map((e) => {
    if (!e.type) {
      throw new Error(
        `<${tag}> event "${e.name}" has no type: document it as @fires {CustomEvent<…>} ${e.name}.`,
      );
    }
    return {
      name: e.name,
      type: e.type.text,
      description: e.description ?? '',
      ...eventNames(e.name),
    };
  });
  const addons = (ADDON_EVENTS[tag] ?? []).map((e) => ({ ...e, ...eventNames(e.name) }));
  const events: ElementEvent[] = [...own, ...addons];

  const methods = members
    .filter((m) => m.kind === 'method' && !INTERNAL_METHODS[tag].includes(m.name))
    .map((m) => m.name);

  // Two-way binding follows the naming rule: a property with an
  // `argus-<property>-change` event, whose detail holds the value under the
  // property's name. Its Angular output is `<property>Change`, which `[(…)]` needs.
  const models = properties.flatMap((p) => {
    const event = changeEventOf(p.name);
    return events.some((e) => e.name === event)
      ? [{ property: p.name, event, detailKey: p.name }]
      : [];
  });
  // Add-on events report actions the app applies, not state, so they keep their names.
  for (const e of own) {
    if (e.name.endsWith('-change') && e.name !== 'argus-range-change') {
      if (!models.some((m) => m.event === e.name)) {
        throw new Error(
          `<${tag}> event "${e.name}" looks like a state change but matches no property: name it argus-<property>-change.`,
        );
      }
    }
  }

  // A wrapper prop must mean one thing: an element property or an event handler.
  for (const e of events) {
    if (properties.some((p) => p.name === e.react || p.name === e.angular)) {
      throw new Error(`<${tag}> event "${e.name}" collides with a property of the same name.`);
    }
  }

  const mentionsT = (text: string) => /\bT\b/.test(text);
  const generic = [...properties, ...events].some((x) => mentionsT(x.type));

  return { tagName: tag, className: decl.name, generic, properties, events, methods, models };
}

/** Reads every element the wrappers cover. */
export function readElements(manifest: Manifest): readonly ElementInfo[] {
  return TAGS.map((tag) => readElement(manifest, tag));
}

/**
 * Type names a type text refers to, for importing them: `CustomEvent<CellClickDetail<T>>`
 * → `CellClickDetail`. Globals and the row type parameter are left out.
 */
export function referencedTypes(text: string): string[] {
  const globals = new Set(['T', 'CustomEvent', 'Event', 'Promise', 'Record', 'Node']);
  const names = text.match(/\b[A-Z][A-Za-z0-9]*\b/g) ?? [];
  return [...new Set(names)].filter((n) => !globals.has(n));
}
