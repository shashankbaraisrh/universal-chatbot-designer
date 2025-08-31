import React from 'react';
import { BaseEdge, getStraightPath } from 'reactflow';

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data
}) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      {data?.label && (
        <text
          x={labelX}
          y={labelY}
          fill="black"
          fontSize={12}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ pointerEvents: 'none' }}
        >
          {data.label}
        </text>
      )}
    </>
  );
}
