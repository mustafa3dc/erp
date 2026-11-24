import React from 'react';

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 6
}) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr key={`skel-row-${rowIdx}`}>
          {Array.from({ length: columns }).map((__, colIdx) => (
            <td key={`skel-cell-${rowIdx}-${colIdx}`}>
              <div
                className="skeleton-bar"
                style={{
                  height: '14px',
                  width: colIdx === 0 ? '70%' : colIdx === columns - 1 ? '48px' : `${55 + ((rowIdx + colIdx) % 3) * 15}%`
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export default TableSkeleton;
