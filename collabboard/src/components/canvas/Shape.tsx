"use client";

import { Rect, Circle, Line, Group, Text } from "react-konva";
import { BoardObject } from "@/lib/types";
import { KonvaEventObject } from "konva/lib/Node";

interface ShapeProps {
  obj: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onDragMove?: (x: number, y: number) => void;
  onDblClick?: () => void;
  onTransformEnd?: (e: KonvaEventObject<Event>) => void;
  draggable: boolean;
}

export default function Shape({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
  onDragMove,
  onDblClick,
  onTransformEnd,
  draggable,
}: ShapeProps) {
  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    onDragEnd(e.target.x(), e.target.y());
  };

  const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
    onDragMove?.(e.target.x(), e.target.y());
  };

  const strokeColor = isSelected ? "#3b82f6" : "#374151";
  const strokeWidth = isSelected ? 2 : 1;

  const renderShape = () => {
    switch (obj.type) {
      case "rectangle":
        return (
          <Rect
            width={obj.width}
            height={obj.height}
            fill={obj.color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            cornerRadius={4}
          />
        );
      case "circle":
        return (
          <Circle
            x={obj.width / 2}
            y={obj.height / 2}
            radius={Math.min(obj.width, obj.height) / 2}
            fill={obj.color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );
      case "line":
        return (
          <Line
            points={[0, 0, obj.width, obj.height]}
            stroke={obj.color}
            strokeWidth={isSelected ? 3 : 2}
            hitStrokeWidth={20}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Group
      name={obj.id}
      x={obj.x}
      y={obj.y}
      draggable={draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onDblClick}
      onDblTap={onDblClick}
      onDragEnd={handleDragEnd}
      onDragMove={handleDragMove}
      onTransformEnd={onTransformEnd}
      rotation={obj.rotation}
    >
      {renderShape()}
      {obj.text && obj.type !== "line" && (
        <Text
          text={obj.text}
          width={obj.width}
          height={obj.height}
          align="center"
          verticalAlign="middle"
          fontSize={obj.fontSize || 16}
          fill="#1a1a1a"
          wrap="word"
        />
      )}
    </Group>
  );
}
