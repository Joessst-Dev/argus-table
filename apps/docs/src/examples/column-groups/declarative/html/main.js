import 'argus-table';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#column-groups-declarative-table')
);
const who = /** @type {import('argus-table').ArgusColumnGroup} */ (
  table.querySelector('argus-column-group[group-id="who"]')
);

// Header content other than text: a function on the group's `header`. In text
// mode (announcements, plugins), it gives the group's name.
who.header = (/** @type {import('argus-table').GroupHeaderContext} */ { text }) => {
  if (text) return 'Who';
  const label = document.createElement('strong');
  label.textContent = 'Who';
  return label;
};
table.data = orders.slice(0, 50);
