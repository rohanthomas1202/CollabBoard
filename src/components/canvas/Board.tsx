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
  bgColor: string;
  onAddObject: (obj: Omit<BoardObject, "id" | "updatedAt">) => Promise<string>;
  onUpdateObject: (id: string, updates: Partial<BoardObject>) => void;
  onDeleteObject: (id: string) => void;
  onCursorMove: (x: number, y: number) => void;
  onToolChange: (tool: Tool) => void;
}

interface EditState {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  type: string;
}

export default function BoardCanvas({
  objects,
  cursors,
  activeTool,
  userId,
  bgColor,
  onAddObject,
  onUpdateObject,
  onDeleteObject,
  onCursorMove,
  onToolChange,
}: BoardCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [connectorFrom, setConnectorFrom] = useState<string | null>(null);

  // Resize stage to window
  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Focus textarea when editing
  useEffect(() => {
    if (editState && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editState]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editState) return; // Don't handle shortcuts while editing text

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          onDeleteObject(selectedId);
          setSelectedId(null);
        }
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        setConnectorFrom(null);
        onToolChange("select");
      }
      if (e.key === "v" || e.key === "V") onToolChange("select");
      if (e.key === "h" || e.key === "H") onToolChange("pan");
      if (e.key === "n" || e.key === "N") onToolChange("sticky-note");
      if (e.key === "r" || e.key === "R") onToolChange("rectangle");
      if (e.key === "o" || e.key === "O") onToolChange("circle");
      if (e.key === "l" || e.key === "L") onToolChange("line");
      if (e.key === "t" || e.key === "T") onToolChange("text");
      if (e.key === "c" || e.key === "C") onToolChange("connector");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, editState, onDeleteObject, onToolChange]);

  // Clear connector source when switching away from connector tool
  useEffect(() => {
    if (activeTool !== "connector") {
      setConnectorFrom(null);
    }
  }, [activeTool]);

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

  // Traverse Konva node tree to find the board object ID from a click target
  const getObjectIdFromTarget = useCallback(
    (target: Konva.Node): string | null => {
      let node: Konva.Node | null = target;
      while (node && node !== stageRef.current) {
        const n = node.name();
        if (n) return n;
        node = node.getParent();
      }
      return null;
    },
    []
  );

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
    (_e: KonvaEventObject<MouseEvent>) => {
      const worldPos = getWorldPointer();
      onCursorMove(worldPos.x, worldPos.y);
    },
    [getWorldPointer, onCursorMove]
  );

  // Click on stage to create objects, deselect, or handle connectors
  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      const worldPos = getWorldPointer();

      // Connector tool: handle at stage level using Konva node name traversal
      if (activeTool === "connector") {
        if (e.target === stageRef.current) {
          // Clicked empty space: cancel
          setConnectorFrom(null);
          return;
        }
        // Find which object was clicked by traversing Konva node tree
        const objectId = getObjectIdFromTarget(e.target as Konva.Node);
        if (objectId) {
          // Don't connect to connectors
          const targetObj = objects.find((o) => o.id === objectId);
          if (targetObj && targetObj.type === "connector") return;

          if (!connectorFrom) {
            // First click: set source
            setConnectorFrom(objectId);
            setSelectedId(objectId);
          } else if (connectorFrom === objectId) {
            // Clicked same object: cancel
            setConnectorFrom(null);
          } else {
            // Second click: create connector between source and target
            const maxZ = objects.length > 0 ? Math.max(...objects.map((o) => o.zIndex)) + 1 : 1;
            onAddObject({
              type: "connector",
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              color: "#6b7280",
              rotation: 0,
              zIndex: maxZ,
              connectedFrom: connectorFrom,
              connectedTo: objectId,
              createdBy: userId,
            });
            setConnectorFrom(null);
            onToolChange("select");
          }
        }
        return;
      }

      // For all other tools, only handle clicks on empty canvas (not on objects)
      if (e.target !== stageRef.current) return;

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
    [activeTool, getWorldPointer, objects, userId, onAddObject, onToolChange, connectorFrom, getObjectIdFromTarget]
  );

  // Handle drag for panning
  const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    if (e.target === stageRef.current) {
      setStagePos({ x: e.target.x(), y: e.target.y() });
    }
  }, []);

  // Start inline editing for an object
  const handleEditText = useCallback(
    (obj: BoardObject) => {
      setEditState({
        id: obj.id,
        text: obj.text || "",
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
        fontSize: obj.fontSize || 16,
        color: obj.color,
        type: obj.type,
      });
    },
    []
  );

  // Save inline edit
  const commitEdit = useCallback(() => {
    if (!editState) return;
    onUpdateObject(editState.id, { text: editState.text });
    setEditState(null);
  }, [editState, onUpdateObject]);

  // Calculate screen position from world coords
  const getScreenPos = useCallback(
    (worldX: number, worldY: number) => ({
      x: worldX * scale + stagePos.x,
      y: worldY * scale + stagePos.y,
    }),
    [scale, stagePos]
  );

  const renderObject = (obj: BoardObject) => {
    const isSelected = selectedId === obj.id;
    const isConnectorSource = connectorFrom === obj.id;
    const isDraggable = activeTool === "select";
    const isEditing = editState?.id === obj.id;

    const commonProps = {
      isSelected: isSelected || isConnectorSource,
      onSelect: () => setSelectedId(obj.id),
      onDragEnd: (x: number, y: number) => onUpdateObject(obj.id, { x, y }),
      draggable: isDraggable,
    };

    switch (obj.type) {
      case "sticky-note":
        return (
          <StickyNote
            key={obj.id}
            obj={isEditing ? { ...obj, text: "" } : obj}
            {...commonProps}
            onSelect={() => {
              setSelectedId(obj.id);
              // Single-click on sticky note: start editing immediately
              if (activeTool === "select" && !editState) {
                handleEditText(obj);
              }
            }}
          />
        );
      case "rectangle":
      case "circle":
        return (
          <Shape
            key={obj.id}
            obj={isEditing ? { ...obj, text: "" } : obj}
            {...commonProps}
            onDblClick={() => handleEditText(obj)}
          />
        );
      case "line":
        return <Shape key={obj.id} obj={obj} {...commonProps} />;
      case "text":
        return (
          <TextElement
            key={obj.id}
            obj={isEditing ? { ...obj, text: "" } : obj}
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

  // Inline text editor overlay
  const renderTextEditor = () => {
    if (!editState) return null;

    const screenPos = getScreenPos(editState.x, editState.y);
    const scaledWidth = editState.width * scale;
    const scaledHeight = editState.height * scale;
    const scaledFontSize = editState.fontSize * scale;

    const isStickyNote = editState.type === "sticky-note";
    const isShape = editState.type === "rectangle" || editState.type === "circle";
    const padding = isStickyNote ? 10 * scale : isShape ? 8 * scale : 4 * scale;

    return (
      <textarea
        ref={textareaRef}
        value={editState.text}
        onChange={(e) => setEditState({ ...editState, text: e.target.value })}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setEditState(null);
          }
          // Shift+Enter for newline, Enter to commit
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commitEdit();
          }
        }}
        style={{
          position: "absolute",
          left: screenPos.x + padding,
          top: screenPos.y + padding,
          width: scaledWidth - padding * 2,
          height: scaledHeight - padding * 2,
          fontSize: scaledFontSize,
          fontFamily: "Arial, Helvetica, sans-serif",
          color: isStickyNote ? "#1a1a1a" : isShape ? "#1a1a1a" : editState.color,
          background: "transparent",
          border: "2px solid #3b82f6",
          borderRadius: "4px",
          outline: "none",
          resize: "none",
          overflow: "hidden",
          padding: "2px 4px",
          lineHeight: "1.2",
          textAlign: isShape ? "center" : "left",
          zIndex: 1000,
        }}
      />
    );
  };

  return (
    <div style={{ position: "relative" }}>
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
        style={{ backgroundColor: bgColor, cursor: activeTool === "pan" ? "grab" : "crosshair" }}
      >
        <Layer>
          {objects.map(renderObject)}
        </Layer>
        <Layer listening={false}>
          <Cursors cursors={cursors} />
        </Layer>
      </Stage>
      {renderTextEditor()}
      {activeTool === "connector" && (
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(17, 24, 39, 0.9)",
            color: "#d1d5db",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            zIndex: 1000,
            border: "1px solid #374151",
            pointerEvents: "none",
          }}
        >
          {connectorFrom
            ? "Click a second object to connect"
            : "Click an object to start connecting"}
        </div>
      )}
    </div>
  );
}
