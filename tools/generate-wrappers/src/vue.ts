// Emits @argus-table/vue's element bindings: a description of each element for
// the hand-written `defineWrapper()`, and types in the shape vue-tsc gives a
// generic `<script setup>` component, so templates check props, events,
// `v-model` and exposed methods against the row type.
import type { ElementInfo } from './manifest.ts';
import { doc, eventTypes, header } from './source.ts';

const isBoolean = (type: string) => /^boolean(\s*\|\s*undefined)?$/.test(type);

/** The handler prop Vue matches to an emit: `sort-change` → `onSort-change`, as vue-tsc writes it. */
const handlerProp = (emit: string) => `'on${emit.charAt(0).toUpperCase()}${emit.slice(1)}'`;

function component(el: ElementInfo): string {
  const name = el.className;
  const element = `${name}Element`;
  const tp = el.generic ? '<T = unknown>' : '';
  const ta = el.generic ? '<T>' : '';
  const keys = el.properties.map((p) => `'${p.name}'`).join(' | ');
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
    props: el.properties.map((p) => p.name),
    booleans: el.properties.filter((p) => isBoolean(p.type)).map((p) => p.name),
    events: el.events.map((e) => {
      const model = modelOf(e.name);
      return {
        name: e.name,
        emit: e.vue,
        ...(model ? { model: { property: model.property, detailKey: model.detailKey } } : {}),
      };
    }),
    methods: el.methods,
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
export type ${name}ElementProps${tp} = Partial<Pick<${element}${ta}, ${keys}>>;
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
export interface ${name}Slots {
  /** Rendered as children of the element${name === 'ArgusTable' ? ', for `<ArgusColumn>`' : ''}. */
  default?(): unknown;
}

interface ${name}Context${tp} {
  props: ${name}Props${ta} & PublicProps;
  expose: (exposed: ${name}Exposed${ta}) => void;
  attrs: Record<string, unknown>;
  slots: ${name}Slots;
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
  const types = [...classes, ...eventTypes(elements)].join(', ');

  return `${header('vue')}
import type { PublicProps, VNode } from 'vue';
import type { ${types} } from 'argus-table';
import { defineWrapper } from '../define.js';
${elements.map(component).join('')}`;
}
