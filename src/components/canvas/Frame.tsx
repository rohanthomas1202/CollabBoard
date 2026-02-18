"use client";

import { Group, Rect, Text } from "react-konva";
import { BoardObject } from "@/lib/types";
import { KonvaEventObject } from "konva/lib/Node";

interface FrameProps {
  obj: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onDblClick: () => void;
  draggable: boolean;
}

export default function Frame({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
  onDblClick,
  draggable,
}: FrameProps) {
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
    >
      {/* Frame title */}
      <Text
        text={obj.text || "Frame"}
        y={-24}
        fontSize={14}
        fill="#9ca3af"
        fontStyle="bold"
      />
      {/* Frame border */}
      <Rect
        width={obj.width}
        height={obj.height}
        stroke={isSelected ? "#3b82f6" : "#4b5563"}
        strokeWidth={isSelected ? 2 : 1}
        dash={[8, 4]}
        cornerRadius={8}
        fill="rgba(255,255,255,0.02)"
      />
    </Group>
  );
}
