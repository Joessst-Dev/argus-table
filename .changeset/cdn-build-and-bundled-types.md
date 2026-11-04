---
'argus-table': minor
---

Ship a CDN build and bundled type declarations.

- `dist/cdn/argus-table.js` is one minified ES module with Lit and TanStack inlined, for use straight from jsDelivr or unpkg (`<script type="module" src="https://cdn.jsdelivr.net/npm/argus-table">`).
- The type declarations are one `dist/index.d.ts` with no import of internal packages.
