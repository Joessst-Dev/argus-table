// Storybook's story frame, where theme-creator links from before the switch
// open (`iframe.html?id=themes-theme-creator--creator&viewMode=story#theme=…`):
// a page that sends any story frame URL on to its new page, hash kept.
import type { APIRoute } from 'astro';
import { redirectScript } from '../lib/old-urls';

export const GET: APIRoute = () => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <title>argus-table</title>
    <script>${redirectScript(base)}</script>
  </head>
  <body>
    <noscript><p>This page moved: <a href="${base}/">argus-table's docs</a>.</p></noscript>
  </body>
</html>
`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};
