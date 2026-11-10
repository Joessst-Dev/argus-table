// Emits @argus-table/react's element bindings: one @lit/react component per
// element, with props typed from the element class and one `on*` prop per event.
import type { ElementInfo } from './manifest.ts';
import { doc, eventTypes, header } from './source.ts';

/**
 * Properties typed for React content (JSX in `header` and `cell`), and `contentRenderer`,
 * which the wrapper sets itself and leaves out of the props. Types from `content.tsx`.
 */
const CONTENT_PROPS: Readonly<Record<string, string | null>> = {
  columns: 'readonly ReactColumnDef<T>[] | null',
  header: 'ReactCellContent | (() => ReactCellContent)',
  cell: '(row: T, context: CellContext<T>) => ReactCellContent',
  contentRenderer: null,
};

/** A content property's type; the row type is `unknown` for an element that isn't generic. */
function typeFor(property: string, generic: boolean): string {
  const type = CONTENT_PROPS[property] ?? 'unknown';
  return generic ? type : type.replace(/\bT\b/g, 'unknown');
}

/** Whether an element renders content: the wrapper then gives it a React content renderer. */
const rendersContent = (el: ElementInfo) => el.properties.some((p) => p.name === 'contentRenderer');

function component(el: ElementInfo): string {
  const name = el.className;
  const element = `${name}Element`;
  const tp = el.generic ? '<T = unknown>' : '';
  const ta = el.generic ? '<T>' : '';
  const plain = el.properties.filter((p) => !(p.name in CONTENT_PROPS));
  const typed = el.properties.filter((p) => typeof CONTENT_PROPS[p.name] === 'string');
  const keys = plain.map((p) => `'${p.name}'`).join(' | ');
  const contentProps = typed.length
    ? ` & {\n${typed.map((p) => `  ${p.name}?: ${typeFor(p.name, el.generic)};`).join('\n')}\n}`
    : '';
  const handlers = el.events
    .map(
      (e) => `  /** \`${e.name}\`: ${doc(e.description)} */
  ${e.react}?: (event: ${e.type}) => void;`,
    )
    .join('\n');
  const eventMap = el.events.map((e) => `    ${e.react}: '${e.name}',`).join('\n');

  const hasEvents = el.events.length > 0;
  const created = `createComponent({
  tagName: '${el.tagName}',
  elementClass: ${element},
  react: React,
  events: {
${eventMap}
  },
  displayName: '${name}',
})`;
  // Events bubble, so a table nested in a cell would reach the outer table's
  // handlers: ownEvents() only passes the element's own events on.
  const withEvents = hasEvents
    ? `ownEvents(${created}, [${el.events.map((e) => `'${e.react}'`).join(', ')}], '${name}')`
    : created;
  // The table renders React content from `header` and `cell` through portals.
  const base = rendersContent(el) ? `withContent(${withEvents}, '${name}')` : withEvents;
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
export type ${name}ElementProps${tp} = Partial<Pick<${element}${ta}, ${keys}>>${contentProps};
${eventProps}
/** Props of \`<${name}>\`: element properties${hasEvents ? ', event handlers' : ''} and the usual HTML attributes. */
export type ${name}Props${tp} = Omit<React.HTMLAttributes<${element}${ta}>, ${ownKeys}> &
  ${ownProps} & {
    /** The \`<${el.tagName}>\` element${el.methods.length ? ', for its methods' : ''}. */
    ref?: React.Ref<${element}${ta}>;
  };

/** \`<${el.tagName}>\` as a React component. */
export const ${name} = ${base} as unknown as ${el.generic ? '<T = unknown>' : ''}(props: ${name}Props${ta}) => React.ReactElement | null;
`;
}

/** The whole generated module, unformatted. */
export function emitReact(elements: readonly ElementInfo[]): string {
  const classes = elements.map((el) => `${el.className} as ${el.className}Element`).join(', ');
  const types = eventTypes(elements);
  const content = elements.some((el) =>
    el.properties.some((p) => typeof CONTENT_PROPS[p.name] === 'string'),
  );
  if (content && !types.includes('CellContext')) types.push('CellContext');
  types.sort();
  const typeImport = types.length
    ? `import type { ${types.join(', ')} } from 'argus-table';\n`
    : '';
  const contentImports = [
    ...(elements.some(rendersContent) ? ['withContent'] : []),
    ...(content ? ['type ReactCellContent', 'type ReactColumnDef'] : []),
  ];
  const contentImport = contentImports.length
    ? `import { ${contentImports.join(', ')} } from '../content.js';\n`
    : '';

  return `${header('react')}
import * as React from 'react';
import { createComponent } from '@lit/react';
import { ${classes} } from 'argus-table';
${typeImport}${contentImport}${elements.some((el) => el.events.length > 0) ? "import { ownEvents } from '../own-events.js';\n" : ''}
${elements.map(component).join('')}`;
}
