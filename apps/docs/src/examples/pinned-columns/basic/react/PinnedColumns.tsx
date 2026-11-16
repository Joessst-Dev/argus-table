import { useState } from 'react';
import { ArgusTable, type ReactColumnDef } from '@argus-table/react';
import { items, months, shadows, type Item } from '../../data';

const columns: ReactColumnDef<Item>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', pin: 'start' },
  { id: 'name', header: 'Name', accessor: 'name', width: 140, pin: 'start' },
  ...months,
  {
    id: 'actions',
    header: 'Actions',
    width: 90,
    pin: 'end',
    cell: () => <button type="button">Open</button>,
  },
];

export default function PinnedColumns() {
  const [rtl, setRtl] = useState(false);
  const [shadow, setShadow] = useState<keyof typeof shadows>('Theme');
  const style = { blockSize: 320, '--argus-pinned-shadow': shadows[shadow] || undefined };
  return (
    <>
      <p>
        <label>
          <input
            type="checkbox"
            checked={rtl}
            onChange={(e) => {
              setRtl(e.target.checked);
            }}
          />{' '}
          Right to left
        </label>{' '}
        <label>
          Edge shadow{' '}
          <select
            value={shadow}
            onChange={(e) => {
              setShadow(e.target.value as keyof typeof shadows);
            }}
          >
            {Object.keys(shadows).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </p>
      {/* 'start' follows the writing direction: the right side in RTL. */}
      <ArgusTable
        aria-label="Items"
        dir={rtl ? 'rtl' : 'ltr'}
        style={style}
        columns={columns}
        data={items}
      />
    </>
  );
}
