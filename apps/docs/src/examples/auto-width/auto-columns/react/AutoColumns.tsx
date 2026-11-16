import { ArgusTable, type ColumnDef } from '@argus-table/react';
import { products, type Product } from '../../data';

const columns: ColumnDef<Product>[] = [
  { id: 'sku', header: 'SKU', accessor: 'sku', width: 'auto', pin: 'start' },
  { id: 'name', header: 'Product', accessor: 'name', width: 'auto', maxWidth: 360 },
  { id: 'category', header: 'Category', accessor: 'category', width: 'auto' },
  { id: 'price', header: 'Price (EUR)', accessor: 'price', width: 80, align: 'end' },
];

export default function AutoColumns() {
  return (
    <ArgusTable aria-label="Products" style={{ blockSize: 320 }} columns={columns} data={products} />
  );
}
