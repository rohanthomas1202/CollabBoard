"use client";

import { Arrow } from "react-konva";
import { BoardObject } from "@/lib/types";

interface ConnectorProps {
  obj: BoardObject;
  allObjects: BoardObject[];
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * Calculate the point where a line from the center of a rect to an external
 * target point intersects the rectangle's edge. This makes arrows start/end
 * at the border of shapes rather than their centers.
 */
function edgeIntersection(
  cx: number,
  cy: number,
  w: number,
  h: number,
  targetX: number,
  targetY: number,
  isCircle: boolean
): { x: number; y: number } {
  const dx = targetX - cx;
  const dy = targetY - cy;

  // If both objects are at the same position, return center
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  if (isCircle) {
    // For circles, intersect with the ellipse defined by w/2 and h/2
    const rx = w / 2;
    const ry = h / 2;
    const angle = Math.atan2(dy, dx);
    return {
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    };
  }

  // For rectangles, find edge intersection
  const halfW = w / 2;
  const halfH = h / 2;

  // Calculate scale factors for each edge
  const scaleX = halfW / Math.abs(dx || 0.001);
  const scaleY = halfH / Math.abs(dy || 0.001);

  // Use the smaller scale — that's the edge the line hits first
  const t = Math.min(scaleX, scaleY);

  return {
    x: cx + dx * t,
    y: cy + dy * t,
  };
}

export default function Connector({
  obj,
  allObjects,
  isSelected,
  onSelect,
}: ConnectorProps) {
  const fromObj = allObjects.find((o) => o.id === obj.connectedFrom);
  const toObj = allObjects.find((o) => o.id === obj.connectedTo);

  if (!fromObj || !toObj) return null;

  const fromCX = fromObj.x + (fromObj.width || 0) / 2;
  const fromCY = fromObj.y + (fromObj.height || 0) / 2;
  const toCX = toObj.x + (toObj.width || 0) / 2;
  const toCY = toObj.y + (toObj.height || 0) / 2;

  // Calculate edge intersection points so arrows start/end at shape borders
  const fromPt = edgeIntersection(
    fromCX, fromCY,
    fromObj.width || 0, fromObj.height || 0,
    toCX, toCY,
    fromObj.type === "circle"
  );
  const toPt = edgeIntersection(
    toCX, toCY,
    toObj.width || 0, toObj.height || 0,
    fromCX, fromCY,
    toObj.type === "circle"
  );

  return (
    <Arrow
      points={[fromPt.x, fromPt.y, toPt.x, toPt.y]}
      stroke={isSelected ? "#3b82f6" : obj.color || "#6b7280"}
      strokeWidth={isSelected ? 3 : 2}
      pointerLength={10}
      pointerWidth={10}
      fill={isSelected ? "#3b82f6" : obj.color || "#6b7280"}
      onClick={onSelect}
      onTap={onSelect}
      hitStrokeWidth={20}
    />
  );
}
