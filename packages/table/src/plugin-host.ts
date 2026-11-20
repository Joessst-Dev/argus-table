import type { ColumnView } from '@argus-table/core';
import type { ColumnInfo } from './plugins.js';
import { content } from './render/content-directive.js';
import { headerText } from './render/header-text.js';
import type { CellContent, ColumnDef, ColumnFilter, ColumnGroup } from './types.js';

/** A data column as plugins see it (`host.column()`); `undefined` for a system column or none. */
export function columnInfoOf<T>(
  view: ColumnView<T, CellContent> | undefined,
  columnFilter: ColumnFilter | undefined,
): ColumnInfo | undefined {
  if (view?.kind !== 'data') return undefined;
  return {
    id: view.id,
    sortable: view.sortable,
    resizable: view.resizable,
    pinnable: view.pinnable,
    hideable: view.hideable,
    groupable: view.groupable,
    pin: view.pin,
    hidden: view.hidden,
    width: view.width,
    sorted: view.sorted === false ? undefined : view.sorted,
    filter: view.filter,
    columnFilter,
    align: view.align,
    meta: view.meta,
  };
}

/** `host.header(def)`: a column's or group's own header, as the table shows it. */
export function pluginHeader<T>(def: ColumnDef<T, unknown> | ColumnGroup<unknown>): unknown {
  const { header } = def;
  const group = 'columns' in def;
  const own =
    typeof header === 'function'
      ? (header as (context: unknown) => unknown)(
          group ? { groupId: def.id, text: false } : { columnId: def.id, text: false },
        )
      : header;
  // A group without a header shows its id; a column shows nothing.
  return content(own ?? (group ? def.id : undefined));
}

/** `host.headerText(def)`: a column's or group's header as plain text. */
export function pluginHeaderText<T>(
  def: ColumnDef<T, unknown> | ColumnGroup<unknown>,
): string | undefined {
  return headerText(
    def.header,
    'columns' in def ? { groupId: def.id, text: true } : { columnId: def.id, text: true },
  );
}
