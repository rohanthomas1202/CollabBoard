"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Stage, Layer } from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";
import Konva from "konva";
import { BoardObject, Tool, COLORS, DEFAULT_DIMENSIONS } from "@/lib/types";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from "@/lib/constants";
import { CursorData } from "@/lib/types";
import StickyNote from "./StickyNote";
import Shape from "./Shape";
import TextElement from "./TextElement";
import Frame from "./Frame";
import Connector from "./Connector";
import Cursors from "./Cursors";

interface BoardCanvasProps {
  objects: BoardObject[];
  cursors: Record<string, CursorData>;
  activeTool: Tool;
  userId: string;
  onAddObject: (obj: Omit<BoardObject, "id" | "updatedAt">) => Promise<string>;
  onUpdateObject: (id: string, updates: Partial<BoardObject>) => void;
  onDeleteObject: (id: string) => void;
  onCursorMove: (x: number, y: number) => void;
  onToolChange: (tool: Tool) => void;
}

export default function BoardCanvas({
  objects,
  cursors,
  activeTool,
  userId,
  onAddObject,
  onUpdateObject,
  onDeleteObject,
  onCursorMove,
  onToolChange,
}: BoardCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  // Resize stage to window
  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingId) return; // Don't handle shortcuts while editing text

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          onDeleteObject(selectedId);
          setSelectedId(null);
        }
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        onToolChange("select");
      }
      if (e.key === "v" || e.key === "V") onToolChange("select");
      if (e.key === "h" || e.key === "H") onToolChange("pan");
      if (e.key === "n" || e.key === "N") onToolChange("sticky-note");
      if (e.key === "r" || e.key === "R") onToolChange("rectangle");
      if (e.key === "o" || e.key === "O") onToolChange("circle");
      if (e.key === "l" || e.key === "L") onToolChange("line");
      if (e.key === "t" || e.key === "T") onToolChange("text");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, editingId, onDeleteObject, onToolChange]);

  // Get pointer position in world coordinates
  const getWorldPointer = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pointer = stage.getPointerPosition();
    if (!pointer) return { x: 0, y: 0 };
    return {
      x: (pointer.x - stagePos.x) / scale,
      y: (pointer.y - stagePos.y) / scale,
    };
  }, [stagePos, scale]);

  // Zoom with scroll wheel
  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const newScale =
        e.evt.deltaY < 0
          ? Math.min(oldScale * ZOOM_STEP, MAX_ZOOM)
          : Math.max(oldScale / ZOOM_STEP, MIN_ZOOM);

      const mousePointTo = {
        x: (pointer.x - stagePos.x) / oldScale,
        y: (pointer.y - stagePos.y) / oldScale,
      };

      setScale(newScale);
      setStagePos({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    },
    [scale, stagePos]
  );

  // Track mouse for cursor sharing
  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const worldPos = getWorldPointer();
      onCursorMove(worldPos.x, worldPos.y);
    },
    [getWorldPointer, onCursorMove]
  );

  // Click on stage to create objects or deselect
  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      // Only handle clicks directly on the stage (not on objects)
      if (e.target !== stageRef.current) return;

      const worldPos = getWorldPointer();

      if (activeTool === "select" || activeTool === "pan") {
        setSelectedId(null);
        return;
      }

      // Create new object at click position
      const dims = DEFAULT_DIMENSIONS[activeTool] || { width: 200, height: 150 };
      const maxZ = objects.length > 0 ? Math.max(...objects.map((o) => o.zIndex)) + 1 : 1;

      const newObj: Omit<BoardObject, "id" | "updatedAt"> = {
        type: activeTool as BoardObject["type"],
        x: worldPos.x - dims.width / 2,
        y: worldPos.y - dims.height / 2,
        width: dims.width,
        height: dims.height,
        color:
          activeTool === "sticky-note"
            ? COLORS.stickyNote[Math.floor(Math.random() * COLORS.stickyNote.length)]
            : activeTool === "text"
            ? "#ffffff"
            : COLORS.shape[Math.floor(Math.random() * COLORS.shape.length)],
        rotation: 0,
        zIndex: maxZ,
        text: activeTool === "sticky-note" ? "New note" : activeTool === "text" ? "Text" : undefined,
        fontSize: activeTool === "text" ? 20 : 16,
        createdBy: userId,
      };

      onAddObject(newObj);
      onToolChange("select");
    },
    [activeTool, getWorldPointer, objects, userId, onAddObject, onToolChange]
  );

  // Handle drag for panning
  const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    if (e.target === stageRef.current) {
      setStagePos({ x: e.target.x(), y: e.target.y() });
    }
  }, []);

  // Double-click to edit text
  const handleEditText = useCallback(
    (obj: BoardObject) => {
      setEditingId(obj.id);
      const newText = prompt("Edit text:", obj.text || "");
      if (newText !== null) {
        onUpdateObject(obj.id, { text: newText });
      }
      setEditingId(null);
    },
    [onUpdateObject]
  );

  const renderObject = (obj: BoardObject) => {
    const isSelected = selectedId === obj.id;
    const isDraggable = activeTool === "select";

    const commonProps = {
      isSelected,
      onSelect: () => setSelectedId(obj.id),
      onDragEnd: (x: number, y: number) => onUpdateObject(obj.id, { x, y }),
      draggable: isDraggable,
    };

    switch (obj.type) {
      case "sticky-note":
        return (
          <StickyNote
            key={obj.id}
            obj={obj}
            {...commonProps}
            onDblClick={() => handleEditText(obj)}
          />
        );
      case "rectangle":
      case "circle":
      case "line":
        return <Shape key={obj.id} obj={obj} {...commonProps} />;
      case "text":
        return (
          <TextElement
            key={obj.id}
            obj={obj}
            {...commonProps}
            onDblClick={() => handleEditText(obj)}
          />
        );
      case "frame":
        return (
          <Frame
            key={obj.id}
            obj={obj}
            {...commonProps}
            onDblClick={() => handleEditText(obj)}
          />
        );
      case "connector":
        return (
          <Connector
            key={obj.id}
            obj={obj}
            allObjects={objects}
            isSelected={isSelected}
            onSelect={() => setSelectedId(obj.id)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Stage
      ref={stageRef}
      width={stageSize.width}
      height={stageSize.height}
      scaleX={scale}
      scaleY={scale}
      x={stagePos.x}
      y={stagePos.y}
      draggable={activeTool === "pan"}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onClick={handleStageClick}
      onTap={handleStageClick}
      onDragEnd={handleDragEnd}
      style={{ backgroundColor: "#1a1a2e", cursor: activeTool === "pan" ? "grab" : "crosshair" }}
    >
      <Layer>
        {/* Grid (optional visual) */}
        {objects.map(renderObject)}
      </Layer>
      <Layer listening={false}>
        <Cursors cursors={cursors} />
      </Layer>
    </Stage>
  );
}
