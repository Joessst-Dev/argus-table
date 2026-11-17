// The API reference of an element, from argus-table's Custom Elements Manifest.
// Properties, events and two-way bindings come through the wrapper generator's
// reader, so the binding names shown are the ones the wrappers have; the rest
// (descriptions, defaults, method signatures, slots, parts, tokens) from the
// manifest itself.
import {
  readElement,
  WRAPPER_PROPERTIES,
  type Manifest,
  type Tag,
} from '@argus-table/generate-wrappers/manifest';

/** The elements the reference documents, in the order the sidebar lists them. */
export const ELEMENT_TAGS: readonly Tag[] = ['argus-table', 'argus-column', 'argus-column-group'];

/** How a wrapper binds a property or listens to an event. */
export interface Bindings {
  /** The React prop: `columnSizing`, `onSortingChange`. */
  react: string;
  /** The Vue binding: `:column-sizing`, `v-model:column-sizing`, `@sorting-change`. */
  vue: string;
  /** The Angular binding: `[columnSizing]`, `[(columnSizing)]`, `(sortingChange)`. */
  angular: string;
}

export interface PropertyRef {
  name: string;
  /** The attribute the property reads, if any. */
  attribute?: string;
  type: string;
  /** The default, as the source writes it: `'comfortable'`. */
  default?: string;
  description: string;
  /** How the wrappers bind it; none for a property the wrappers set themselves. */
  bindings?: Bindings;
}

export interface EventRef {
  name: string;
  type: string;
  description: string;
  bindings: Bindings;
  /**
   * For a state change (`argus-sorting-change`): the property whose new value
   * Angular's output emits, instead of the event.
   */
  angularEmits?: string;
  /** The add-on that fires it, for add-on events: `@argus-table/formulas`. */
  from?: string;
}

export interface MethodRef {
  name: string;
  /** `scrollToRow(target: RowTarget, options?: ScrollToRowOptions): Promise<boolean>`. */
  signature: string;
  description: string;
}

export interface NamedDoc {
  name: string;
  description: string;
  default?: string;
}

export interface ElementRef {
  tag: Tag;
  className: string;
  description: string;
  properties: PropertyRef[];
  events: EventRef[];
  methods: MethodRef[];
  slots: NamedDoc[];
  parts: NamedDoc[];
  tokens: NamedDoc[];
}

/** The parts of a declaration the generator's reader doesn't keep. */
interface Declaration {
  name: string;
  tagName?: string;
  description?: string;
  members?: readonly {
    kind: string;
    name: string;
    default?: string;
    parameters?: readonly {
      name: string;
      optional?: boolean;
      default?: string;
      type?: { text: string };
    }[];
    return?: { type?: { text: string } };
    description?: string;
  }[];
  events?: readonly { name: string }[];
  slots?: readonly RawDoc[];
  cssParts?: readonly RawDoc[];
  cssProperties?: readonly RawDoc[];
}

interface RawDoc {
  name: string;
  description?: string;
  default?: string;
}

/** `columnSizing` → `column-sizing`. */
const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function declarationOf(manifest: Manifest, tag: Tag): Declaration {
  for (const mod of manifest.modules) {
    for (const decl of (mod.declarations ?? []) as readonly Declaration[]) {
      if (decl.tagName === tag) return decl;
    }
  }
  throw new Error(`<${tag}> isn't in the manifest.`);
}

const docs = (list: readonly RawDoc[] | undefined): NamedDoc[] =>
  (list ?? []).map((d) => ({
    name: d.name,
    description: d.description ?? '',
    ...(d.default !== undefined && { default: d.default }),
  }));

/**
 * The add-on an add-on event comes from, as its description names it (the
 * descriptions in the generator's `ADDON_EVENTS` start "From `x()` (`@argus-table/…`)").
 */
function addonOf(description: string, event: string): string {
  const match = /`(@argus-table\/[a-z-]+)`/.exec(description);
  if (!match?.[1]) throw new Error(`Add-on event "${event}" doesn't name its package.`);
  return match[1];
}

/** The reference of one element. `manifest` is `argus-table/custom-elements.json`. */
export function elementReference(manifest: unknown, tag: Tag): ElementRef {
  const info = readElement(manifest as Manifest, tag);
  const decl = declarationOf(manifest as Manifest, tag);
  const models = new Map(info.models.map((m) => [m.event, m.property]));
  const twoWay = new Set(info.models.map((m) => m.property));
  const member = (name: string) => decl.members?.find((m) => m.name === name);
  const ownEvents = new Set((decl.events ?? []).map((e) => e.name));

  const properties = info.properties.map((p): PropertyRef => {
    const model = twoWay.has(p.name);
    const fallback = member(p.name)?.default;
    return {
      name: p.name,
      ...(p.attribute !== undefined && { attribute: p.attribute }),
      type: p.type,
      ...(fallback !== undefined && { default: fallback }),
      description: p.description,
      ...(!WRAPPER_PROPERTIES.includes(p.name) && {
        bindings: {
          react: p.name,
          vue: model ? `v-model:${kebab(p.name)}` : `:${kebab(p.name)}`,
          angular: model ? `[(${p.name})]` : `[${p.name}]`,
        },
      }),
    };
  });

  const events = info.events.map((e): EventRef => {
    const property = models.get(e.name);
    return {
      name: e.name,
      type: e.type,
      description: e.description,
      bindings: { react: e.react, vue: `@${e.vue}`, angular: `(${e.angular})` },
      ...(property !== undefined && { angularEmits: property }),
      ...(!ownEvents.has(e.name) && { from: addonOf(e.description, e.name) }),
    };
  });

  const methods = info.methods.flatMap((name): MethodRef[] => {
    const method = member(name);
    if (method?.kind !== 'method') return [];
    const params = (method.parameters ?? [])
      .map((p) => {
        const optional = p.optional === true || p.default !== undefined ? '?' : '';
        return `${p.name}${optional}${p.type ? `: ${p.type.text}` : ''}`;
      })
      .join(', ');
    const returns = method.return?.type ? `: ${method.return.type.text}` : '';
    return [
      { name, signature: `${name}(${params})${returns}`, description: method.description ?? '' },
    ];
  });

  return {
    tag,
    className: info.className,
    description: decl.description ?? '',
    properties,
    events,
    methods,
    slots: docs(decl.slots),
    parts: docs(decl.cssParts),
    tokens: docs(decl.cssProperties),
  };
}
