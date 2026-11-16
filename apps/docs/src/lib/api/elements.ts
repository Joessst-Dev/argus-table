// The API reference of an element, from argus-table's Custom Elements Manifest.
// Properties, events and two-way bindings come through the wrapper generator's
// reader, so the binding names shown are the ones the wrappers have; the rest
// (descriptions, method signatures, slots, parts, tokens) from the manifest itself.
import { readElement, type Manifest, type Tag } from '@argus-table/generate-wrappers/manifest';

/** The elements the reference documents, in the order the sidebar lists them. */
export const ELEMENT_TAGS: readonly Tag[] = ['argus-table', 'argus-column', 'argus-column-group'];

export interface PropertyRef {
  name: string;
  /** The attribute the property reads, if any. */
  attribute?: string;
  type: string;
  description: string;
  /** The React prop. */
  react: string;
  /** The Vue binding: `:column-sizing`, or `v-model:column-sizing` for two-way state. */
  vue: string;
  /** The Angular binding: `[columnSizing]`, or `[(columnSizing)]` for two-way state. */
  angular: string;
}

export interface EventRef {
  name: string;
  type: string;
  description: string;
  /** The React prop: `onSortingChange`. */
  react: string;
  /** The Vue listener: `@sorting-change`. */
  vue: string;
  /** The Angular output: `(sortingChange)`. */
  angular: string;
  /** The add-on that fires it, for add-on events: `@argus-table/formulas`. */
  from?: string;
}

export interface MethodRef {
  name: string;
  /** `scrollToRow(target: RowTarget, options = {}: ScrollToRowOptions): Promise<boolean>`. */
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
    parameters?: readonly { name: string; default?: string; type?: { text: string } }[];
    return?: { type?: { text: string } };
    description?: string;
  }[];
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

/** The add-on an add-on event comes from, as its description names it. */
function addonOf(description: string, event: string): string {
  const match = /`(@argus-table\/[a-z-]+)`/.exec(description);
  if (!match?.[1]) throw new Error(`Add-on event "${event}" doesn't name its package.`);
  return match[1];
}

/** The reference of one element. `manifest` is `argus-table/custom-elements.json`. */
export function elementReference(manifest: unknown, tag: Tag): ElementRef {
  const info = readElement(manifest as Manifest, tag);
  const decl = declarationOf(manifest as Manifest, tag);
  const twoWay = new Set(info.models.map((m) => m.property));
  const own = new Set((decl.members ?? []).map((m) => m.name));
  const rawEvents = new Set(
    ((decl as { events?: readonly { name: string }[] }).events ?? []).map((e) => e.name),
  );

  const properties = info.properties.map((p): PropertyRef => {
    const model = twoWay.has(p.name);
    return {
      name: p.name,
      ...(p.attribute !== undefined && { attribute: p.attribute }),
      type: p.type,
      description: p.description,
      react: p.name,
      vue: model ? `v-model:${kebab(p.name)}` : `:${kebab(p.name)}`,
      angular: model ? `[(${p.name})]` : `[${p.name}]`,
    };
  });

  const events = info.events.map((e): EventRef => ({
    name: e.name,
    type: e.type,
    description: e.description,
    react: e.react,
    vue: `@${e.vue}`,
    angular: `(${e.angular})`,
    ...(!rawEvents.has(e.name) && { from: addonOf(e.description, e.name) }),
  }));

  const methods = info.methods
    .filter((name) => own.has(name))
    .map((name): MethodRef => {
      const member = decl.members?.find((m) => m.kind === 'method' && m.name === name);
      const params = (member?.parameters ?? [])
        .map((p) => {
          const type = p.type ? `: ${p.type.text}` : '';
          return p.default !== undefined ? `${p.name} = ${p.default}${type}` : `${p.name}${type}`;
        })
        .join(', ');
      const returns = member?.return?.type ? `: ${member.return.type.text}` : '';
      return {
        name,
        signature: `${name}(${params})${returns}`,
        description: member?.description ?? '',
      };
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
