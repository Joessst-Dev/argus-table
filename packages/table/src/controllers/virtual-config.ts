import type { TableModel } from '@argus-table/core';
import { panelRowId, rowIdOfPanel } from '../grid.js';
import { bodyCap } from '../max-height.js';
import type { CellContent } from '../types.js';
import type { NavigationController } from './navigation.js';
import type { VirtualConfig } from './virtual-controller.js';

/** The row order and displayed rows last given to the virtualizer, with the measuring token. */
export interface LaidOut {
  order: object;
  display: object;
  token: object;
}

/**
 * What the virtualizer gets for the model's displayed rows (data rows and open
 * panels), and what was laid out, for the next call. The measuring token
 * changes whenever the row at a position may have; when only panels opened or
 * closed, the row at the top keeps its place.
 */
export function virtualConfig<T>(
  model: TableModel<T, CellContent>,
  previous: LaidOut | undefined,
  nav: NavigationController<T>,
  rowPx: number,
  aroundPx: number,
  measuring: boolean,
  auto: boolean,
  details: boolean,
  overscan: number,
): [VirtualConfig, LaidOut] {
  // Body positions: data rows and open panels (`display`); public indexes are data indexes.
  const display = model.display;
  const order = model.rowOrder;
  // Only panels opened or closed: the row at the top keeps its place.
  const keepTop = previous?.order === order && previous.display !== display;
  const token = previous?.order === order && previous.display === display ? previous.token : {};
  const rowIdAt = (index: number): string => {
    const shown = display.at(index);
    if (!shown) return String(index);
    const id = nav.rowId(model, shown.index);
    return shown.kind === 'data' ? id : panelRowId(id);
  };
  const positionOf = (id: string): number | undefined => {
    const owner = rowIdOfPanel(id);
    const index = model.indexOf(owner ?? id);
    if (index === undefined) return undefined;
    return owner === undefined ? display.positionOf(index) : display.detailPositionOf(index);
  };
  const active = nav.active;
  return [
    {
      count: display.count,
      rowHeight: rowPx,
      // The header and pinned rows scroll with the body.
      cap: (logical) => bodyCap(logical, aroundPx),
      measure: measuring ? { order: token, indexOf: positionOf, all: auto } : undefined,
      details: details
        ? {
            isDetail: (index) => display.at(index)?.kind === 'detail',
            dataIndexAt: (index) => display.at(index)?.index ?? -1,
            positionOf,
          }
        : undefined,
      keepTop,
      overscan,
      rowIdAt,
      // The active body row stays rendered, so the tab stop and focus survive scrolling.
      keep:
        active?.section !== 'body' || active.rowId === undefined
          ? undefined
          : { id: active.rowId, index: active.index },
    },
    { order, display, token },
  ];
}
