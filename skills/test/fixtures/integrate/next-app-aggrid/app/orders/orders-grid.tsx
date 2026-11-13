'use client';

import { useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllEnterpriseModule, ModuleRegistry, type IServerSideDatasource } from 'ag-grid-enterprise';
import { columnDefs, defaultColDef, type Order } from './columns';

ModuleRegistry.registerModules([AllEnterpriseModule]);

export function OrdersGrid() {
  const datasource = useMemo<IServerSideDatasource>(
    () => ({
      getRows: async (params) => {
        const res = await fetch('/api/orders', { method: 'POST', body: JSON.stringify(params.request) });
        const { rows, lastRow } = await res.json();
        params.success({ rowData: rows, rowCount: lastRow });
      },
    }),
    [],
  );
  const getRowId = useCallback((p: { data: Order }) => p.data.id, []);
  return (
    <div className="ag-theme-quartz" style={{ height: 600 }}>
      <AgGridReact<Order>
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowModelType="serverSide"
        serverSideDatasource={datasource}
        rowSelection={{ mode: 'multiRow' }}
        getRowId={getRowId}
        pagination={true}
        paginationPageSize={50}
        sideBar="columns"
        onRowClicked={(e) => console.log(e.data)}
      />
    </div>
  );
}
