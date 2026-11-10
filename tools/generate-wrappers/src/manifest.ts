// Reads argus-table's Custom Elements Manifest into the model the framework
// emitters work from. Anything a wrapper depends on is checked here, so a
// renamed property or event fails the generator instead of quietly dropping
// out of a wrapper.

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
  /** The DOM event name, e.g. `argus-sort-change`. */
  name: string;
  /** The event type as documented with `@fires {…}`, e.g. `CustomEvent<SortChangeDetail>`. */
  type: string;
  /** The `@fires` description. */
  description: string;
  /** React prop: `onSortChange`. */
  react: string;
  /** Vue emit: `sort-change`. */
  vue: string;
  /** Angular output: `sortChange`. */
  angular: string;
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
export const TAGS = ['argus-table', 'argus-column'] as const;
export type Tag = (typeof TAGS)[number];

/** Properties with two-way binding, by element: the property, its event and the detail field. */
export const MODELS: Readonly<Record<Tag, readonly ElementModel[]>> = {
  'argus-table': [
    { property: 'sorting', event: 'argus-sort-change', detailKey: 'sorting' },
    { property: 'columnSizing', event: 'argus-column-resize', detailKey: 'sizing' },
    { property: 'columnOrder', event: 'argus-column-reorder', detailKey: 'order' },
    { property: 'columnPinning', event: 'argus-column-pin', detailKey: 'pinning' },
    { property: 'columnVisibility', event: 'argus-column-hide', detailKey: 'visibility' },
    { property: 'columnFilters', event: 'argus-column-filter', detailKey: 'filters' },
    { property: 'selection', event: 'argus-row-select', detailKey: 'selection' },
  ],
  'argus-column': [],
};

/** Public methods that aren't API for wrapper users (they serve the table itself). */
const INTERNAL_METHODS: Readonly<Record<Tag, readonly string[]>> = {
  'argus-table': [],
  'argus-column': ['toColumnDef'],
};

const EVENT_PREFIX = 'argus-';

/** `sort-change` → `SortChange`. */
function pascal(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** `sort-change` → `sortChange`. */
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

  const events = (decl.events ?? []).map((e) => {
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

  const methods = members
    .filter((m) => m.kind === 'method' && !INTERNAL_METHODS[tag].includes(m.name))
    .map((m) => m.name);

  const models = MODELS[tag];
  for (const model of models) {
    if (!properties.some((p) => p.name === model.property)) {
      throw new Error(`<${tag}> has no property "${model.property}" to bind two-way.`);
    }
    if (!events.some((e) => e.name === model.event)) {
      throw new Error(`<${tag}> has no event "${model.event}" for "${model.property}".`);
    }
    // Angular's two-way binding needs an output named `…Change`; an event's own
    // output can't take that name too.
    const output = `${model.property}Change`;
    const taken = events.find((e) => e.angular === output);
    if (taken) {
      throw new Error(
        `<${tag}> event "${taken.name}" collides with the Angular output "${output}" of [(${model.property})].`,
      );
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
