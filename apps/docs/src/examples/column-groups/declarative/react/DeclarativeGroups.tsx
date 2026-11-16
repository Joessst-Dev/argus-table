import { ArgusColumn, ArgusColumnGroup, ArgusTable } from '@argus-table/react';
import { orders } from '../../data';

const rows = orders.slice(0, 50);

export default function DeclarativeGroups() {
  return (
    <ArgusTable aria-label="Declarative groups" style={{ blockSize: 300 }} data={rows}>
      <ArgusColumn columnId="id" header="Order" accessor="id" width={100} />
      {/* Header content other than text: JSX, or a function that gets { text }. */}
      <ArgusColumnGroup groupId="who" header={({ text }) => (text ? 'Who' : <strong>Who</strong>)}>
        <ArgusColumn columnId="customer" header="Customer" accessor="customer" />
        <ArgusColumn columnId="city" header="City" accessor="city" width={120} />
      </ArgusColumnGroup>
      <ArgusColumn columnId="total" header="Total" accessor="total" align="end" />
    </ArgusTable>
  );
}
