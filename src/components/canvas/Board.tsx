"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Stage, Layer, Transformer, Rect as KonvaRect, Line as KonvaLine } from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";
import Konva from "konva";
import { BoardObject, Tool, COLORS, DEFAULT_DIMENSIONS, Comment } from "@/lib/types";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, AVAILABLE_REACTIONS, FREEHAND_SIMPLIFY_TOLERANCE, DEFAULT_GRID_SIZE, COMMENT_PIN_RADIUS, COMMENT_PIN_COLOR_UNRESOLVED, COMMENT_PIN_COLOR_RESOLVED } from "@/lib/constants";
import { CursorData } from "@/lib/types";
import { computeSnapResult, Guide } from "@/hooks/useSmartGuides";
import StickyNote from "./StickyNote";
import Shape from "./Shape";
import TextElement from "./TextElement";
import Frame from "./Frame";
import Connector from "./Connector";
import FreehandPath from "./FreehandPath";
import { simplifyPoints } from "./FreehandPath";
import Cursors from "./Cursors";
import LineEndpoints from "./LineEndpoints";

interface BoardCanvasProps {
  objects: BoardObject[];
  cursors: Record<string, CursorData>;
  activeTool: Tool;
  userId: string;
  bgColor: string;
  onAddObject: (obj: Omit<BoardObject, "id" | "updatedAt">) => Promise<string>;
  onUpdateObject: (id: string, updates: Partial<BoardObject>) => void;
  onDeleteObject: (id: string) => void;
  onBatchUpdateObjects?: (updates: Array<{ id: string; changes: Partial<BoardObject> }>) => void;
  onBatchDeleteObjects?: (ids: string[]) => void;
  onCursorMove: (x: number, y: number) => void;
  onToolChange: (tool: Tool) => void;
  onThumbnailCapture?: (dataUrl: string, force?: boolean) => void;
  onSelectionChange?: (ids: string[]) => void;
  onStageRef?: (stage: Konva.Stage | null) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onToggleReaction?: (objectId: string, emoji: string) => void;
  votingEnabled?: boolean;
  onCastVote?: (objectId: string) => void;
  onRemoveVote?: (objectId: string) => void;
  getObjectVoteCount?: (objectId: string) => number;
  getUserVoteCount?: (objectId: string) => number;
  freehandStrokeWidth?: number;
  isPresentationMode?: boolean;
  onViewportChange?: (pos: { x: number; y: number }, scale: number) => void;
  onViewportControl?: (controls: { panTo: (x: number, y: number) => void }) => void;
  onCursorChatActivate?: () => void;
  snapEnabled?: boolean;
  gridEnabled?: boolean;
  comments?: Comment[];
  activeCommentId?: string | null;
  onAddComment?: (x: number, y: number, objectId?: string) => void;
  onSelectComment?: (id: string | null) => void;
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
  onBatchUpdateObjects,
  onBatchDeleteObjects,
  onCursorMove,
  onToolChange,
  onThumbnailCapture,
  onSelectionChange,
  onStageRef,
  onUndo,
  onRedo,
  onToggleReaction,
  votingEnabled,
  onCastVote,
  onRemoveVote,
  getObjectVoteCount,
  getUserVoteCount,
  freehandStrokeWidth = 3,
  isPresentationMode = false,
  onViewportChange,
  onViewportControl,
  onCursorChatActivate,
  snapEnabled = false,
  gridEnabled = false,
  comments = [],
  activeCommentId,
  onAddComment,
  onSelectComment,
}: BoardCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastDragUpdate = useRef<number>(0);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editState, setEditState] = useState<EditState | null>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [connectorFrom, setConnectorFrom] = useState<string | null>(null);

  // Multi-select: derived single-selection alias (for reaction picker, edit, etc.)
  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;

  // Marquee (rubber-band) selection state
  const [marquee, setMarquee] = useState<{
    startX: number; startY: number;
    currentX: number; currentY: number;
  } | null>(null);
  const isDraggingMarquee = useRef(false);
  const didMarqueeDrag = useRef(false);

  // Multi-drag: track start positions for delta-based movement
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Smart guides state
  const [activeGuides, setActiveGuides] = useState<Guide[]>([]);

  // Freehand drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const drawingPoints = useRef<number[]>([]);
  const [livePoints, setLivePoints] = useState<number[]>([]);
  const drawingDocId = useRef<string | null>(null);
  const drawingStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastDrawSync = useRef<number>(0);

  // Expose stage ref to parent
  useEffect(() => {
    onStageRef?.(stageRef.current);
    return () => onStageRef?.(null);
  }, [onStageRef]);

  // Expose panTo control to parent for minimap navigation
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  useEffect(() => {
    onViewportControl?.({
      panTo: (x: number, y: number) => {
        const newPos = { x, y };
        setStagePos(newPos);
        viewportChangeRef.current?.(newPos, scaleRef.current);
      },
    });
  }, [onViewportControl]);

  // Report viewport to parent on mount (for minimap initial state)
  const viewportChangeRef = useRef(onViewportChange);
  viewportChangeRef.current = onViewportChange;
  useEffect(() => {
    viewportChangeRef.current?.(stagePos, scale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize stage to window
  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Capture thumbnail periodically, on unmount, and on page close
  useEffect(() => {
    if (!onThumbnailCapture) return;
    const capture = (force?: boolean) => {
      const stage = stageRef.current;
      const layer = layerRef.current;
      if (!stage || !layer) return;
      try {
        // Get the bounding box of all visible content
        const children = layer.getChildren((node) => node.getClassName() !== "Transformer");
        if (children.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        children.forEach((node) => {
          const rect = node.getClientRect({ relativeTo: stage });
          if (rect.width === 0 && rect.height === 0) return;
          minX = Math.min(minX, rect.x);
          minY = Math.min(minY, rect.y);
          maxX = Math.max(maxX, rect.x + rect.width);
          maxY = Math.max(maxY, rect.y + rect.height);
        });

        if (!isFinite(minX)) return;

        // Add padding around the content
        const pad = 40;
        const cropX = minX - pad;
        const cropY = minY - pad;
        const cropW = maxX - minX + pad * 2;
        const cropH = maxY - minY + pad * 2;

        // Cap the output size to keep the data URL small
        const maxDim = 600;
        const ratio = Math.min(1, maxDim / Math.max(cropW, cropH));

        // Add a temporary white background behind all content
        const bgRect = new Konva.Rect({
          x: cropX,
          y: cropY,
          width: cropW,
          height: cropH,
          fill: "#ffffff",
          listening: false,
        });
        layer.add(bgRect);
        bgRect.moveToBottom();
        layer.batchDraw();

        const dataUrl = stage.toDataURL({
          x: cropX,
          y: cropY,
          width: cropW,
          height: cropH,
          pixelRatio: ratio,
          mimeType: "image/png",
        });

        // Remove the temporary background
        bgRect.destroy();
        layer.batchDraw();

        onThumbnailCapture(dataUrl, force);
      } catch {
        // Canvas may be tainted or empty
      }
    };
    const handleBeforeUnload = () => {
      capture(true);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    const interval = setInterval(() => capture(), 30000);
    // Capture once after a short delay (let objects render)
    const initial = setTimeout(() => capture(), 3000);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(interval);
      clearTimeout(initial);
      capture(true); // Force capture on unmount (navigating away)
    };
  }, [onThumbnailCapture]);

  // Focus textarea only when editing starts (not on every text change)
  useEffect(() => {
    if (editState && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editState?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editState) return; // Don't handle shortcuts while editing text

      // Undo: Cmd+Z (Mac) / Ctrl+Z (Win)
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        onUndo?.();
        return;
      }
      // Redo: Cmd+Shift+Z (Mac) / Ctrl+Shift+Z (Win)
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        onRedo?.();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.size > 0) {
          const ids = [...selectedIds];
          if (ids.length === 1) {
            onDeleteObject(ids[0]);
          } else if (onBatchDeleteObjects) {
            onBatchDeleteObjects(ids);
          } else {
            ids.forEach((id) => onDeleteObject(id));
          }
          setSelectedIds(new Set());
        }
      }
      if (e.key === "Escape") {
        // Cancel freehand drawing in progress
        if (isDrawing && drawingDocId.current) {
          onDeleteObject(drawingDocId.current);
          drawingDocId.current = null;
          drawingPoints.current = [];
          setLivePoints([]);
          setIsDrawing(false);
        }
        setSelectedIds(new Set());
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
      if (e.key === "d" || e.key === "D") onToolChange("freehand");
      if (e.key === "c" || e.key === "C") onToolChange("connector");
      if (e.key === "m" || e.key === "M") onToolChange("comment");
      // Cursor chat: "/" key only in select/pan mode, not during text editing
      if (e.key === "/" && (activeTool === "select" || activeTool === "pan")) {
        const tag = (document.activeElement?.tagName || "").toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          onCursorChatActivate?.();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, editState, isDrawing, activeTool, onDeleteObject, onBatchDeleteObjects, onToolChange, onUndo, onRedo, onCursorChatActivate]);

  // Report selection changes to parent
  useEffect(() => {
    onSelectionChange?.([...selectedIds]);
  }, [selectedIds, onSelectionChange]);

  // Clear selection when selected objects are removed (deleted by any source)
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const objectIdSet = new Set(objects.map((o) => o.id));
    const filtered = new Set([...selectedIds].filter((id) => objectIdSet.has(id)));
    if (filtered.size !== selectedIds.size) {
      setSelectedIds(filtered);
    }
  }, [selectedIds, objects]);

  // Clear selection when tool changes away from select (but not for freehand — it doesn't need clearing)
  useEffect(() => {
    if (activeTool !== "select" && activeTool !== "pan") {
      setSelectedIds(new Set());
    }
  }, [activeTool]);

  // Attach/detach Transformer when selection changes
  useEffect(() => {
    const transformer = transformerRef.current;
    const layer = layerRef.current;
    if (!transformer || !layer) return;

    if (selectedIds.size === 0) {
      transformer.nodes([]);
      return;
    }

    // Filter to transformable types (exclude lines, connectors, and freehand)
    const transformableIds = [...selectedIds].filter((id) => {
      const obj = objects.find((o) => o.id === id);
      return obj && obj.type !== "line" && obj.type !== "connector" && obj.type !== "freehand";
    });

    const nodes = transformableIds
      .map((id) => layer.findOne("." + id))
      .filter(Boolean) as Konva.Node[];

    transformer.nodes(nodes);
  }, [selectedIds, objects]);

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
      if (isPresentationMode) return;
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

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };
      setScale(newScale);
      setStagePos(newPos);
      viewportChangeRef.current?.(newPos, newScale);
    },
    [scale, stagePos]
  );

  // Track mouse for cursor sharing + marquee updates + freehand drawing
  const handleMouseMove = useCallback(
    (_e: KonvaEventObject<MouseEvent>) => {
      const worldPos = getWorldPointer();
      onCursorMove(worldPos.x, worldPos.y);

      // Update marquee rectangle during rubber-band drag
      if (isDraggingMarquee.current) {
        setMarquee((prev) =>
          prev ? { ...prev, currentX: worldPos.x, currentY: worldPos.y } : null
        );
      }

      // Freehand drawing: append point to local array at 60fps, sync to Firestore throttled
      if (isDrawing && drawingDocId.current) {
        // Points are relative to the starting world position (stored in drawingStartPos)
        const relX = worldPos.x - drawingStartPos.current.x;
        const relY = worldPos.y - drawingStartPos.current.y;
        drawingPoints.current.push(relX, relY);
        setLivePoints([...drawingPoints.current]);

        // Sync to Firestore every 100ms
        const now = Date.now();
        if (now - lastDrawSync.current > 100) {
          lastDrawSync.current = now;
          onUpdateObject(drawingDocId.current, { points: [...drawingPoints.current] });
        }
      }
    },
    [getWorldPointer, onCursorMove, isDrawing, onUpdateObject]
  );

  // Click on stage to create objects, deselect, or handle connectors
  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (isPresentationMode) return;
      // Skip click that fires after a marquee drag
      if (didMarqueeDrag.current) {
        didMarqueeDrag.current = false;
        return;
      }
      const worldPos = getWorldPointer();

      // Voting mode: left-click casts votes instead of selecting
      const isLeftClick = !("button" in e.evt) || (e.evt as MouseEvent).button === 0;
      if (votingEnabled && onCastVote && isLeftClick && e.target !== stageRef.current) {
        const objectId = getObjectIdFromTarget(e.target as Konva.Node);
        if (objectId) {
          const targetObj = objects.find((o) => o.id === objectId);
          if (targetObj && targetObj.type !== "connector" && targetObj.type !== "line") {
            onCastVote(objectId);
          }
        }
        return;
      }

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
            setSelectedIds(new Set([objectId]));
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

      // Comment tool: place comment pin
      if (activeTool === "comment" && onAddComment) {
        if (e.target === stageRef.current) {
          // Click on empty canvas: create floating comment
          onAddComment(worldPos.x, worldPos.y);
        } else {
          // Click on an object: pin comment to that object
          const objectId = getObjectIdFromTarget(e.target as Konva.Node);
          if (objectId) {
            const targetObj = objects.find((o) => o.id === objectId);
            if (targetObj) {
              // Store offset from object origin
              onAddComment(worldPos.x - targetObj.x, worldPos.y - targetObj.y, objectId);
            }
          }
        }
        onToolChange("select");
        return;
      }

      // Freehand tool handles interactions via mousedown/up, not click
      if (activeTool === "freehand") return;

      // For all other tools, only handle clicks on empty canvas (not on objects)
      if (e.target !== stageRef.current) return;

      if (activeTool === "select" || activeTool === "pan") {
        setSelectedIds(new Set());
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
    [activeTool, getWorldPointer, objects, userId, onAddObject, onToolChange, connectorFrom, getObjectIdFromTarget, votingEnabled, onCastVote]
  );

  // Right-click to remove vote in voting mode
  const handleContextMenu = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (!votingEnabled || !onRemoveVote) return;
      e.evt.preventDefault();
      if (e.target === stageRef.current) return;
      const objectId = getObjectIdFromTarget(e.target as Konva.Node);
      if (objectId) {
        const targetObj = objects.find((o) => o.id === objectId);
        if (targetObj && targetObj.type !== "connector" && targetObj.type !== "line") {
          onRemoveVote(objectId);
        }
      }
    },
    [votingEnabled, onRemoveVote, objects, getObjectIdFromTarget]
  );

  // Handle transform end: bake scale into dimensions, reset scale
  const handleTransformEnd = useCallback(
    (objId: string, obj: BoardObject, e: KonvaEventObject<Event>) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onUpdateObject(objId, {
        x: node.x(),
        y: node.y(),
        width: Math.max(20, obj.width * scaleX),
        height: Math.max(20, obj.height * scaleY),
        rotation: node.rotation(),
      });
    },
    [onUpdateObject]
  );

  // Throttled drag move: broadcast position during drag at ~60ms intervals
  const handleObjectDragMove = useCallback(
    (draggedId: string, x: number, y: number) => {
      const now = Date.now();
      if (now - lastDragUpdate.current < 60) return;
      lastDragUpdate.current = now;

      if (selectedIds.size <= 1) {
        // Smart guides snap for single-object drag
        if (snapEnabled) {
          const dragObj = objects.find((o) => o.id === draggedId);
          if (dragObj) {
            const others = objects.filter((o) => o.id !== draggedId);
            const gridSize = gridEnabled ? DEFAULT_GRID_SIZE : undefined;
            const snap = computeSnapResult(
              { x, y, width: dragObj.width, height: dragObj.height },
              others,
              undefined,
              gridSize
            );
            setActiveGuides(snap.guides);
            onUpdateObject(draggedId, { x: snap.x, y: snap.y });
            return;
          }
        }
        onUpdateObject(draggedId, { x, y });
        return;
      }

      // Multi-drag: lazily capture start positions on first move
      if (dragStartPositions.current.size === 0) {
        for (const obj of objects) {
          if (selectedIds.has(obj.id)) {
            dragStartPositions.current.set(obj.id, { x: obj.x, y: obj.y });
          }
        }
      }

      // Compute delta and apply to all selected objects
      const start = dragStartPositions.current.get(draggedId);
      if (!start) {
        onUpdateObject(draggedId, { x, y });
        return;
      }
      const dx = x - start.x;
      const dy = y - start.y;
      for (const id of selectedIds) {
        const objStart = dragStartPositions.current.get(id);
        if (!objStart) continue;
        onUpdateObject(id, { x: objStart.x + dx, y: objStart.y + dy });
      }
    },
    [selectedIds, objects, onUpdateObject, snapEnabled, gridEnabled]
  );

  // Handle drag end for objects (multi-drag final commit)
  const handleObjectDragEnd = useCallback(
    (draggedId: string, x: number, y: number) => {
      setActiveGuides([]);
      if (selectedIds.size <= 1) {
        // Apply final snap on drag end too
        if (snapEnabled) {
          const dragObj = objects.find((o) => o.id === draggedId);
          if (dragObj) {
            const others = objects.filter((o) => o.id !== draggedId);
            const gridSize = gridEnabled ? DEFAULT_GRID_SIZE : undefined;
            const snap = computeSnapResult(
              { x, y, width: dragObj.width, height: dragObj.height },
              others,
              undefined,
              gridSize
            );
            onUpdateObject(draggedId, { x: snap.x, y: snap.y });
            return;
          }
        }
        onUpdateObject(draggedId, { x, y });
        return;
      }

      const start = dragStartPositions.current.get(draggedId);
      if (!start) {
        onUpdateObject(draggedId, { x, y });
        return;
      }
      const dx = x - start.x;
      const dy = y - start.y;

      const updates = [...selectedIds]
        .map((id) => {
          const objStart = dragStartPositions.current.get(id);
          if (!objStart) return null;
          return { id, changes: { x: objStart.x + dx, y: objStart.y + dy } };
        })
        .filter(Boolean) as Array<{ id: string; changes: Partial<BoardObject> }>;

      if (onBatchUpdateObjects && updates.length > 1) {
        onBatchUpdateObjects(updates);
      } else {
        updates.forEach(({ id, changes }) => onUpdateObject(id, changes));
      }
      dragStartPositions.current.clear();
    },
    [selectedIds, objects, onUpdateObject, onBatchUpdateObjects, snapEnabled, gridEnabled]
  );

  // Handle drag for panning
  const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    if (e.target === stageRef.current) {
      const newPos = { x: e.target.x(), y: e.target.y() };
      setStagePos(newPos);
      viewportChangeRef.current?.(newPos, scale);
    }
  }, [scale]);

  // Marquee selection + freehand drawing start
  const handleStageMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (isPresentationMode) return;
      if ((e.evt as MouseEvent).button !== 0) return;

      // Freehand drawing: start stroke on mousedown
      if (activeTool === "freehand") {
        const pos = getWorldPointer();
        drawingStartPos.current = { x: pos.x, y: pos.y };
        drawingPoints.current = [0, 0]; // First point is origin-relative (0,0)
        setLivePoints([0, 0]);
        setIsDrawing(true);
        lastDrawSync.current = Date.now();

        // Create a Firestore document immediately so collaborators see the stroke forming
        const maxZ = objects.length > 0 ? Math.max(...objects.map((o) => o.zIndex)) + 1 : 1;
        onAddObject({
          type: "freehand",
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          color: COLORS.shape[Math.floor(Math.random() * COLORS.shape.length)],
          rotation: 0,
          zIndex: maxZ,
          points: [0, 0],
          strokeWidth: freehandStrokeWidth,
          createdBy: userId,
        }).then((id) => {
          drawingDocId.current = id;
        });
        return;
      }

      // Marquee: only in select mode on empty canvas
      if (activeTool !== "select") return;
      if (e.target !== stageRef.current) return;

      const pos = getWorldPointer();
      isDraggingMarquee.current = true;
      setMarquee({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y });
    },
    [activeTool, getWorldPointer, objects, onAddObject, userId, freehandStrokeWidth]
  );

  // Marquee selection end + freehand drawing end
  const handleStageMouseUp = useCallback(
    (_e: KonvaEventObject<MouseEvent>) => {
      // Freehand drawing: finalize stroke
      if (isDrawing) {
        setIsDrawing(false);
        const raw = drawingPoints.current;
        drawingPoints.current = [];
        setLivePoints([]);

        // If fewer than 2 points or very short stroke, delete the created object
        if (raw.length <= 4) {
          if (drawingDocId.current) {
            onDeleteObject(drawingDocId.current);
            drawingDocId.current = null;
          }
          return;
        }

        // Simplify with RDP
        const simplified = simplifyPoints(raw, FREEHAND_SIMPLIFY_TOLERANCE);

        // Compute bounding box for width/height
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < simplified.length; i += 2) {
          minX = Math.min(minX, simplified[i]);
          minY = Math.min(minY, simplified[i + 1]);
          maxX = Math.max(maxX, simplified[i]);
          maxY = Math.max(maxY, simplified[i + 1]);
        }

        if (drawingDocId.current) {
          onUpdateObject(drawingDocId.current, {
            points: simplified,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
          });
          drawingDocId.current = null;
        }
        return;
      }

      // Marquee selection end
      if (!isDraggingMarquee.current || !marquee) {
        isDraggingMarquee.current = false;
        return;
      }
      isDraggingMarquee.current = false;

      const rx = Math.min(marquee.startX, marquee.currentX);
      const ry = Math.min(marquee.startY, marquee.currentY);
      const rw = Math.abs(marquee.currentX - marquee.startX);
      const rh = Math.abs(marquee.currentY - marquee.startY);

      if (rw > 5 || rh > 5) {
        didMarqueeDrag.current = true;
        const hit = objects
          .filter((obj) => {
            if (obj.type === "connector") return false;
            return (
              obj.x < rx + rw &&
              obj.x + obj.width > rx &&
              obj.y < ry + rh &&
              obj.y + obj.height > ry
            );
          })
          .map((obj) => obj.id);

        setSelectedIds(hit.length > 0 ? new Set(hit) : new Set());
      }

      setMarquee(null);
    },
    [isDrawing, marquee, objects, onDeleteObject, onUpdateObject]
  );

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
    const isSelected = selectedIds.has(obj.id);
    const isConnectorSource = connectorFrom === obj.id;
    const isDraggable = !isPresentationMode && activeTool === "select";
    const isEditing = editState?.id === obj.id;

    const commonProps = {
      isSelected: isSelected || isConnectorSource,
      onSelect: (shiftKey?: boolean) => {
        if (shiftKey) {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(obj.id)) {
              next.delete(obj.id);
            } else {
              next.add(obj.id);
            }
            return next;
          });
        } else if (!selectedIds.has(obj.id)) {
          setSelectedIds(new Set([obj.id]));
        }
        // If already selected without shift: keep set as-is (for drag)
      },
      onDragEnd: (x: number, y: number) => handleObjectDragEnd(obj.id, x, y),
      onDragMove: (x: number, y: number) => handleObjectDragMove(obj.id, x, y),
      draggable: isDraggable,
    };

    const transformEnd = (e: KonvaEventObject<Event>) =>
      handleTransformEnd(obj.id, obj, e);

    switch (obj.type) {
      case "sticky-note":
        return (
          <StickyNote
            key={obj.id}
            obj={isEditing ? { ...obj, text: "" } : obj}
            {...commonProps}
            onTransformEnd={transformEnd}
            onSelect={(shiftKey?: boolean) => {
              if (shiftKey) {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(obj.id)) next.delete(obj.id);
                  else next.add(obj.id);
                  return next;
                });
              } else {
                setSelectedIds(new Set([obj.id]));
                // Single-click on sticky note: start editing immediately (only if single-select)
                if (activeTool === "select" && !editState) {
                  handleEditText(obj);
                }
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
            onTransformEnd={transformEnd}
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
            onTransformEnd={transformEnd}
            onDblClick={() => handleEditText(obj)}
          />
        );
      case "frame":
        return (
          <Frame
            key={obj.id}
            obj={obj}
            {...commonProps}
            onTransformEnd={transformEnd}
            onDblClick={() => handleEditText(obj)}
          />
        );
      case "freehand":
        return (
          <FreehandPath
            key={obj.id}
            obj={obj}
            {...commonProps}
          />
        );
      case "connector":
        return (
          <Connector
            key={obj.id}
            obj={obj}
            allObjects={objects}
            isSelected={isSelected}
            onSelect={() => setSelectedIds(new Set([obj.id]))}
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
        draggable={!isPresentationMode && activeTool === "pan"}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleStageMouseUp}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onContextMenu={handleContextMenu}
        onDragEnd={handleDragEnd}
        style={{ backgroundColor: bgColor, cursor: isPresentationMode ? "default" : activeTool === "pan" ? "grab" : "crosshair" }}
      >
        <Layer ref={layerRef}>
          {/* Grid dots */}
          {gridEnabled && (() => {
            const gs = DEFAULT_GRID_SIZE;
            const vpX = -stagePos.x / scale;
            const vpY = -stagePos.y / scale;
            const vpW = stageSize.width / scale;
            const vpH = stageSize.height / scale;
            const startX = Math.floor(vpX / gs) * gs;
            const startY = Math.floor(vpY / gs) * gs;
            const dots: React.ReactNode[] = [];
            for (let gx = startX; gx < vpX + vpW; gx += gs) {
              for (let gy = startY; gy < vpY + vpH; gy += gs) {
                dots.push(
                  <KonvaRect
                    key={`g${gx},${gy}`}
                    x={gx - 1 / scale}
                    y={gy - 1 / scale}
                    width={2 / scale}
                    height={2 / scale}
                    fill="rgba(150,150,150,0.35)"
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                );
              }
            }
            return dots;
          })()}
          {/* Render frames first (behind everything).
              Sort by area descending so larger frames render first
              and smaller nested frames sit on top. */}
          {objects
            .filter((o) => o.type === "frame")
            .sort((a, b) => b.width * b.height - (a.width * a.height))
            .map(renderObject)}
          {/* Render non-frame objects on top so they're always
              clickable even when inside a frame */}
          {objects.filter((o) => o.type !== "frame").map(renderObject)}
          {/* Line endpoint handles for selected line (single-select only) */}
          {selectedId && objects.find((o) => o.id === selectedId && o.type === "line") && (
            <LineEndpoints
              obj={objects.find((o) => o.id === selectedId)!}
              onUpdate={(updates) => onUpdateObject(selectedId, updates)}
            />
          )}
          {/* Live freehand drawing preview */}
          {isDrawing && livePoints.length >= 4 && (() => {
            // Find the drawing object's position to offset the preview
            const drawObj = drawingDocId.current ? objects.find((o) => o.id === drawingDocId.current) : null;
            const ox = drawObj?.x ?? getWorldPointer().x;
            const oy = drawObj?.y ?? getWorldPointer().y;
            return (
              <KonvaLine
                x={ox}
                y={oy}
                points={livePoints}
                stroke={drawObj?.color ?? "#3b82f6"}
                strokeWidth={freehandStrokeWidth}
                tension={0.4}
                lineCap="round"
                lineJoin="round"
                perfectDrawEnabled={false}
                listening={false}
              />
            );
          })()}
          {/* Marquee selection rectangle */}
          {marquee && (
            <KonvaRect
              x={Math.min(marquee.startX, marquee.currentX)}
              y={Math.min(marquee.startY, marquee.currentY)}
              width={Math.abs(marquee.currentX - marquee.startX)}
              height={Math.abs(marquee.currentY - marquee.startY)}
              fill="rgba(59, 130, 246, 0.08)"
              stroke="#3b82f6"
              strokeWidth={1 / scale}
              dash={[4 / scale, 4 / scale]}
              listening={false}
            />
          )}
          {/* Smart guide lines */}
          {activeGuides.map((guide, i) => {
            const vpX = -stagePos.x / scale;
            const vpY = -stagePos.y / scale;
            const vpW = stageSize.width / scale;
            const vpH = stageSize.height / scale;
            return guide.orientation === "vertical" ? (
              <KonvaLine
                key={`guide-${i}`}
                points={[guide.position, vpY - 1000, guide.position, vpY + vpH + 1000]}
                stroke={guide.color}
                strokeWidth={1 / scale}
                dash={[4 / scale, 4 / scale]}
                listening={false}
              />
            ) : (
              <KonvaLine
                key={`guide-${i}`}
                points={[vpX - 1000, guide.position, vpX + vpW + 1000, guide.position]}
                stroke={guide.color}
                strokeWidth={1 / scale}
                dash={[4 / scale, 4 / scale]}
                listening={false}
              />
            );
          })}
          <Transformer
            ref={transformerRef}
            rotateEnabled={true}
            enabledAnchors={[
              "top-left", "top-right", "bottom-left", "bottom-right",
              "middle-left", "middle-right", "top-center", "bottom-center",
            ]}
            boundBoxFunc={(_oldBox, newBox) => {
              if (newBox.width < 20 || newBox.height < 20) return _oldBox;
              return newBox;
            }}
          />
        </Layer>
        <Layer listening={false}>
          <Cursors cursors={cursors} />
        </Layer>
      </Stage>
      {renderTextEditor()}
      {/* Floating delete button on selected object(s) */}
      {selectedIds.size > 0 &&
        activeTool === "select" &&
        (() => {
          const selectedObjs = objects.filter(
            (o) => selectedIds.has(o.id) && o.type !== "connector"
          );
          if (selectedObjs.length === 0) return null;

          // Compute bounding box of all selected objects
          const bbox = selectedObjs.reduce(
            (acc, o) => ({
              minX: Math.min(acc.minX, o.x),
              minY: Math.min(acc.minY, o.y),
              maxX: Math.max(acc.maxX, o.x + o.width),
              maxY: Math.max(acc.maxY, o.y + o.height),
            }),
            { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
          );
          const screenPos = getScreenPos(bbox.maxX, bbox.minY);
          return (
            <button
              onClick={() => {
                const ids = [...selectedIds];
                if (ids.length === 1) {
                  onDeleteObject(ids[0]);
                } else if (onBatchDeleteObjects) {
                  onBatchDeleteObjects(ids);
                } else {
                  ids.forEach((id) => onDeleteObject(id));
                }
                setSelectedIds(new Set());
              }}
              style={{
                position: "absolute",
                left: screenPos.x + 4,
                top: screenPos.y - 36,
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#ef4444",
                border: "2px solid #ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                zIndex: 1000,
              }}
              title="Delete object"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          );
        })()}
      {/* Reaction picker on selected object */}
      {selectedId &&
        activeTool === "select" &&
        onToggleReaction &&
        (() => {
          const obj = objects.find((o) => o.id === selectedId);
          if (!obj || obj.type === "connector" || obj.type === "line" || obj.type === "freehand") return null;
          const screenPos = getScreenPos(obj.x, obj.y + obj.height);
          return (
            <div
              style={{
                position: "absolute",
                left: screenPos.x,
                top: screenPos.y + 8,
                display: "flex",
                gap: 2,
                background: "var(--bg-glass)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 20,
                padding: "4px 6px",
                zIndex: 1000,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              {AVAILABLE_REACTIONS.map((emoji) => {
                const reacted = obj.reactions?.[emoji]?.includes(userId);
                return (
                  <button
                    key={emoji}
                    onClick={() => onToggleReaction(selectedId, emoji)}
                    style={{
                      width: 30,
                      height: 30,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      border: "none",
                      borderRadius: "50%",
                      cursor: "pointer",
                      background: reacted ? "var(--accent-muted, rgba(99,102,241,0.15))" : "transparent",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = reacted
                        ? "var(--accent-muted, rgba(99,102,241,0.25))"
                        : "var(--bg-surface-hover)";
                      e.currentTarget.style.transform = "scale(1.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = reacted
                        ? "var(--accent-muted, rgba(99,102,241,0.15))"
                        : "transparent";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          );
        })()}

      {/* Reaction badges on objects */}
      {objects.map((obj) => {
        if (!obj.reactions) return null;
        const entries = Object.entries(obj.reactions).filter(([, users]) => users.length > 0);
        if (entries.length === 0) return null;
        const screenPos = getScreenPos(obj.x, obj.y + obj.height);
        return (
          <div
            key={`reactions-${obj.id}`}
            style={{
              position: "absolute",
              left: screenPos.x,
              top: screenPos.y + (selectedId === obj.id ? 46 : 4),
              display: "flex",
              gap: 4,
              zIndex: 999,
              pointerEvents: "none",
            }}
          >
            {entries.map(([emoji, users]) => (
              <div
                key={emoji}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  background: users.includes(userId)
                    ? "var(--accent-muted, rgba(99,102,241,0.2))"
                    : "var(--bg-glass)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  border: users.includes(userId)
                    ? "1px solid var(--accent, #6366f1)"
                    : "1px solid var(--border-subtle)",
                  borderRadius: 12,
                  padding: "2px 6px",
                  fontSize: 13,
                  lineHeight: "18px",
                }}
              >
                <span>{emoji}</span>
                <span style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 500 }}>
                  {users.length}
                </span>
              </div>
            ))}
          </div>
        );
      })}

      {/* Vote count badges */}
      {votingEnabled &&
        getObjectVoteCount &&
        objects.map((obj) => {
          if (obj.type === "connector" || obj.type === "line") return null;
          const count = getObjectVoteCount(obj.id);
          const myVotes = getUserVoteCount ? getUserVoteCount(obj.id) : 0;
          if (count === 0) return null;
          const screenPos = getScreenPos(
            obj.x + obj.width - 10,
            obj.y - 10
          );
          return (
            <div
              key={`vote-${obj.id}`}
              style={{
                position: "absolute",
                left: screenPos.x,
                top: screenPos.y,
                display: "flex",
                alignItems: "center",
                gap: 4,
                height: 24,
                background: "var(--accent)",
                color: "#fff",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 700,
                padding: "0 8px",
                boxShadow: "0 2px 8px rgba(99,102,241,0.4)",
                zIndex: 999,
                pointerEvents: "none",
              }}
            >
              <span>{count}</span>
              {myVotes > 0 && (
                <span style={{ fontSize: 10, opacity: 0.8 }}>({myVotes} you)</span>
              )}
            </div>
          );
        })}

      {/* Voting mode overlay — click objects to vote */}
      {votingEnabled && onCastVote && (
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(99, 102, 241, 0.9)",
            color: "#ffffff",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            zIndex: 1000,
            border: "1px solid rgba(129, 140, 248, 0.5)",
            pointerEvents: "none",
            fontWeight: 500,
          }}
        >
          Voting mode — click to vote · right-click to remove
        </div>
      )}

      {activeTool === "freehand" && !isDrawing && (
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
          Click and drag to draw · Esc to cancel
        </div>
      )}

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

      {activeTool === "comment" && (
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
          Click anywhere to add a comment
        </div>
      )}

      {/* Comment pins */}
      {comments.map((comment) => {
        // Calculate world position: floating or pinned to object
        let worldX = comment.x;
        let worldY = comment.y;
        if (comment.objectId) {
          const obj = objects.find((o) => o.id === comment.objectId);
          if (obj) {
            worldX = obj.x + comment.x;
            worldY = obj.y + comment.y;
          } else {
            // Object was deleted, show at stored position
            worldX = comment.x;
            worldY = comment.y;
          }
        }
        const screenPos = getScreenPos(worldX, worldY);
        const pinColor = comment.resolved ? COMMENT_PIN_COLOR_RESOLVED : COMMENT_PIN_COLOR_UNRESOLVED;
        const isActive = activeCommentId === comment.id;
        return (
          <button
            key={`comment-pin-${comment.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectComment?.(isActive ? null : comment.id);
            }}
            style={{
              position: "absolute",
              left: screenPos.x - COMMENT_PIN_RADIUS,
              top: screenPos.y - COMMENT_PIN_RADIUS,
              width: COMMENT_PIN_RADIUS * 2,
              height: COMMENT_PIN_RADIUS * 2,
              borderRadius: "50%",
              background: pinColor,
              border: isActive ? "2px solid #ffffff" : "2px solid rgba(255,255,255,0.6)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: isActive
                ? `0 0 0 3px ${pinColor}, 0 2px 8px rgba(0,0,0,0.3)`
                : "0 2px 6px rgba(0,0,0,0.25)",
              zIndex: 1001,
              transition: "box-shadow 0.15s ease, transform 0.15s ease",
              transform: isActive ? "scale(1.15)" : "scale(1)",
              opacity: comment.resolved ? 0.7 : 1,
              padding: 0,
            }}
            title={comment.resolved ? "Resolved comment" : "Comment"}
          >
            {comment.messages.length > 0 ? (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#ffffff",
                  lineHeight: 1,
                }}
              >
                {comment.messages.length}
              </span>
            ) : (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
