import { ArgusTable, type ColumnDef } from '@argus-table/react';
import '../../styles.css';
import { orderColumns, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [...orderColumns];

export default function Striped() {
  return (
    <ArgusTable
      className="styling-striped"
      aria-label="Orders"
      style={{ blockSize: 320 }}
      columns={columns}
      data={orders}
    />
  );
}
