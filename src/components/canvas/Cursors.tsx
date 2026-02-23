"use client";

import { useState, useEffect, useRef } from "react";
import { Group, Text, Line, Rect } from "react-konva";
import { CursorData } from "@/lib/types";
import { CURSOR_CHAT_DURATION_MS } from "@/lib/constants";

interface CursorsProps {
  cursors: Record<string, CursorData>;
}

const FADE_START_MS = CURSOR_CHAT_DURATION_MS - 1000; // start fading 1s before expiry

export default function Cursors({ cursors }: CursorsProps) {
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if any cursor has an active message — if so, tick every 500ms for fade
  const hasMessages = Object.values(cursors).some(
    (c) => c.message && c.messageTimestamp
  );

  useEffect(() => {
    if (hasMessages) {
      intervalRef.current = setInterval(() => setTick((t) => t + 1), 500);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hasMessages]);

  const now = Date.now();

  return (
    <>
      {Object.entries(cursors).map(([uid, cursor]) => {
        // Compute message opacity
        let messageText: string | null = null;
        let messageOpacity = 0;
        if (cursor.message && cursor.messageTimestamp) {
          const elapsed = now - cursor.messageTimestamp;
          if (elapsed < CURSOR_CHAT_DURATION_MS) {
            messageText = cursor.message;
            const remaining = CURSOR_CHAT_DURATION_MS - elapsed;
            messageOpacity = remaining > 1000 ? 1 : remaining / 1000;
          }
        }

        const bubbleWidth = messageText
          ? Math.min(messageText.length * 7 + 20, 220)
          : 0;

        return (
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
            {/* Message bubble */}
            {messageText && (
              <Group opacity={messageOpacity}>
                <Rect
                  x={14}
                  y={-30}
                  width={bubbleWidth}
                  height={24}
                  fill={cursor.color}
                  cornerRadius={8}
                  shadowColor="rgba(0,0,0,0.15)"
                  shadowBlur={6}
                  shadowOffsetY={2}
                />
                <Text
                  x={24}
                  y={-24}
                  text={messageText}
                  fontSize={12}
                  fill="#ffffff"
                  width={bubbleWidth - 20}
                  ellipsis
                  wrap="none"
                />
              </Group>
            )}
          </Group>
        );
      })}
    </>
  );
}
