/** A column taking part in a group resize: its width now, and its bounds. */
export interface SpreadColumn {
  id: string;
  width: number;
  minWidth: number;
  maxWidth: number;
}

/**
 * Spreads `total` px over columns in proportion to their widths, each within its
 * bounds: a column that hits a bound keeps it, and the rest is spread over the
 * others. Widths are whole px that add up to `total` (rounded) as far as the
 * bounds allow. Columns of no width share equally.
 */
export function spreadWidth(columns: readonly SpreadColumn[], total: number): Map<string, number> {
  const exact = new Map<string, number>();
  let open = [...columns];
  let remaining = total;
  while (open.length > 0) {
    const sum = open.reduce((s, c) => s + Math.max(0, c.width), 0);
    const share = (c: SpreadColumn) =>
      sum > 0 ? (Math.max(0, c.width) / sum) * remaining : remaining / open.length;
    const clamped = open.filter((c) => {
      const w = share(c);
      return w < c.minWidth || w > c.maxWidth;
    });
    if (clamped.length === 0) {
      for (const c of open) exact.set(c.id, share(c));
      break;
    }
    for (const c of clamped) {
      const w = Math.min(c.maxWidth, Math.max(c.minWidth, share(c)));
      exact.set(c.id, w);
      remaining -= w;
    }
    open = open.filter((c) => !clamped.includes(c));
  }
  // Whole px: round the running sum, so the parts add up to the rounded total.
  const widths = new Map<string, number>();
  let acc = 0;
  let rounded = 0;
  for (const c of columns) {
    acc += exact.get(c.id) ?? c.width;
    const next = Math.round(acc);
    widths.set(c.id, next - rounded);
    rounded = next;
  }
  return widths;
}
