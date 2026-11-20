import { ArgusTable } from '@argus-table/react';
import { byRegionAndStatus, saleColumns, type Sale } from '../../data';
import { createSalesSource } from '../../server';

const idOf = (sale: Sale) => sale.id;
// Created once: a new source starts again, without the groups it loaded.
const source = createSalesSource();

export default function Server() {
  // The server groups: getRows gets grouping and the groupPath of the level it fills.
  return (
    <ArgusTable
      aria-label="Sales on the server"
      style={{ blockSize: 380 }}
      columns={saleColumns}
      getRowId={idOf}
      grouping={byRegionAndStatus}
      dataSource={source}
    />
  );
}
