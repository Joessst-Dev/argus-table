---
'@argus-table/formulas': minor
'@argus-table/header-menu': patch
'@argus-table/themes': minor
---

**Breaking (formulas):** the formula editor's text-colour tokens end in `-fg`, like every other text colour:

- `--argus-formula-error-color` → `--argus-formula-error-fg`
- `--argus-formula-function-color` → `--argus-formula-function-fg`
- `--argus-formula-ref-color` → `--argus-formula-ref-fg`
- `--argus-formula-number-color` → `--argus-formula-number-fg`
- `--argus-formula-text-color` → `--argus-formula-text-fg`

**Fallbacks (column menu and formula editor):** each token now has one fallback per role:

- Lines and popup edges fall back to 20% of the text colour.
- Form controls fall back to 30% of the text colour.
- The hovered item falls back to 10% of the text colour.

**Themes:** all five themes set the add-on tokens (`--argus-menu-*`, `--argus-dialog-*`, `--argus-formula-*`), so the column menu and the formula editor take on each theme. They also follow the renamed table tokens (`--argus-border`, `--argus-border-radius`, `--argus-row-odd-bg`, `--argus-row-pinned-bg`).
