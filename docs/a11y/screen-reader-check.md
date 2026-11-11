# Screen-reader check

Run this before every minor release, as [Accessibility](../plan/plan/08-accessibility.md) requires. Before v0.1 it also settles an open question from [ADR 0001](../adr/0001-shadow-vs-light-dom.md#follow-ups). Body rows sit in the DOM in pool order, not visual order. Is `aria-rowindex` enough for screen readers to read them in order, with the right numbers?

## Setup

```bash
pnpm install
pnpm play        # the playground at http://localhost:5173
```

Open `http://localhost:5173/?rows=1000&cols=8`. That's 1,000 people and 8 columns:

- `#` and Name are pinned at the start;
- the actions column (an "Open" button) is pinned at the end.

Use both pairs:

| Screen reader     | Browser | Start      | Table reading keys                                                                                      |
| ----------------- | ------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| VoiceOver (macOS) | Safari  | Cmd+F5     | VO = Ctrl+Option. VO+arrows move by cell. VO+Shift+Down enters the table.                               |
| NVDA (Windows)    | Firefox | Ctrl+Alt+N | Ctrl+Alt+arrows move by cell in browse mode. Tab and arrows work in focus mode (NVDA+Space toggles it). |

## Steps

Write down what is announced for each step, and whether it passes.

1. **Name and size.** Tab into the page until focus lands on the table.
   - **Expect:** a grid or table named "People", with 1,001 rows (1,000 plus the header) and 8 columns.
2. **Headers.** Press ArrowRight across the header row.
   - **Expect:** each column header by name: #, Name, Email, …
   - Name and City are sortable. Press Enter on Name, and "sorted ascending" is announced (or the sort state is read when you move back to it).
3. **Arrow keys, row by row.** Move into the body and press ArrowDown 10 times.
   - **Expect:** rows 2, 3, 4, … in order (the header is row 1), with each cell read under its column header.
   - The "#" value goes 0, 1, 2, … and matches the row number minus 2.
4. **After scrolling.** Press ArrowDown about 60 more times, past the rendered window, so rows get recycled.
   - **Expect:** row numbers keep climbing by one. No row is skipped, repeated or read out of order.
5. **Jump far away.** With the mouse or trackpad, scroll to roughly the middle of the table. Then click a cell, or Tab back into the table.
   - **Expect:** the announced row number matches the "#" value plus 2.
6. **Screen-reader navigation, not focus.** This is where DOM order matters most.
   - VoiceOver: VO+Up and VO+Down, row by row, then VO+Right across the cells.
   - NVDA, browse mode: Ctrl+Alt+Down and Ctrl+Alt+Up, then Down arrow (reads the next line).
   - **Expect:** rows in visual order with the right numbers, both near the top and after step 5.
   - **Watch for:** a jump to an unexpected row, which is DOM order leaking through.
7. **Pinned columns.** Move along a row to the end.
   - **Expect:** `#`, Name, the scrolling columns, then the Open button, in visual order.
8. **Right to left.** Reload with `&dir=rtl` and repeat steps 3 and 7.
   - **Expect:** the same order and numbers. ArrowLeft now moves toward the end.
9. **Page and corner keys.** Back in left to right, press PageDown twice, then Ctrl+End (Cmd+End with VoiceOver), then Ctrl+Home.
   - **Expect:** after each PageDown, a row number one page further on; after Ctrl+End, row 1,001 in the last column; after Ctrl+Home, the "#" header.
10. **Column groups.** Reload with `&groups`: three header rows, with Contact over Email and Location, Location over City and Country, and Order and Extra.
    - Focus the City header and press ArrowUp twice, then ArrowDown twice.
    - **Expect:** "Location", then "Contact", each read as a column header spanning its columns (VoiceOver may say "spans 2 columns"); then Location and City again. The grid now has 1,003 rows, and the first body row is row 4.
    - Move along the top header row with ArrowRight.
    - **Expect:** Contact, Order, Extra. The empty cells over `#`, Name and the actions column are skipped by the arrow keys.
    - With the screen reader's own table navigation (step 6), move through the header rows.
    - **Expect:** the empty cells read as blank cells, not as headers, and each body cell is read under its column header (and, depending on the reader, its group).
    - Press Alt+Shift+ArrowRight on Order.
    - **Expect:** "Order moved to columns 8 to 10 of 21" (the numbers depend on `cols`).

## Recording the result

Add the results to the ADR 0001 follow-up as a dated note. Give the OS, browser and screen-reader versions, and the pass or fail for each step. If step 4 or 6 fails, the fix the ADR names is to sort rows in the DOM only once scrolling settles. That needs its own measurement before it ships.
