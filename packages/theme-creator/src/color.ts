// Colour math for the theme creator: parse any CSS colour the browser knows,
// convert between sRGB and OKLCH, mix, and measure WCAG contrast.

/** sRGB, each channel 0–1, with alpha 0–1. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** OKLCH: lightness 0–1, chroma ≥ 0, hue in degrees, alpha 0–1. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
  a: number;
}

/**
 * System colours depend on the scheme and the browser; a canvas resolves them
 * one way only. `values.ts` substitutes Canvas and CanvasText; the rest stay
 * unresolved.
 */
const SYSTEM_COLOR =
  /\b(accentcolor|accentcolortext|activetext|buttonborder|buttonface|buttontext|canvas|canvastext|field|fieldtext|graytext|highlight|highlighttext|linktext|mark|marktext|selecteditem|selecteditemtext|visitedtext)\b/i;

let context: CanvasRenderingContext2D | null | undefined;
const parsed = new Map<string, Rgb | undefined>();

/**
 * Any CSS colour (hex, names, rgb(), oklch(), color-mix() without var()) as
 * sRGB, by painting one pixel. Undefined for what isn't a colour. System
 * colours (Canvas) and `currentColor` aren't resolved here: see `resolve.ts`.
 */
export function parseColor(css: string): Rgb | undefined {
  const key = css.trim();
  if (parsed.has(key)) return parsed.get(key);
  const result = paint(key);
  parsed.set(key, result);
  return result;
}

function paint(css: string): Rgb | undefined {
  if (css === '' || /var\(|light-dark\(|currentcolor/i.test(css) || SYSTEM_COLOR.test(css))
    return undefined;
  if (!CSS.supports('color', css)) return undefined;
  context ??= document
    .createElement('canvas')
    .getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
  if (!context) return undefined;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = css;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(0, 0, 1, 1).data;
  return { r: r / 255, g: g / 255, b: b / 255, a: a / 255 };
}

const hex2 = (channel: number) =>
  Math.round(Math.min(1, Math.max(0, channel)) * 255)
    .toString(16)
    .padStart(2, '0');

/** `#rrggbb`, or `rgb(r g b / a)` when the colour isn't opaque. */
export function formatColor({ r, g, b, a }: Rgb): string {
  if (a >= 0.999) return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  const byte = (c: number) => String(Math.round(Math.min(1, Math.max(0, c)) * 255));
  return `rgb(${byte(r)} ${byte(g)} ${byte(b)} / ${String(Math.round(a * 100) / 100)})`;
}

/** `#rrggbb` for `<input type="color">`, ignoring alpha. */
export function toHex(rgb: Rgb): string {
  return formatColor({ ...rgb, a: 1 });
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function toOklch({ r, g, b, a }: Rgb): Oklch {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  const h = c < 1e-6 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h, a };
}

function oklchToLinear({ l: L, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

/** Back to sRGB; out-of-gamut colours lose chroma until they fit. */
export function fromOklch(color: Oklch): Rgb {
  let { c } = color;
  let linear = oklchToLinear(color);
  if (!inGamut(linear)) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 24; i++) {
      c = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ ...color, c }))) lo = c;
      else hi = c;
    }
    linear = oklchToLinear({ ...color, c: lo });
  }
  const [r = 0, g = 0, b = 0] = linear.map((x) => fromLinear(Math.min(1, Math.max(0, x))));
  return { r, g, b, a: color.a };
}

/** `amount` of `b` in `a` (0: all `a`), interpolated in OKLab. */
export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  const x = toOklch(a);
  const y = toOklch(b);
  const ax = x.c * Math.cos((x.h * Math.PI) / 180);
  const bx = x.c * Math.sin((x.h * Math.PI) / 180);
  const ay = y.c * Math.cos((y.h * Math.PI) / 180);
  const by = y.c * Math.sin((y.h * Math.PI) / 180);
  const A = ax + (ay - ax) * amount;
  const B = bx + (by - bx) * amount;
  const c = Math.hypot(A, B);
  return fromOklch({
    l: x.l + (y.l - x.l) * amount,
    c,
    h: c < 1e-6 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
    a: x.a + (y.a - x.a) * amount,
  });
}

/** `top` painted over `bottom`. */
export function over(top: Rgb, bottom: Rgb): Rgb {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const blend = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / a;
  return { r: blend(top.r, bottom.r), g: blend(top.g, bottom.g), b: blend(top.b, bottom.b), a };
}

/** WCAG 2 relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2 contrast ratio (1–21). A translucent foreground is painted over the background first. */
export function contrast(fg: Rgb, bg: Rgb): number {
  const solidBg = bg.a < 1 ? over(bg, { r: 1, g: 1, b: 1, a: 1 }) : bg;
  const solidFg = fg.a < 1 ? over(fg, solidBg) : fg;
  const x = luminance(solidFg);
  const y = luminance(solidBg);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * `fg` with its OKLCH lightness moved away from `bg` until the pair reaches
 * `ratio`, keeping hue and as much chroma as fits. Returns `fg` unchanged when
 * it already passes, and the closest it gets (black or white) otherwise.
 */
export function ensureContrast(fg: Rgb, bg: Rgb, ratio: number): Rgb {
  if (contrast(fg, bg) >= ratio) return fg;
  const start = toOklch(fg);
  const darker = toOklch(bg).l > 0.6;
  let lo = darker ? 0 : start.l;
  let hi = darker ? start.l : 1;
  const at = (l: number) => fromOklch({ ...start, l, a: 1 });
  // The extreme in the direction of more contrast.
  const extreme = at(darker ? 0 : 1);
  if (contrast(extreme, bg) < ratio) return extreme;
  for (let i = 0; i < 30; i++) {
    const l = (lo + hi) / 2;
    const passes = contrast(at(l), bg) >= ratio;
    // Keep the passing side closest to the start.
    if (darker === passes) lo = l;
    else hi = l;
  }
  return at(darker ? lo : hi);
}

/** Black or white, whichever reads better on `bg`. */
export function onColor(bg: Rgb): Rgb {
  const white = { r: 1, g: 1, b: 1, a: 1 };
  const black = { r: 0, g: 0, b: 0, a: 1 };
  return contrast(white, bg) >= contrast(black, bg) ? white : black;
}
