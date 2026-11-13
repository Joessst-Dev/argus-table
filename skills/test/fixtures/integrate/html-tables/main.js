const orders = await (await fetch('/orders.json')).json();
const body = document.querySelector('#orders tbody');
let page = 0;

function render(rows) {
  body.innerHTML = '';
  for (const order of rows.slice(page * 50, page * 50 + 50)) {
    const tr = body.insertRow();
    tr.insertCell().textContent = order.customer;
    tr.insertCell().textContent = order.total;
  }
}

window.sortBy = (key) => render([...orders].sort((a, b) => String(a[key]).localeCompare(String(b[key]))));
document.querySelector('#search').addEventListener('input', (e) => {
  const term = e.target.value;
  render(orders.filter((o) => o.customer.includes(term)));
});
render(orders);
