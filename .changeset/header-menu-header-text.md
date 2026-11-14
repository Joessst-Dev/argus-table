---
'@argus-table/header-menu': minor
---

The column menu names columns whose header is a template, JSX or a slot by the header's plain text (`header: ({ text }) => (text ? 'Total' : …)`) in its "Hidden columns" items and announcements, instead of by their ids. The menu's own header passes that text on, so other plugins and the table see it too.
