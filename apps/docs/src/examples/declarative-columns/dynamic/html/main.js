import 'argus-table';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#declarative-columns-dynamic-table')
);
const showCity = /** @type {HTMLInputElement} */ (
  document.querySelector('#declarative-columns-dynamic-city')
);
table.data = orders;

// The table follows its children: add or remove an <argus-column>.
const city = document.createElement('argus-column');
city.columnId = 'city';
city.header = 'City';
city.accessor = 'city';
city.width = 120;
showCity.addEventListener('change', () => {
  const customer = table.querySelector('argus-column[column-id="customer"]');
  if (showCity.checked) customer?.after(city);
  else city.remove();
});
