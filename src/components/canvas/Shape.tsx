"use client";

import { Rect, Circle, Line, Group } from "react-konva";
import { BoardObject } from "@/lib/types";
import { KonvaEventObject } from "konva/lib/Node";

interface ShapeProps {
  obj: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  draggable: boolean;
}

export default function Shape({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
  draggable,
}: ShapeProps) {
  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    onDragEnd(e.target.x(), e.target.y());
  };

  const strokeColor = isSelected ? "#3b82f6" : "#374151";
  const strokeWidth = isSelected ? 2 : 1;

  if (obj.type === "rectangle") {
    return (
      <Rect
        x={obj.x}
        y={obj.y}
        width={obj.width}
        height={obj.height}
        fill={obj.color}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        cornerRadius={4}
        draggable={draggable}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        rotation={obj.rotation}
      />
    );
  }

  if (obj.type === "circle") {
    return (
      <Circle
        x={obj.x + obj.width / 2}
        y={obj.y + obj.height / 2}
        radius={Math.min(obj.width, obj.height) / 2}
        fill={obj.color}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        draggable={draggable}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onDragEnd(
            e.target.x() - obj.width / 2,
            e.target.y() - obj.height / 2
          );
        }}
      />
    );
  }

  if (obj.type === "line") {
    return (
      <Line
        x={obj.x}
        y={obj.y}
        points={[0, 0, obj.width, obj.height]}
        stroke={obj.color}
        strokeWidth={isSelected ? 3 : 2}
        draggable={draggable}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        hitStrokeWidth={20}
      />
    );
  }

  return null;
}
