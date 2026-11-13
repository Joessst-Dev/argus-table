import { DataTable } from '@/components/ui/data-table';
import { columns, type Payment } from './columns';

export function PaymentsPage({ payments }: { payments: Payment[] }) {
  return <DataTable columns={columns} data={payments} />;
}
