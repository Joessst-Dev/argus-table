// Emits @argus-table/angular's element bindings: one standalone component per
// element, on the element's own tag, with `@Input()` setters that write to the
// element, an `@Output()` per event and a `…Change` output per two-way property.
import type { ElementInfo, ElementProperty } from './manifest.ts';
import { doc, eventTypes, header } from './source.ts';

/**
 * The strings an input also takes because the element reads them from its
 * attribute, as in HTML: `<argus-column width="90" sortable>`. Angular passes a
 * static attribute to an input of the same name as a string.
 */
function attributeStrings(p: ElementProperty): string {
  if (p.attribute === undefined) return '';
  if (/^number(\s*\|\s*undefined)?$/.test(p.type)) return ' | `${number}`';
  if (/^boolean(\s*\|\s*undefined)?$/.test(p.type)) return " | '' | 'true' | 'false'";
  if (/\bColumnWidth\b/.test(p.type)) return ' | `${number}` | `${number}px` | `${number}fr`';
  return '';
}

const pascal = (camel: string) => camel.charAt(0).toUpperCase() + camel.slice(1);

function component(el: ElementInfo): string {
  const name = `${el.className}Component`;
  const element = `${el.className}Element`;
  const tp = el.generic ? '<T = unknown>' : '';
  const ta = el.generic ? '<T>' : '';
  const modelOf = (event: string) => el.models.find((m) => m.event === event);

  const inputs = el.properties.map((p) => {
    const attribute = p.attribute === undefined ? 'undefined' : `'${p.attribute}'`;
    return `
  /** ${doc(p.description)} */
  @Input() set ${p.name}(value: ${element}${ta}['${p.name}']${attributeStrings(p)} | null | undefined) {
    setProperty(this.element, '${p.name}', ${attribute}, value);
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
export class ${name}${tp} {
  /** The \`<${el.tagName}>\` element. */
  readonly element: ${element}${ta} = inject<ElementRef<${element}${ta}>>(ElementRef).nativeElement;
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
  const types = [...classes, ...eventTypes(elements)].join(', ');
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
import { setProperty } from '../set-property.js';
${elements.map(component).join('')}`;
}
