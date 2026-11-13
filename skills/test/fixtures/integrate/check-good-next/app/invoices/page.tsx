import { InvoicesTable, type Invoice } from './invoices-table';

export default async function Page() {
  const invoices: Invoice[] = await (await fetch('https://api.example.com/invoices')).json();
  return <InvoicesTable invoices={invoices} />;
}
