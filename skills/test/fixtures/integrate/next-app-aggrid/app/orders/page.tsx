import { OrdersGrid } from './orders-grid';

export default async function OrdersPage() {
  const res = await fetch('https://api.example.com/orders/summary');
  const summary = await res.json();
  return (
    <main>
      <h1>Orders ({summary.count})</h1>
      <OrdersGrid />
    </main>
  );
}
