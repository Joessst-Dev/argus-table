import type { ColDef, ValueFormatterParams } from 'ag-grid-community';

export interface Order {
  id: string;
  customer: string;
  country: string;
  total: number;
  status: string;
}

const currency = (p: ValueFormatterParams<Order, number>) => `€${(p.value ?? 0).toFixed(2)}`;

export const columnDefs: ColDef<Order>[] = [
  { field: 'id', headerName: 'Order', pinned: 'left', checkboxSelection: true, width: 110 },
  { field: 'customer', headerName: 'Customer', flex: 1, filter: 'agTextColumnFilter', editable: true },
  { field: 'country', headerName: 'Country', rowGroup: true, hide: true, filter: 'agSetColumnFilter' },
  { field: 'total', headerName: 'Total', type: 'numericColumn', valueFormatter: currency, aggFunc: 'sum' },
  { field: 'status', headerName: 'Status', cellRenderer: 'statusRenderer' },
];

export const defaultColDef: ColDef = { sortable: true, resizable: true };
