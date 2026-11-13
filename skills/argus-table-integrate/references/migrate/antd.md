# From Ant Design `Table`

Covers `Table` from `antd` (v4, v5).

## Detect

`import { Table } from 'antd'` with `<Table columns dataSource rowKey>`; columns typed `TableColumnsType<T>` / `ColumnsType<T>` with `title` and `dataIndex`.

## Concepts

| Feature id        | Ant Design                                               | argus-table                                                              | Fit     | Notes                                                               |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------- |
| `columns`         | `dataIndex: 'name'` or `['address', 'city']`, `key`      | `id`, `accessor: 'name'` / `'address.city'`                              | maps    |                                                                     |
| `render`          | `render: (value, record, index) => …`                    | `cell: (row, ctx) => …` (`ctx.value`, `ctx.index`)                       | maps    | Argument order differs                                              |
| `sorter`          | `sorter: (a, b) => …`, `sortOrder`, `defaultSortOrder`   | `sortable: true` (the table compares values), `sorting`                  | maps    | Custom compare: sort by an `accessor` that returns a sortable value |
| `multi-sort`      | `sorter: { compare, multiple: 2 }`                       | `sorting` with several items, set by the app                             | partial |                                                                     |
| `filters`         | `filters: [{ text, value }]`, `onFilter`                 | `filter: 'set'`, `filterOptions`, `filterFn`                             | maps    | Users filter from the column menu                                   |
| `filter-dropdown` | `filterDropdown` (custom UI)                             | header-menu's filter form                                                | partial | No custom filter UI in the menu                                     |
| `fixed`           | `fixed: 'left' / 'right'`                                | `pin: 'start' / 'end'`                                                   | maps    |                                                                     |
| `selection`       | `rowSelection={{ type, selectedRowKeys, onChange }}`     | `selectionMode`, `selectionCheckboxes`, `selection`, `onSelectionChange` | maps    | `type: 'radio'` → `selectionMode="single"`                          |
| `row-key`         | `rowKey="id"` (or a function)                            | `getRowId={(r) => String(r.id)}`                                         | maps    |                                                                     |
| `pagination`      | on by default, `pagination={{ pageSize }}`               | none: the table scrolls                                                  | gap     | `pagination={false}` tables need nothing                            |
| `server`          | `onChange(pagination, filters, sorter)` + fetch, `total` | `dataSource={{ getRows }}`                                               | maps    | [server-data.md](../server-data.md); note the name clash below      |
| `scroll-y`        | `scroll={{ y: 400 }}`                                    | the table's height                                                       | maps    |                                                                     |
| `virtual`         | `virtual`                                                | built in                                                                 | builtin |                                                                     |
| `expandable`      | `expandable={{ expandedRowRender }}`                     | none                                                                     | gap     | [gaps.md](../gaps.md#master-detail)                                 |
| `summary`         | `summary={() => <Table.Summary.Row>…}`                   | `pinnedRows.bottom`                                                      | partial | A totals row object                                                 |
| `children`        | column `children: [...]` (grouped headers)               | `columnGroups`                                                           | maps    |                                                                     |
| `tree-data`       | `children` in rows, `childrenColumnName`                 | none                                                                     | gap     | [gaps.md](../gaps.md#tree-data)                                     |
| `editable`        | editable cells via `components.body`                     | none                                                                     | gap     | [gaps.md](../gaps.md#editing)                                       |
| `locale`          | `locale={{ emptyText }}`                                 | the `empty` slot, `labels`                                               | maps    |                                                                     |
| `row-click`       | `onRow={(record) => ({ onClick })}`                      | `onRowClick`                                                             | maps    |                                                                     |

**Name clash:** antd's `dataSource` is the row array; argus-table's `dataSource` is a `{ getRows }` loader. antd `dataSource={rows}` → argus-table `data={rows}`.

## Columns

| antd column                        | `ColumnDef`                                      |
| ---------------------------------- | ------------------------------------------------ |
| `title: 'Name'`                    | `header: 'Name'`                                 |
| `dataIndex: 'name'`, `key: 'name'` | `id: 'name', accessor: 'name'`                   |
| `dataIndex: ['address', 'city']`   | `accessor: 'address.city'`                       |
| `width: 120`                       | `width: 120`                                     |
| `align: 'right'`                   | `align: 'end'`                                   |
| `ellipsis: true`                   | the default                                      |
| `render: (text) => <a>{text}</a>`  | `cell: (row, ctx) => <a>{ctx.value}</a>`         |
| `sorter: (a, b) => a.age - b.age`  | `sortable: true`                                 |
| `filters` + `onFilter`             | `filter: 'set'`, `filterOptions: [...]` (values) |
| `fixed: 'left'`                    | `pin: 'start'`                                   |

## State and events

- `rowSelection.selectedRowKeys` / `onChange(keys)` → `selection` / `onSelectionChange` (`e.detail.selection`).
- `onChange(pagination, filters, sorter)` for server data → `getRows({ start, end, sorting, filters })`.
- `sortOrder: 'descend'` controlled → `sorting={[{ id, desc: true }]}` with `onSortingChange`.

## Example

```tsx
// Before
<Table<Customer> columns={columns} dataSource={data} rowKey="key"
  rowSelection={{ type: 'checkbox', selectedRowKeys, onChange: setSelectedRowKeys }}
  pagination={{ pageSize: 20 }} scroll={{ y: 400 }} />

// After
<ArgusTable<Customer> aria-label="Customers" style={{ height: 460 }} columns={columns} data={data}
  getRowId={getRowId} selectionMode="multi" selectionCheckboxes
  selection={selectedRowKeys} onSelectionChange={(e) => setSelectedRowKeys(e.detail.selection)} />
```

## Gaps

Pagination, expandable rows, tree data, editable cells, custom filter dropdowns. See [gaps.md](../gaps.md).

## Remove

The `Table` import and its `Table.Summary` usage; keep `antd` for the rest of the app. Ant Design's `ConfigProvider` theme doesn't style argus-table.

## Behaviour differences

- No pagination by default (antd paginates at 10 rows unless told otherwise).
- Sorting uses the column's value (`accessor`), not a compare function.
- Theme: `minimal` or `default`, then map antd's `colorPrimary`, `borderRadius` and font to tokens (or the `argus-table-theme` skill).
