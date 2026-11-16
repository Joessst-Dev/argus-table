import { useState } from 'react';
import { ArgusColumn, ArgusTable } from '@argus-table/react';
import { orders } from '../../data';

export default function Dynamic() {
  const [showCity, setShowCity] = useState(false);
  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={showCity}
          onChange={(e) => {
            setShowCity(e.target.checked);
          }}
        />{' '}
        Show City
      </label>
      {/* The table follows its children. */}
      <ArgusTable aria-label="Orders" style={{ blockSize: 280 }} data={orders}>
        <ArgusColumn columnId="id" header="Order" accessor="id" width={90} />
        <ArgusColumn columnId="customer" header="Customer" accessor="customer" width={{ flex: 1 }} />
        {showCity && <ArgusColumn columnId="city" header="City" accessor="city" width={120} />}
        <ArgusColumn columnId="total" header="Total" accessor="total" width={100} align="end" />
      </ArgusTable>
    </>
  );
}
