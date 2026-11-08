// Emits @argus-table/react's element bindings: one @lit/react component per
// element, with props typed from the element class and one `on*` prop per event.
import type { ElementInfo } from './manifest.ts';
import { doc, eventTypes, header } from './source.ts';

function component(el: ElementInfo): string {
  const name = el.className;
  const element = `${name}Element`;
  const tp = el.generic ? '<T = unknown>' : '';
  const ta = el.generic ? '<T>' : '';
  const keys = el.properties.map((p) => `'${p.name}'`).join(' | ');
  const handlers = el.events
    .map(
      (e) => `  /** \`${e.name}\`: ${doc(e.description)} */
  ${e.react}?: (event: ${e.type}) => void;`,
    )
    .join('\n');
  const eventMap = el.events.map((e) => `    ${e.react}: '${e.name}',`).join('\n');

  const hasEvents = el.events.length > 0;
  const eventProps = hasEvents
    ? `
/** The event props of \`<${name}>\`: each gets the element's \`CustomEvent\`. */
export interface ${name}EventProps${tp} {
${handlers}
}
`
    : '';
  const ownKeys = hasEvents
    ? `keyof ${name}ElementProps${ta} | keyof ${name}EventProps${ta}`
    : `keyof ${name}ElementProps${ta}`;
  const ownProps = hasEvents
    ? `${name}ElementProps${ta} & ${name}EventProps${ta}`
    : `${name}ElementProps${ta}`;

  return `
/** The properties of \`<${el.tagName}>\` that \`<${name}>\` sets on the element. */
export type ${name}ElementProps${tp} = Partial<Pick<${element}${ta}, ${keys}>>;
${eventProps}
/** Props of \`<${name}>\`: element properties${hasEvents ? ', event handlers' : ''} and the usual HTML attributes. */
export type ${name}Props${tp} = Omit<React.HTMLAttributes<${element}${ta}>, ${ownKeys}> &
  ${ownProps} & {
    /** The \`<${el.tagName}>\` element${el.methods.length ? ', for its methods' : ''}. */
    ref?: React.Ref<${element}${ta}>;
  };

/** \`<${el.tagName}>\` as a React component. */
export const ${name} = createComponent({
  tagName: '${el.tagName}',
  elementClass: ${element},
  react: React,
  events: {
${eventMap}
  },
  displayName: '${name}',
}) as unknown as ${el.generic ? '<T = unknown>' : ''}(props: ${name}Props${ta}) => React.ReactElement | null;
`;
}

/** The whole generated module, unformatted. */
export function emitReact(elements: readonly ElementInfo[]): string {
  const classes = elements.map((el) => `${el.className} as ${el.className}Element`).join(', ');
  const types = eventTypes(elements);
  const typeImport = types.length
    ? `import type { ${types.join(', ')} } from 'argus-table';\n`
    : '';

  return `${header('react')}
import * as React from 'react';
import { createComponent } from '@lit/react';
import { ${classes} } from 'argus-table';
${typeImport}
${elements.map(component).join('')}`;
}
