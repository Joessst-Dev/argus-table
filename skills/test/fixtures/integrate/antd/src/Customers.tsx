import { Table, type TableColumnsType } from 'antd';

interface Customer {
  key: string;
  name: string;
  age: number;
  city: string;
}

const columns: TableColumnsType<Customer> = [
  { title: 'Name', dataIndex: 'name', fixed: 'left', sorter: (a, b) => a.name.localeCompare(b.name) },
  { title: 'Age', dataIndex: 'age', sorter: (a, b) => a.age - b.age, align: 'right' },
  {
    title: 'City',
    dataIndex: 'city',
    filters: [
      { text: 'Berlin', value: 'Berlin' },
      { text: 'Paris', value: 'Paris' },
    ],
    onFilter: (value, record) => record.city === value,
    render: (city: string) => <b>{city}</b>,
  },
];

export function Customers({ data }: { data: Customer[] }) {
  return (
    <Table<Customer>
      columns={columns}
      dataSource={data}
      rowKey="key"
      rowSelection={{ type: 'checkbox' }}
      pagination={{ pageSize: 20 }}
      expandable={{ expandedRowRender: (record) => <p>{record.city}</p> }}
      scroll={{ y: 400 }}
    />
  );
}
