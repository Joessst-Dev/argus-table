// Shared by the row grouping example's four flavours: a quarter's sales, grouped
// by region and status, with the amounts totalled per group.

export interface Sale {
  id: string;
  customer: string;
  region: string;
  status: string;
  amount: number;
}

export const sales: Sale[] = [
  { id: 's1', customer: 'Aurora Labs', region: 'Europe', status: 'Won', amount: 18_400 },
  { id: 's2', customer: 'Bluebird Inc.', region: 'Americas', status: 'Open', amount: 7_250 },
  { id: 's3', customer: 'Cedar & Co', region: 'Europe', status: 'Open', amount: 4_900 },
  { id: 's4', customer: 'Delta Freight', region: 'Asia Pacific', status: 'Won', amount: 22_100 },
  { id: 's5', customer: 'Ember Studio', region: 'Americas', status: 'Lost', amount: 3_600 },
  { id: 's6', customer: 'Fjord Systems', region: 'Europe', status: 'Won', amount: 9_800 },
  { id: 's7', customer: 'Granite Bank', region: 'Americas', status: 'Won', amount: 31_000 },
  { id: 's8', customer: 'Harbor Health', region: 'Asia Pacific', status: 'Open', amount: 12_300 },
  { id: 's9', customer: 'Iris Media', region: 'Europe', status: 'Lost', amount: 2_150 },
  { id: 's10', customer: 'Juniper Foods', region: 'Asia Pacific', status: 'Won', amount: 6_700 },
  { id: 's11', customer: 'Kestrel Air', region: 'Americas', status: 'Open', amount: 14_250 },
  { id: 's12', customer: 'Lumen Energy', region: 'Europe', status: 'Open', amount: 8_050 },
];

const euros = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' });

/** `€18,400.00` for 18400. */
export const money = (amount: unknown) => (typeof amount === 'number' ? euros.format(amount) : '');

export const saleColumns = [
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'region', header: 'Region', accessor: 'region', width: 140, groupable: true },
  { id: 'status', header: 'Status', accessor: 'status', width: 110, groupable: true },
  {
    id: 'amount',
    header: 'Amount',
    accessor: 'amount',
    width: 140,
    align: 'end' as const,
    sortable: true,
    // Group rows show the sum of their rows' amounts, formatted like the cells.
    aggregate: 'sum' as const,
    cell: (sale: Sale) => money(sale.amount),
    groupCell: ({ total }: { total: unknown }) => money(total),
  },
];

/** By region alone, or by region and then status within each region. */
export const byRegion: readonly string[] = ['region'];
export const byRegionAndStatus: readonly string[] = ['region', 'status'];
