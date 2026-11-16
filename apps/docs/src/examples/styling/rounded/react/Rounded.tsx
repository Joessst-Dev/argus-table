import { ArgusTable, type ColumnDef } from '@argus-table/react';
import '../../styles.css';
import { orderColumns, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [...orderColumns];

export default function Rounded() {
  return (
    <ArgusTable
      className="styling-rounded"
      aria-label="Orders"
      style={{ blockSize: 320 }}
      columns={columns}
      data={orders}
    />
  );
}
