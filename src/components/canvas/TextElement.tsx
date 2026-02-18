"use client";

import { Text, Group, Rect } from "react-konva";
import { BoardObject } from "@/lib/types";
import { KonvaEventObject } from "konva/lib/Node";

interface TextElementProps {
  obj: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onDragMove?: (x: number, y: number) => void;
  onDblClick: () => void;
  draggable: boolean;
}

export default function TextElement({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
  onDragMove,
  onDblClick,
  draggable,
}: TextElementProps) {
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
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onDblClick}
      onDblTap={onDblClick}
      onDragEnd={handleDragEnd}
      onDragMove={handleDragMove}
    >
      {isSelected && (
        <Rect
          width={obj.width}
          height={obj.height}
          stroke="#3b82f6"
          strokeWidth={1}
          dash={[4, 4]}
        />
      )}
      <Text
        text={obj.text || "Text"}
        width={obj.width}
        fontSize={obj.fontSize || 20}
        fill={obj.color}
        wrap="word"
      />
    </Group>
  );
}
