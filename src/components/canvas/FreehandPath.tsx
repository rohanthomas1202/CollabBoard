"use client";

import { Group, Line } from "react-konva";
import { BoardObject } from "@/lib/types";
import { KonvaEventObject } from "konva/lib/Node";

interface FreehandPathProps {
  obj: BoardObject;
  isSelected: boolean;
  onSelect: (shiftKey?: boolean) => void;
  onDragEnd: (x: number, y: number) => void;
  onDragMove?: (x: number, y: number) => void;
  draggable: boolean;
}

export default function FreehandPath({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
  onDragMove,
  draggable,
}: FreehandPathProps) {
  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    onDragEnd(e.target.x(), e.target.y());
  };

  const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
    onDragMove?.(e.target.x(), e.target.y());
  };

  return (
    <Group
      name={obj.id}
      x={obj.x}
      y={obj.y}
      draggable={draggable}
      onClick={(e) => onSelect((e.evt as MouseEvent).shiftKey)}
      onTap={() => onSelect(false)}
      onDragEnd={handleDragEnd}
      onDragMove={handleDragMove}
    >
      <Line
        points={obj.points || []}
        stroke={isSelected ? "#3b82f6" : obj.color}
        strokeWidth={obj.strokeWidth || 2}
        tension={0.4}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={20}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}

// Ramer-Douglas-Peucker point simplification
// Takes flat array [x1,y1,x2,y2,...] and returns simplified flat array
export function simplifyPoints(points: number[], epsilon: number): number[] {
  if (points.length <= 4) return points; // 2 or fewer points

  const len = points.length / 2;
  if (len <= 2) return points;

  // Find point with max perpendicular distance
  let maxDist = 0;
  let maxIdx = 0;
  const sx = points[0], sy = points[1];
  const ex = points[(len - 1) * 2], ey = points[(len - 1) * 2 + 1];

  for (let i = 1; i < len - 1; i++) {
    const px = points[i * 2], py = points[i * 2 + 1];
    const d = perpendicularDistance(px, py, sx, sy, ex, ey);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPoints(points.slice(0, (maxIdx + 1) * 2), epsilon);
    const right = simplifyPoints(points.slice(maxIdx * 2), epsilon);
    // Remove duplicate point at the join
    return [...left.slice(0, -2), ...right];
  } else {
    return [sx, sy, ex, ey];
  }
}

function perpendicularDistance(
  px: number, py: number,
  lx1: number, ly1: number,
  lx2: number, ly2: number
): number {
  const dx = lx2 - lx1;
  const dy = ly2 - ly1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.sqrt((px - lx1) ** 2 + (py - ly1) ** 2);
  }
  const num = Math.abs(dy * px - dx * py + lx2 * ly1 - ly2 * lx1);
  return num / Math.sqrt(lenSq);
}
