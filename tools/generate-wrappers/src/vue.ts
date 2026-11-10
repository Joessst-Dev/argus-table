// Emits @argus-table/vue's element bindings: a description of each element for
// the hand-written `defineWrapper()`, and types in the shape vue-tsc gives a
// generic `<script setup>` component, so templates check props, events,
// `v-model` and exposed methods against the row type.
import type { ElementInfo } from './manifest.ts';
import { doc, eventTypes, header } from './source.ts';

const isBoolean = (type: string) => /^boolean(\s*\|\s*undefined)?$/.test(type);

/** The handler prop Vue matches to an emit: `sort-change` → `onSort-change`, as vue-tsc writes it. */
const handlerProp = (emit: string) => `'on${emit.charAt(0).toUpperCase()}${emit.slice(1)}'`;

/**
 * Properties typed for Vue content (VNodes in `header` and `cell`), and `contentRenderer`,
 * which the wrapper sets itself and leaves out of the props. Types from `content.ts`.
 */
const CONTENT_PROPS: Readonly<Record<string, string | null>> = {
  columns: 'readonly VueColumnDef<T>[] | null',
  header: 'VueCellContent | (() => VueCellContent)',
  cell: '(row: T, context: CellContext<T>) => VueCellContent',
  contentRenderer: null,
};

/** A content property's type; the row type is `unknown` for an element that isn't generic. */
function typeFor(property: string, generic: boolean): string {
  const type = CONTENT_PROPS[property] ?? 'unknown';
  return generic ? type : type.replace(/\bT\b/g, 'unknown');
}

/** Whether an element renders content: the wrapper then renders VNodes and slots into it. */
const rendersContent = (el: ElementInfo) => el.properties.some((p) => p.name === 'contentRenderer');

function component(el: ElementInfo): string {
  const name = el.className;
  const element = `${name}Element`;
  const tp = el.generic ? '<T = unknown>' : '';
  const ta = el.generic ? '<T>' : '';
  const content = rendersContent(el);
  const passed = el.properties.filter((p) => CONTENT_PROPS[p.name] !== null);
  const plain = el.properties.filter((p) => !(p.name in CONTENT_PROPS));
  const typed = el.properties.filter((p) => typeof CONTENT_PROPS[p.name] === 'string');
  const keys = plain.map((p) => `'${p.name}'`).join(' | ');
  const contentProps = typed.length
    ? ` & {\n${typed.map((p) => `  ${p.name}?: ${typeFor(p.name, el.generic)};`).join('\n')}\n}`
    : '';
  const slotTp = content ? tp : '';
  const slotTa = content ? ta : '';
  const contentSlots = content
    ? `
  /** \`#cell-<column id>\`: a column's cells. Gets the row and its context. */
  [slot: \`cell-\${string}\`]: ((props: CellContext<${el.generic ? 'T' : 'unknown'}>) => VNodeChild) | undefined;
  /** \`#header-<column id>\`: a column's header. */
  [slot: \`header-\${string}\`]: ((props: HeaderSlotProps) => VNodeChild) | undefined;`
    : '';
  const modelOf = (event: string) => el.models.find((m) => m.event === event);

  const handlers = el.events.flatMap((e) => {
    const lines = [
      `  /** \`${e.name}\`: ${doc(e.description)} */
  ${handlerProp(e.vue)}?: (event: ${e.type}) => void;`,
    ];
    const model = modelOf(e.name);
    if (model) {
      lines.push(`  /** \`v-model:${model.property}\`: the new \`${model.property}\` from \`${e.name}\`. */
  ${handlerProp(`update:${model.property}`)}?: (value: ${element}${ta}['${model.property}']) => void;`);
    }
    return lines;
  });

  const emitSignatures = el.events.flatMap((e) => {
    const lines = [`  (event: '${e.vue}', payload: ${e.type}): void;`];
    const model = modelOf(e.name);
    if (model) {
      lines.push(
        `  (event: 'update:${model.property}', value: ${element}${ta}['${model.property}']): void;`,
      );
    }
    return lines;
  });

  const exposedMethods = el.methods.map((m) => `  ${m}: ${element}${ta}['${m}'];`);

  const spec = {
    name,
    tag: el.tagName,
    props: passed.map((p) => p.name),
    booleans: passed.filter((p) => isBoolean(p.type)).map((p) => p.name),
    events: el.events.map((e) => {
      const model = modelOf(e.name);
      return {
        name: e.name,
        emit: e.vue,
        ...(model ? { model: { property: model.property, detailKey: model.detailKey } } : {}),
      };
    }),
    methods: el.methods,
    ...(content ? { content: true } : {}),
  };

  const eventProps = handlers.length
    ? `
/** The event props of \`<${name}>\`, which \`@event\` and \`v-model\` bind. */
export interface ${name}EventProps${tp} {
${handlers.join('\n')}
}
`
    : '';
  const props = handlers.length
    ? `${name}ElementProps${ta} & ${name}EventProps${ta}`
    : `${name}ElementProps${ta}`;
  const emit = emitSignatures.length
    ? `
/** The events \`<${name}>\` emits. */
export interface ${name}Emit${tp} {
${emitSignatures.join('\n')}
}
`
    : '';

  return `
/** The properties of \`<${el.tagName}>\` that \`<${name}>\` sets on the element. */
export type ${name}ElementProps${tp} = Partial<Pick<${element}${ta}, ${keys}>>${contentProps};
${eventProps}
/** Props of \`<${name}>\`: element properties${handlers.length ? ' and event handlers' : ''}. Other attributes go to the element. */
export type ${name}Props${tp} = ${props};
${emit}
/** What a template ref to \`<${name}>\` gives. */
export interface ${name}Exposed${tp} {
  /** The \`<${el.tagName}>\` element; \`undefined\` until mounted. */
  readonly element: ${element}${ta} | undefined;
${exposedMethods.join('\n')}
}

/** The slots of \`<${name}>\`. */
export interface ${name}Slots${slotTp} {
  /** Rendered as children of the element${name === 'ArgusTable' ? ', for `<ArgusColumn>`' : ''}. */
  default?(): unknown;${contentSlots}
}

interface ${name}Context${tp} {
  props: ${name}Props${ta} & PublicProps;
  expose: (exposed: ${name}Exposed${ta}) => void;
  attrs: Record<string, unknown>;
  slots: ${name}Slots${slotTa};
  emit: ${emitSignatures.length ? `${name}Emit${ta}` : '(event: never) => void'};
}

/** \`<${el.tagName}>\` as a Vue component. */
export const ${name} = defineWrapper(${JSON.stringify(spec)}) as unknown as ${tp}(
  props: ${name}Context${ta}['props'],
  ctx?: Pick<${name}Context${ta}, 'attrs' | 'emit' | 'slots'>,
  expose?: ${name}Context${ta}['expose'],
  setup?: Promise<${name}Context${ta}>,
) => VNode & { __ctx?: ${name}Context${ta} };
`;
}

/** The whole generated module, unformatted. */
export function emitVue(elements: readonly ElementInfo[]): string {
  const classes = elements.map((el) => `${el.className} as ${el.className}Element`);
  const usesContent = elements.some((el) =>
    el.properties.some((p) => typeof CONTENT_PROPS[p.name] === 'string'),
  );
  const named = eventTypes(elements);
  if (usesContent && !named.includes('CellContext')) named.push('CellContext');
  named.sort();
  const types = [...classes, ...named].join(', ');
  const vue = usesContent ? 'PublicProps, VNode, VNodeChild' : 'PublicProps, VNode';
  const contentTypes = [
    ...(elements.some(rendersContent) ? ['HeaderSlotProps'] : []),
    ...(usesContent ? ['VueCellContent', 'VueColumnDef'] : []),
  ];
  const contentImport = contentTypes.length
    ? `import type { ${contentTypes.join(', ')} } from '../content.js';\n`
    : '';

  return `${header('vue')}
import type { ${vue} } from 'vue';
import type { ${types} } from 'argus-table';
${contentImport}import { defineWrapper } from '../define.js';
${elements.map(component).join('')}`;
}
