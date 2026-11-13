import 'argus-table';

const table = document.querySelector('#orders');
table.setAttribute('columns', JSON.stringify([{ id: 'id' }]));
table.columns = [
  { id: 'id', header: 'Order', accessor: 'id' },
  { id: 'total', headerName: 'Total', accessor: 'total' },
];
table.data = [];
table.selectionMode = 'multi';
table.sorting = [{ id: 'id', desc: false }];
table.addEventListener('argus-sort-change', (e) => console.log(e.detail));
