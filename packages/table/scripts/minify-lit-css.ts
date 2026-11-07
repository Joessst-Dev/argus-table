// Vite plugin: minifies the CSS inside Lit `css` template literals in
// src/styles/ with Lightning CSS. Lit ships those strings as written, comments
// and indentation included, and the JS minifier leaves template literals alone.
// Styles must not interpolate (`${…}`): the build fails if one does.
import { transform } from 'lightningcss';
import type { Plugin } from 'vite';

const TEMPLATE = /\bcss`([^`]*)`/g;

export function minifyLitCss(): Plugin {
  return {
    name: 'argus-minify-lit-css',
    transform(code, id) {
      if (!/[\\/]src[\\/]styles[\\/][^\\/]+\.ts$/.test(id)) return null;
      const out = code.replace(TEMPLATE, (_, body: string) => {
        if (body.includes('${') || body.includes('\\')) {
          throw new Error(`${id}: css\`\` with interpolations or escapes can't be minified`);
        }
        const css = transform({ filename: id, code: Buffer.from(body), minify: true });
        return `css\`${css.code.toString()}\``;
      });
      return { code: out, map: null };
    },
  };
}
