// Emits @argus-table/angular's element bindings: one standalone component per
// element, on the element's own tag, with `@Input()` setters that write to the
// element, an `@Output()` per event and a `…Change` output per two-way property.
import type { ElementInfo, ElementProperty } from './manifest.ts';
import {
  argusTypes,
  contentType,
  doc,
  header,
  rendersContent,
  usesContentTypes,
  usesGroups,
  type ContentTypes,
} from './source.ts';

/**
 * The strings an input also takes because the element reads them from its
 * attribute, as in HTML: `<argus-column width="90" sortable>`. Angular passes a
 * static attribute to an input of the same name as a string.
 */
function attributeStrings(p: ElementProperty): string {
  if (p.attribute === undefined) return '';
  if (/^number(\s*\|\s*undefined)?$/.test(p.type)) return ' | `${number}`';
  // `rowHeight`: px or 'auto' (already in the type).
  if (/^number\s*\|\s*['"]auto['"](\s*\|\s*undefined)?$/.test(p.type)) {
    return ' | `${number}` | `${number}px`';
  }
  if (/^boolean(\s*\|\s*undefined)?$/.test(p.type)) return " | '' | 'true' | 'false'";
  if (/\bColumnWidth\b/.test(p.type)) return ' | `${number}` | `${number}px` | `${number}fr`';
  return '';
}

const pascal = (camel: string) => camel.charAt(0).toUpperCase() + camel.slice(1);

/**
 * Inputs typed for Angular content (`argusTemplate()` in `header` and `cell`), and
 * `contentRenderer`, which the component sets itself and leaves out of the inputs.
 * Types from `content.ts`.
 */
const CONTENT_INPUTS: ContentTypes = {
  columns: 'readonly AngularColumnDef<T>[]',
  columnGroups: 'readonly AngularColumnGroup[]',
  header: 'AngularCellContent | (() => AngularCellContent)',
  cell: '(row: T, context: CellContext<T>) => AngularCellContent',
  contentRenderer: null,
};

function component(el: ElementInfo): string {
  const name = `${el.className}Component`;
  const element = `${el.className}Element`;
  const tp = el.generic ? '<T = unknown>' : '';
  const ta = el.generic ? '<T>' : '';
  const modelOf = (event: string) => el.models.find((m) => m.event === event);

  const content = rendersContent(el);
  const inputs = el.properties
    .filter((p) => CONTENT_INPUTS[p.name] !== null)
    .map((p) => {
      const attribute = p.attribute === undefined ? 'undefined' : `'${p.attribute}'`;
      const type =
        typeof CONTENT_INPUTS[p.name] === 'string'
          ? `(${contentType(CONTENT_INPUTS, p.name, el.generic)})`
          : `${element}${ta}['${p.name}']${attributeStrings(p)}`;
      // The base puts its template plugin before the user's plugins.
      const body =
        content && p.name === 'plugins'
          ? 'this.setPlugins(value);'
          : `setProperty(this.element, '${p.name}', ${attribute}, value);`;
      return `
  /** ${doc(p.description)} */
  @Input() set ${p.name}(value: ${type} | null | undefined) {
    ${body}
  }`;
    });

  const outputs = el.events.flatMap((e) => {
    const lines = [
      `
  /** \`${e.name}\`: ${doc(e.description)} */
  @Output() readonly ${e.angular} = new EventEmitter<${e.type}>();`,
    ];
    const model = modelOf(e.name);
    if (model) {
      lines.push(`
  /** The new \`${model.property}\` from \`${e.name}\`, for \`[(${model.property})]\`. */
  @Output() readonly ${model.property}Change = new EventEmitter<${element}${ta}['${model.property}']>();`);
    }
    return lines;
  });

  const handlers = el.events.map((e) => {
    const model = modelOf(e.name);
    const modelEmit = model
      ? `\n    this.${model.property}Change.emit(e.detail.${model.detailKey});`
      : '';
    return `
  protected handle${pascal(e.angular)}(event: Event): void {
    // Events bubble: skip those of a table nested in a cell.
    if (event.target !== this.element) return;
    const e = event as ${e.type};
    this.${e.angular}.emit(e);${modelEmit}
  }`;
  });

  const methods = el.methods.map(
    (m) => `
  /** Calls the element's \`${m}()\`. */
  ${m}(...args: Parameters<${element}${ta}['${m}']>): ReturnType<${element}${ta}['${m}']> {
    return this.element.${m}(...args);
  }`,
  );

  const host = el.events.length
    ? `
  host: {
${el.events.map((e) => `    '(${e.name})': 'handle${pascal(e.angular)}($event)',`).join('\n')}
  },`
    : '';

  return `
/** \`<${el.tagName}>\` as an Angular component, on the element's own tag. */
@Component({
  selector: '${el.tagName}',
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,${host}
})
export class ${name}${tp}${content ? ` extends ArgusTableBase${ta}` : ''} {${
    content
      ? ''
      : `
  /** The \`<${el.tagName}>\` element. */
  readonly element: ${element}${ta} = inject<ElementRef<${element}${ta}>>(ElementRef).nativeElement;`
  }
${inputs.join('\n')}
${outputs.join('\n')}
${methods.join('\n')}
${handlers.join('\n')}
}
`;
}

/** The whole generated module, unformatted. */
export function emitAngular(elements: readonly ElementInfo[]): string {
  const classes = elements.map((el) => `${el.className} as ${el.className}Element`);
  const usesContent = usesContentTypes(elements, CONTENT_INPUTS);
  const types = [...classes, ...argusTypes(elements, usesContent)].join(', ');
  const contentNames = [
    ...(elements.some(rendersContent) ? ['ArgusTableBase'] : []),
    ...(usesContent ? ['type AngularCellContent', 'type AngularColumnDef'] : []),
    ...(usesContent && usesGroups(elements) ? ['type AngularColumnGroup'] : []),
  ];
  const contentImport = contentNames.length
    ? `import { ${contentNames.join(', ')} } from '../content.js';\n`
    : '';
  const hasEvents = elements.some((el) => el.events.length > 0);
  const core = [
    'ChangeDetectionStrategy',
    'Component',
    'ElementRef',
    ...(hasEvents ? ['EventEmitter'] : []),
    'Input',
    ...(hasEvents ? ['Output'] : []),
    'ViewEncapsulation',
    'inject',
  ].join(', ');

  return `${header('angular')}
import { ${core} } from '@angular/core';
import type { ${types} } from 'argus-table';
${contentImport}import { setProperty } from '../set-property.js';
${elements.map(component).join('')}`;
}
