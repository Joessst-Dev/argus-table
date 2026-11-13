// Glyph widths of Helvetica and Helvetica-Bold, the PDF base-14 fonts, in
// 1/1000 em for the WinAnsi codes 32-255, two base-36 digits each (0: no glyph).
// Taken from Liberation Sans, which has Helvetica's metrics.
const REGULAR =
  '7q7q9vfgfgopij5b9999atg87q997q7qfgfgfgfgfgfgfgfgfgfg7q7qg8g8g8fgs7ijijk2k2ijgzlmk27qdwijfgn5k2lmijlmk2ijgzk2ijq8ijijgz7q7q7qd1fg99fgfgdwfgfg7qfgfg6666dw66n5fgfgfgfg99dw7qfgdwk2dwdwdw9a789ag800fg0066fg99rsfgfg99rsij99rs00gz0000666699999qfgrs99rsdw99q800dwij7q99fgfgfgfg78fg99khaafgg899khfcb4f9999999g0ex999999a5fgn6n6n6gzijijijijijijrsk2ijijijij7q7q7q7qk2k2lmlmlmlmlmg8lmk2k2k2k2ijijgzfgfgfgfgfgfgopdwfgfgfgfg7q7q7q7qfgfgfgfgfgfgfgf9gzfgfgfgfgdwfgdw';
const BOLD =
  '7q99d6fgfgopk26m9999atg87q997q7qfgfgfgfgfgfgfgfgfgfg9999g8g8g8gzr3k2k2k2k2ijgzlmk27qfgk2gzn5k2lmijlmk2ijgzk2ijq8ijijgz997q99g8fg99fggzfggzfg99gzgz7q7qfg7qopgzgzgzgzatfg99gzfglmfgfgdwat7satg800fg007qfgdwrsfgfg99rsij99rs00gz00007q7qdwdw9qfgrs99rsfg99q800dwij7q99fgfgfgfg7sfg99khaafgg899khfcb4f9999999g0fg999999a5fgn6n6n6gzk2k2k2k2k2k2rsk2ijijijij7q7q7q7qk2k2lmlmlmlmlmg8lmk2k2k2k2ijijgzfgfgfgfgfgfgopfgfgfgfgfg7q7q7q7qgzgzgzgzgzgzgzf9gzgzgzgzgzfggzfg';

const decode = (table: string) =>
  Array.from({ length: table.length / 2 }, (_, i) => parseInt(table.slice(i * 2, i * 2 + 2), 36));

let widths: [number[], number[]] | undefined;

/** The width of WinAnsi codes in a base-14 Helvetica, in points at `size`. */
export function textWidth(codes: readonly number[], bold: boolean, size: number): number {
  widths ??= [decode(REGULAR), decode(BOLD)];
  const table = widths[bold ? 1 : 0];
  let units = 0;
  for (const code of codes) units += table[code - 32] ?? 0;
  return (units * size) / 1000;
}
