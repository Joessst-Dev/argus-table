import { useRef, useState } from 'react';
import { ArgusTable, type ArgusTableElement, type ColumnDef } from '@argus-table/react';
import { products, type Product } from '../../data';

const columns: ColumnDef<Product>[] = [
  { id: 'sku', header: 'SKU', accessor: 'sku', width: 80, pin: 'start' },
  { id: 'name', header: 'Product', accessor: 'name', width: 80 },
  { id: 'category', header: 'Category', accessor: 'category', width: 80 },
  { id: 'price', header: 'Price (EUR)', accessor: 'price', width: 80, align: 'end' },
];

export default function FitToContent() {
  const table = useRef<ArgusTableElement<Product>>(null);
  const [resizes, setResizes] = useState(0);
  return (
    <>
      <p>
        <button
          type="button"
          onClick={() => {
            void table.current?.autosizeColumns();
          }}
        >
          Fit all columns
        </button>{' '}
        Resizes: <output>{resizes}</output>
      </p>
      <ArgusTable
        ref={table}
        aria-label="Products"
        style={{ blockSize: 320 }}
        columns={columns}
        data={products}
        // A fit is a resize: it fires once for each column it changes.
        onColumnSizingChange={() => {
          setResizes((n) => n + 1);
        }}
      />
    </>
  );
}
