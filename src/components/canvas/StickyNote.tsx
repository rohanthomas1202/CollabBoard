"use client";

import { Group, Rect, Text } from "react-konva";
import { BoardObject } from "@/lib/types";
import { KonvaEventObject } from "konva/lib/Node";

interface StickyNoteProps {
  obj: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onDblClick: () => void;
  draggable: boolean;
}

export default function StickyNote({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
  onDblClick,
  draggable,
}: StickyNoteProps) {
  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    onDragEnd(e.target.x(), e.target.y());
  };

  return (
    <Group
      x={obj.x}
      y={obj.y}
      draggable={draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onDblClick}
      onDblTap={onDblClick}
      onDragEnd={handleDragEnd}
      rotation={obj.rotation}
    >
      {/* Shadow */}
      <Rect
        width={obj.width}
        height={obj.height}
        fill="rgba(0,0,0,0.1)"
        cornerRadius={4}
        offsetX={-3}
        offsetY={-3}
      />
      {/* Note body */}
      <Rect
        width={obj.width}
        height={obj.height}
        fill={obj.color}
        cornerRadius={4}
        stroke={isSelected ? "#3b82f6" : "transparent"}
        strokeWidth={isSelected ? 2 : 0}
      />
      {/* Text content */}
      <Text
        text={obj.text || ""}
        width={obj.width - 16}
        height={obj.height - 16}
        x={8}
        y={8}
        fontSize={obj.fontSize || 16}
        fill="#1a1a1a"
        wrap="word"
        ellipsis
      />
    </Group>
  );
}
