import { html, render, type RootPart } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type {
  ColumnView,
  GroupRowInfo,
  HeaderGroupCell,
  RowPin,
  TableModel,
} from '@argus-table/core';
import { firstDataColumn } from './body.js';
import type { RenderedColumn } from '../controllers/column-window.js';
import type { WindowRow } from '../controllers/virtual-controller.js';
import type { CellContent } from '../types.js';
import { cellSlot, detailSlot, formatValue, groupSlot, headerSlot, pinnedSlot } from './content.js';
import { content } from './content-directive.js';

type Column<T> = ColumnView<T, CellContent>;

/**
 * Renders header and cell content into the host's light DOM, as direct children
 * (a slot only takes the host's own children). Keyed and ordered by pool slot,
 * so recycled content updates in place instead of moving (ADR 0001). The part
 * ends at `renderBefore`, so the host's other children (`<argus-column>`) stay
 * outside it, wherever they are added. `rendered` are the columns the shadow
 * root renders, with their slots and keys. What `header` and `cell` return goes
 * through `content()`, so foreign content reaches the table's `contentRenderer`.
 * Group headers come first, one per group and pin side (`groups`, the header's
 * group rows). `details` are the panel pool's slots: an empty element each, which
 * the table fills with the panel shown there.
 * Returns the part, which the table disconnects when it is disconnected.
 */
export function renderLightDom<T>(
  host: HTMLElement,
  model: TableModel<T, CellContent>,
  rows: readonly WindowRow[],
  rendered: readonly RenderedColumn<T>[],
  groups: readonly (readonly HeaderGroupCell<CellContent>[])[],
  renderBefore: ChildNode,
  details: readonly WindowRow[] = [],
  emptyGroup = '',
): RootPart {
  // The selection column renders its checkboxes in the shadow root: no content here.
  const columns = rendered.filter((c) => c.kind === 'data');
  // Group rows (`grouping`): their value in the tree column, totals in the others.
  const { rows: structure } = model;
  const grouped = structure.grouped;
  const treeColumn = grouped ? firstDataColumn(model.columns) : undefined;
  const groupCells = groups.flat().filter((g) => g.kind === 'group');
  return render(
    html`${repeat(
      groupCells,
      (g) => g.key,
      (g) => html`<div slot=${groupSlot(g.slot)}>${groupContent(g)}</div>`,
    )}${repeat(
      columns,
      (c) => c.key,
      (c) => html`<div slot=${headerSlot(c.slot)}>${headerContent(c)}</div>`,
    )}${pinnedContent(model, columns, 'top')}${repeat(
      rows,
      (r) => r.slot,
      (r) => {
        const group = grouped ? structure.groupAt(r.row) : undefined;
        return repeat(
          columns,
          (c) => c.key,
          (c) => {
            const value = group
              ? groupCellContent(group, r.row, c, c.id === treeColumn, emptyGroup)
              : cellContent(model, r.row, c);
            return html`<div slot=${cellSlot(r.slot, c.slot)}>${value}</div>`;
          },
        );
      },
    )}${pinnedContent(model, columns, 'bottom')}${repeat(
      details,
      (r) => r.slot,
      // The panel's content is put inside by the table (it is kept per row).
      (r) => html`<div slot=${detailSlot(r.slot)} class="argus-detail-slot"></div>`,
    )}`,
    host,
    { host, renderBefore },
  );
}

/** A group's header: its own content, else its id. Only groups, no fillers, get here. */
function groupContent(group: HeaderGroupCell<CellContent>): unknown {
  const { header } = group;
  const groupId = group.groupId ?? '';
  return content(
    (typeof header === 'function' ? header({ groupId, text: false }) : header) ?? groupId,
  );
}

function headerContent<T>(column: Column<T>): unknown {
  const { header } = column;
  return content(
    typeof header === 'function' ? header({ columnId: column.id, text: false }) : header,
  );
}

/** Content of the rows pinned to one side, slotted by side, index and column. */
/**
 * Whether the table renders its light DOM before the shadow root when it grows
 * (`lightCount`): in WebKit (Safari, every browser on iOS) only.
 *
 * WebKit assigns a new child to a slot that exists in time proportional to the
 * slots in the shadow root, but a new slot to a child that is already there in
 * no time: n added cells cost O(n) going in before their slots, O(n²) after them
 * (200 columns: 18 s to render every column, 0.8 s). Removed cells cost O(n²)
 * either way, about 1.7 times as much with the children gone first. Chromium and
 * Firefox are the other way round: a new slot looks for its child among all of
 * the host's children, so content first is O(n²) there.
 */
export let contentFirst = webKit();

function webKit(): boolean {
  return typeof navigator === 'object' && navigator.vendor === 'Apple Computer, Inc.';
}

/** Tests: render content first in any engine (`undefined`: by the engine again). */
export function setContentFirstForTests(on: boolean | undefined): void {
  contentFirst = on ?? webKit();
}

/**
 * How many children `renderLightDom` renders for these arguments. With content
 * first, the light DOM goes first when it adds at least as many cells as it
 * removes, which its count tells: the kept ones cancel out.
 */
export function lightCount<T>(
  model: TableModel<T, CellContent>,
  rows: readonly WindowRow[],
  rendered: readonly RenderedColumn<T>[],
  groups: readonly (readonly HeaderGroupCell<CellContent>[])[],
  details: readonly WindowRow[],
): number {
  // The header, the pinned rows and the body rows, by the data columns.
  const lines = 1 + model.pinnedCount('top') + model.pinnedCount('bottom') + rows.length;
  return (
    lines * rendered.filter((c) => c.kind === 'data').length +
    groups.flat().filter((g) => g.kind === 'group').length +
    details.length
  );
}

function pinnedContent<T>(
  model: TableModel<T, CellContent>,
  columns: readonly RenderedColumn<T>[],
  side: RowPin,
) {
  const rows = Array.from({ length: model.pinnedCount(side) }, (_, i) => i);
  return rows.map((i) =>
    repeat(
      columns,
      (c) => c.key,
      (c) => html`<div slot=${pinnedSlot(side, i, c.slot)}>${pinnedCell(model, side, i, c)}</div>`,
    ),
  );
}

function pinnedCell<T>(
  model: TableModel<T, CellContent>,
  side: RowPin,
  index: number,
  column: Column<T>,
) {
  if (column.cell) {
    const context = model.pinnedCellContext(side, index, column.id);
    return context ? content(column.cell(context.row, context)) : '';
  }
  return column.hasAccessor ? formatValue(model.pinnedValueAt(side, index, column.id)) : '';
}

/**
 * A group row's cell: the column's `groupCell`, else the group's value in the
 * tree column (`emptyGroup` for the group of empty values) and the column's
 * total in the others.
 */
function groupCellContent<T>(
  group: GroupRowInfo,
  index: number,
  column: Column<T>,
  tree: boolean,
  emptyGroup: string,
) {
  const total = group.totals[column.id];
  if (column.groupCell) {
    return content(column.groupCell({ ...group, index, columnId: column.id, total }));
  }
  if (!tree) return formatValue(total);
  return group.value === undefined ? emptyGroup : formatValue(group.value);
}

function cellContent<T>(model: TableModel<T, CellContent>, index: number, column: Column<T>) {
  if (column.cell) {
    const context = model.cellContext(index, column.id);
    return context ? content(column.cell(context.row, context)) : '';
  }
  return column.hasAccessor ? formatValue(model.valueAt(index, column.id)) : '';
}
