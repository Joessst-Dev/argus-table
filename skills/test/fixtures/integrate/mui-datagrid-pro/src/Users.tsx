import { useState } from 'react';
import { DataGridPro, type GridColDef, type GridPaginationModel, type GridSortModel } from '@mui/x-data-grid-pro';
import { useUsers } from './api';

const columns: GridColDef[] = [
  { field: 'name', headerName: 'Name', flex: 1 },
  { field: 'age', headerName: 'Age', type: 'number', width: 90 },
  { field: 'role', headerName: 'Role', type: 'singleSelect', valueOptions: ['admin', 'editor', 'viewer'] },
  {
    field: 'active',
    headerName: 'Active',
    renderCell: (params) => (params.value ? 'Yes' : 'No'),
  },
];

export function Users() {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const { rows, total, loading } = useUsers(paginationModel, sortModel);
  return (
    <DataGridPro
      rows={rows}
      columns={columns}
      rowCount={total}
      loading={loading}
      paginationMode="server"
      sortingMode="server"
      paginationModel={paginationModel}
      onPaginationModelChange={setPaginationModel}
      sortModel={sortModel}
      onSortModelChange={setSortModel}
      checkboxSelection
      pinnedColumns={{ left: ['name'] }}
      getDetailPanelContent={({ row }) => <div>{row.name}</div>}
      density="compact"
    />
  );
}
