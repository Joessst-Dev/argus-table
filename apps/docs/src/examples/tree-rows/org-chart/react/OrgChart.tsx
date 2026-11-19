import { useState } from 'react';
import { ArgusTable, type SelectionState, type TreeExpandedState } from '@argus-table/react';
import { describeSelection, managerOf, people, personColumns, personId } from '../../data';

export default function OrgChart() {
  const [treeExpanded, setTreeExpanded] = useState<TreeExpandedState>(['p1']);
  const [selection, setSelection] = useState<SelectionState>([]);
  const [search, setSearch] = useState('');
  return (
    <>
      <p>
        <label>
          Search people{' '}
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
        </label>
      </p>
      {/* Flat data: every person is in data, and names their manager by id. */}
      {/* selectBranches: ticking a manager ticks everyone under them. */}
      <ArgusTable
        aria-label="People"
        style={{ blockSize: 380 }}
        selectionMode="multi"
        selectionCheckboxes
        selectBranches
        columns={personColumns}
        data={people}
        getRowId={personId}
        getParentId={managerOf}
        treeExpanded={treeExpanded}
        onTreeExpandedChange={(e) => {
          setTreeExpanded(e.detail.treeExpanded);
        }}
        selection={selection}
        onSelectionChange={(e) => {
          setSelection(e.detail.selection);
        }}
        quickFilter={search}
      />
      <p>
        <output>{describeSelection(selection)}</output>
      </p>
    </>
  );
}
