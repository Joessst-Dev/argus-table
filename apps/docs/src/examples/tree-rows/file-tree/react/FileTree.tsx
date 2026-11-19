import { useState } from 'react';
import { ArgusTable, type TreeExpandedState } from '@argus-table/react';
import { entriesOf, fileColumns, files, folderIds } from '../../data';

export default function FileTree() {
  const [treeExpanded, setTreeExpanded] = useState<TreeExpandedState>(['0']);
  return (
    <>
      {/* The table has no "expand all" of its own: set treeExpanded. */}
      <p>
        <button
          type="button"
          onClick={() => {
            setTreeExpanded(folderIds);
          }}
        >
          Expand all
        </button>{' '}
        <button
          type="button"
          onClick={() => {
            setTreeExpanded([]);
          }}
        >
          Collapse all
        </button>
      </p>
      {/* A folder's entries are its child rows, indented under it in the Name column. */}
      <ArgusTable
        aria-label="Files"
        style={{ blockSize: 380 }}
        columns={fileColumns}
        data={files}
        getSubRows={entriesOf}
        treeExpanded={treeExpanded}
        onTreeExpandedChange={(event) => {
          setTreeExpanded(event.detail.treeExpanded);
        }}
      />
    </>
  );
}
