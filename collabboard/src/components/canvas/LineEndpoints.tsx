"use client";

import { useRef } from "react";
import { Circle } from "react-konva";
import { BoardObject } from "@/lib/types";
import { KonvaEventObject } from "konva/lib/Node";

interface LineEndpointsProps {
  obj: BoardObject;
  onUpdate: (updates: Partial<BoardObject>) => void;
}

export default function LineEndpoints({ obj, onUpdate }: LineEndpointsProps) {
  const lastUpdate = useRef<number>(0);

  const throttledUpdate = (updates: Partial<BoardObject>) => {
    const now = Date.now();
    if (now - lastUpdate.current < 60) return;
    lastUpdate.current = now;
    onUpdate(updates);
  };

  // Start point is at (obj.x, obj.y)
  // End point is at (obj.x + obj.width, obj.y + obj.height)
  const endX = obj.x + obj.width;
  const endY = obj.y + obj.height;

  const handleStartDrag = (e: KonvaEventObject<DragEvent>) => {
    const newX = e.target.x();
    const newY = e.target.y();
    // Keep end point fixed, adjust width/height
    throttledUpdate({
      x: newX,
      y: newY,
      width: endX - newX,
      height: endY - newY,
    });
  };

  const handleStartDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const newX = e.target.x();
    const newY = e.target.y();
    onUpdate({
      x: newX,
      y: newY,
      width: endX - newX,
      height: endY - newY,
    });
  };

  const handleEndDrag = (e: KonvaEventObject<DragEvent>) => {
    const newEndX = e.target.x();
    const newEndY = e.target.y();
    throttledUpdate({
      width: newEndX - obj.x,
      height: newEndY - obj.y,
    });
  };

  const handleEndDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const newEndX = e.target.x();
    const newEndY = e.target.y();
    onUpdate({
      width: newEndX - obj.x,
      height: newEndY - obj.y,
    });
  };

  return (
    <>
      {/* Start point handle */}
      <Circle
        x={obj.x}
        y={obj.y}
        radius={6}
        fill="#ffffff"
        stroke="#3b82f6"
        strokeWidth={2}
        draggable
        onDragMove={handleStartDrag}
        onDragEnd={handleStartDragEnd}
      />
      {/* End point handle */}
      <Circle
        x={endX}
        y={endY}
        radius={6}
        fill="#ffffff"
        stroke="#3b82f6"
        strokeWidth={2}
        draggable
        onDragMove={handleEndDrag}
        onDragEnd={handleEndDragEnd}
      />
    </>
  );
}
