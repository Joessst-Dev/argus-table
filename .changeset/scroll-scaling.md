---
'argus-table': minor
---

Any number of rows now scrolls to the last one. Browsers limit how tall an element can be (about 33.5M px in Chromium and Safari, 17.9M px in Firefox), so before, the last rows of a very large table couldn't be reached: from about 840k rows of 40 px in Chromium and Safari, and in Firefox a table of more than about 450k rows didn't scroll at all. Past the browser's limit the table now renders a shorter body and scales the scroll position onto the rows: the scrollbar still spans every row, and a wheel step covers proportionally more of them. Keyboard navigation, `scrollToRow()` and focus keep working as before. Smaller tables are unchanged.
