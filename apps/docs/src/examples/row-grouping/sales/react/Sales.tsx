import { useState } from 'react';
import { ArgusTable } from '@argus-table/react';
import { byRegion, byRegionAndStatus, saleColumns, sales, type Sale } from '../../data';

const idOf = (sale: Sale) => sale.id;

export default function Sales() {
  const [byStatus, setByStatus] = useState(false);
  return (
    <>
      <p>
        <label>
          <input
            type="checkbox"
            checked={byStatus}
            onChange={(event) => {
              setByStatus(event.target.checked);
            }}
          />{' '}
          Group by status within each region
        </label>
      </p>
      {/* One group row per region, with its count and the sum of its amounts. */}
      <ArgusTable
        aria-label="Sales"
        style={{ blockSize: 380 }}
        columns={saleColumns}
        data={sales}
        getRowId={idOf}
        grouping={byStatus ? byRegionAndStatus : byRegion}
      />
    </>
  );
}
