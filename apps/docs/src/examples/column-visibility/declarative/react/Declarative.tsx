import { useState } from 'react';
import { ArgusColumn, ArgusTable } from '@argus-table/react';
import { tasks } from '../../data';

export default function Declarative() {
  const [ownerHidden, setOwnerHidden] = useState(true);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOwnerHidden(!ownerHidden);
        }}
      >
        {ownerHidden ? 'Show Owner' : 'Hide Owner'}
      </button>
      <ArgusTable aria-label="Tasks" style={{ blockSize: 280 }} data={tasks}>
        <ArgusColumn columnId="id" header="#" accessor="id" width={70} pin="start" hideable={false} />
        <ArgusColumn columnId="title" header="Title" accessor="title" width={{ flex: 2 }} />
        {/* The standard `hidden` attribute hides a column. */}
        <ArgusColumn columnId="owner" header="Owner" accessor="owner" hidden={ownerHidden} />
        <ArgusColumn columnId="status" header="Status" accessor="status" />
      </ArgusTable>
    </>
  );
}
