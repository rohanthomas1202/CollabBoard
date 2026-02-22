"use client";

import { Group, Text, Line, Rect } from "react-konva";
import { CursorData } from "@/lib/types";

interface CursorsProps {
  cursors: Record<string, CursorData>;
}

export default function Cursors({ cursors }: CursorsProps) {
  return (
    <>
      {Object.entries(cursors).map(([uid, cursor]) => (
        <Group key={uid} x={cursor.x} y={cursor.y} listening={false}>
          {/* Cursor pointer shape */}
          <Line
            points={[0, 0, 0, 18, 5, 14, 10, 22, 13, 20, 8, 12, 14, 12]}
            fill={cursor.color}
            stroke="#fff"
            strokeWidth={1}
            closed
          />
          {/* Name label background */}
          <Rect
            x={14}
            y={18}
            width={cursor.name.length * 7 + 12}
            height={20}
            fill={cursor.color}
            cornerRadius={4}
          />
          {/* Name label text */}
          <Text
            x={20}
            y={21}
            text={cursor.name}
            fontSize={12}
            fill="#ffffff"
          />
        </Group>
      ))}
    </>
  );
}
