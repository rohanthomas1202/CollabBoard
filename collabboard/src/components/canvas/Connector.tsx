"use client";

import { Arrow } from "react-konva";
import { BoardObject } from "@/lib/types";

interface ConnectorProps {
  obj: BoardObject;
  allObjects: BoardObject[];
  isSelected: boolean;
  onSelect: () => void;
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

  const fromX = fromObj.x + (fromObj.width || 0) / 2;
  const fromY = fromObj.y + (fromObj.height || 0) / 2;
  const toX = toObj.x + (toObj.width || 0) / 2;
  const toY = toObj.y + (toObj.height || 0) / 2;

  return (
    <Arrow
      points={[fromX, fromY, toX, toY]}
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
