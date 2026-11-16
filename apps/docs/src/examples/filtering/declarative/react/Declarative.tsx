import { ArgusColumn, ArgusTable, type ColumnFilterState } from '@argus-table/react';
import { orders } from '../../data';

const rows = orders.slice(0, 200);
const filters: ColumnFilterState = { city: { kind: 'set', values: ['Quito'] } };

export default function Declarative() {
  return (
    <ArgusTable aria-label="Orders" style={{ blockSize: 280 }} data={rows} columnFilters={filters}>
      <ArgusColumn columnId="id" header="Order" accessor="id" width={100} />
      <ArgusColumn columnId="customer" header="Customer" accessor="customer" filter="text" />
      <ArgusColumn columnId="city" header="City" accessor="city" filter="set" />
    </ArgusTable>
  );
}
