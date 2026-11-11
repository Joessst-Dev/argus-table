import type { ColumnSizingState } from '@argus-table/core';

/**
 * The width each column's content needs, in px, from the cells rendered now:
 * the header, the pinned rows and the rendered body rows. Rows that haven't
 * loaded are skipped (their skeleton bars say nothing about the content).
 *
 * Every cell of the columns gets `data-measure`, which sizes it to its
 * `max-content` (base styles), so the browser accounts for padding, the sort
 * indicator and whatever the content is. One forced layout, no paint: the
 * attribute is gone before the frame ends. A column with nothing laid out
 * (the table is hidden) is left out.
 */
export function measureColumns(root: ParentNode, ids: Iterable<string>): Map<string, number> {
  const wanted = new Set(ids);
  const widths = new Map<string, number>();
  if (wanted.size === 0) return widths;
  const cells = [...root.querySelectorAll<HTMLElement>('[data-col]')].filter(
    (cell) =>
      wanted.has(cell.dataset.col ?? '') && !cell.parentElement?.matches('[part~="row-loading"]'),
  );
  for (const cell of cells) cell.setAttribute('data-measure', '');
  for (const cell of cells) {
    const id = cell.dataset.col ?? '';
    const px = Math.ceil(cell.getBoundingClientRect().width);
    if (px > 0 && px > (widths.get(id) ?? 0)) widths.set(id, px);
  }
  for (const cell of cells) cell.removeAttribute('data-measure');
  return widths;
}

/**
 * - `provisional`: measured without loaded body rows (the header and pinned rows only).
 * - `final`: measured with loaded rows; kept until the column goes away.
 * - `fonts`: measured while web fonts were loading; measured again once they are ready.
 */
type State = 'provisional' | 'final' | 'fonts';

/**
 * Widths of `width: 'auto'` columns. A column measures once its first loaded
 * rows render, and before that fits the header and pinned rows. So each column
 * is measured at most twice (three times if fonts were still loading), and a
 * table that stays empty doesn't measure on every update. State is keyed by
 * column id, so new `columns` arrays with the same ids don't measure again.
 */
export class AutoWidths {
  /** Measured widths by column id; a new object whenever one changes. */
  widths: ColumnSizingState = {};
  readonly #state = new Map<string, State>();
  #fontsPending = false;
  readonly #requestUpdate: () => void;

  constructor(requestUpdate: () => void) {
    this.#requestUpdate = requestUpdate;
  }

  /** Forgets columns that are gone or no longer `'auto'`, given the ids of the auto columns. */
  sync(ids: Iterable<string>): void {
    const auto = new Set(ids);
    for (const id of this.#state.keys()) {
      if (!auto.has(id)) this.#state.delete(id);
    }
    const kept = Object.entries(this.widths).filter(([id]) => auto.has(id));
    if (kept.length !== Object.keys(this.widths).length) this.widths = Object.fromEntries(kept);
  }

  /**
   * The auto columns still to be measured: never, or without loaded rows yet.
   * With `virtualizeColumns` they render out of view until they are.
   */
  pending(columns: readonly { id: string; auto: boolean }[]): string[] {
    return this.#due(columns, true);
  }

  /** The auto columns never measured, or measured without loaded rows when there are some now. */
  #due(columns: readonly { id: string; auto: boolean }[], hasLoadedRows: boolean): string[] {
    return columns
      .filter((c) => {
        if (!c.auto) return false;
        const state = this.#state.get(c.id);
        return state === undefined || (state === 'provisional' && hasLoadedRows);
      })
      .map((c) => c.id);
  }

  /**
   * Measures the auto columns that need it. Returns `true` if a width changed;
   * the caller then renders again (the one extra pass of the render cycle).
   */
  measure(
    root: ParentNode,
    columns: readonly { id: string; auto: boolean }[],
    hasLoadedRows: boolean,
  ): boolean {
    const due = this.#due(columns, hasLoadedRows);
    if (due.length === 0) return false;
    const measured = measureColumns(root, due);
    const fontsLoading = typeof document !== 'undefined' && document.fonts.status === 'loading';
    let next: ColumnSizingState | undefined;
    for (const [id, px] of measured) {
      this.#state.set(id, fontsLoading ? 'fonts' : hasLoadedRows ? 'final' : 'provisional');
      if (this.widths[id] !== px) (next ??= { ...this.widths })[id] = px;
    }
    if (fontsLoading && measured.size > 0) this.#remeasureAfterFonts();
    if (next) this.widths = next;
    return next !== undefined;
  }

  /** Once web fonts are ready, columns measured meanwhile measure again. */
  #remeasureAfterFonts(): void {
    if (this.#fontsPending) return;
    this.#fontsPending = true;
    void document.fonts.ready.then(() => {
      this.#fontsPending = false;
      let any = false;
      for (const [id, state] of this.#state) {
        if (state === 'fonts') {
          this.#state.delete(id);
          any = true;
        }
      }
      if (any) this.#requestUpdate();
    });
  }
}
