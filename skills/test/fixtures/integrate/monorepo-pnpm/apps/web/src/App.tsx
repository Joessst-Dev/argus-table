import { ArgusTable } from '@argus-table/react';
import '@argus-table/themes/default.css';

const columns = [{ id: 'name', header: 'Name', accessor: 'name', sortable: true }];

export function App({ rows }: { rows: { id: string; name: string }[] }) {
  return <ArgusTable aria-label="People" columns={columns} data={rows} />;
}
