"use client";

import { useRef, useEffect, useCallback } from "react";
import { BoardObject } from "@/lib/types";

interface MinimapProps {
  objects: BoardObject[];
  viewportPos: { x: number; y: number };
  viewportScale: number;
  stageSize: { width: number; height: number };
  onNavigate: (stageX: number, stageY: number) => void;
}

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;
const PADDING = 40; // world-space padding around all objects

// Muted colors for minimap objects
const OBJECT_OPACITY = 0.7;
const FRAME_OPACITY = 0.4;

export default function Minimap({
  objects,
  viewportPos,
  viewportScale,
  stageSize,
  onNavigate,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);

  // Compute the world bounding box of all objects
  const getWorldBounds = useCallback(() => {
    if (objects.length === 0) {
      return { minX: -500, minY: -500, maxX: 500, maxY: 500 };
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const obj of objects) {
      if (obj.type === "connector") continue; // connectors have 0 dimensions
      minX = Math.min(minX, obj.x);
      minY = Math.min(minY, obj.y);
      maxX = Math.max(maxX, obj.x + (obj.width || 0));
      maxY = Math.max(maxY, obj.y + (obj.height || 0));
    }

    if (!isFinite(minX)) {
      return { minX: -500, minY: -500, maxX: 500, maxY: 500 };
    }

    // Also include the current viewport area so minimap always shows where you are
    const vpWorldX = -viewportPos.x / viewportScale;
    const vpWorldY = -viewportPos.y / viewportScale;
    const vpWorldW = stageSize.width / viewportScale;
    const vpWorldH = stageSize.height / viewportScale;

    minX = Math.min(minX, vpWorldX);
    minY = Math.min(minY, vpWorldY);
    maxX = Math.max(maxX, vpWorldX + vpWorldW);
    maxY = Math.max(maxY, vpWorldY + vpWorldH);

    return {
      minX: minX - PADDING,
      minY: minY - PADDING,
      maxX: maxX + PADDING,
      maxY: maxY + PADDING,
    };
  }, [objects, viewportPos, viewportScale, stageSize]);

  // Convert minimap pixel coords to stage position
  const minimapToStagePos = useCallback(
    (mx: number, my: number) => {
      const bounds = getWorldBounds();
      const worldW = bounds.maxX - bounds.minX;
      const worldH = bounds.maxY - bounds.minY;
      const minimapScale = Math.min(MINIMAP_WIDTH / worldW, MINIMAP_HEIGHT / worldH);

      // Center the content in the minimap
      const drawnW = worldW * minimapScale;
      const drawnH = worldH * minimapScale;
      const offsetX = (MINIMAP_WIDTH - drawnW) / 2;
      const offsetY = (MINIMAP_HEIGHT - drawnH) / 2;

      // Convert minimap pixel to world coordinate (center of viewport)
      const worldX = (mx - offsetX) / minimapScale + bounds.minX;
      const worldY = (my - offsetY) / minimapScale + bounds.minY;

      // Convert to stage position (centering viewport on that world point)
      const newStageX = -(worldX * viewportScale) + stageSize.width / 2;
      const newStageY = -(worldY * viewportScale) + stageSize.height / 2;

      return { x: newStageX, y: newStageY };
    },
    [getWorldBounds, viewportScale, stageSize]
  );

  // Draw the minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_WIDTH * dpr;
    canvas.height = MINIMAP_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Compute world bounds and scale
    const bounds = getWorldBounds();
    const worldW = bounds.maxX - bounds.minX;
    const worldH = bounds.maxY - bounds.minY;
    const minimapScale = Math.min(MINIMAP_WIDTH / worldW, MINIMAP_HEIGHT / worldH);

    // Center content in minimap
    const drawnW = worldW * minimapScale;
    const drawnH = worldH * minimapScale;
    const offsetX = (MINIMAP_WIDTH - drawnW) / 2;
    const offsetY = (MINIMAP_HEIGHT - drawnH) / 2;

    const toMiniX = (wx: number) => (wx - bounds.minX) * minimapScale + offsetX;
    const toMiniY = (wy: number) => (wy - bounds.minY) * minimapScale + offsetY;

    // Draw objects (frames first as background, then other objects on top)
    const frames = objects.filter((o) => o.type === "frame");
    const others = objects.filter((o) => o.type !== "frame" && o.type !== "connector");

    // Draw frames as outlined rectangles
    for (const obj of frames) {
      const x = toMiniX(obj.x);
      const y = toMiniY(obj.y);
      const w = obj.width * minimapScale;
      const h = obj.height * minimapScale;
      ctx.globalAlpha = FRAME_OPACITY;
      ctx.strokeStyle = obj.color || "#6b7084";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }

    // Draw other objects as filled rectangles
    for (const obj of others) {
      const x = toMiniX(obj.x);
      const y = toMiniY(obj.y);
      const w = Math.max(2, (obj.width || 10) * minimapScale);
      const h = Math.max(2, (obj.height || 10) * minimapScale);
      ctx.globalAlpha = OBJECT_OPACITY;
      ctx.fillStyle = obj.color || "#6b7084";

      if (obj.type === "circle") {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, w, h);
      }
    }

    // Draw viewport indicator
    const vpWorldX = -viewportPos.x / viewportScale;
    const vpWorldY = -viewportPos.y / viewportScale;
    const vpWorldW = stageSize.width / viewportScale;
    const vpWorldH = stageSize.height / viewportScale;

    const vpX = toMiniX(vpWorldX);
    const vpY = toMiniY(vpWorldY);
    const vpW = vpWorldW * minimapScale;
    const vpH = vpWorldH * minimapScale;

    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#6c8cff";
    ctx.fillRect(vpX, vpY, vpW, vpH);

    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = "#6c8cff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vpX, vpY, vpW, vpH);

    ctx.globalAlpha = 1;
  }, [objects, viewportPos, viewportScale, stageSize, getWorldBounds]);

  // Mouse handlers for click/drag navigation
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const pos = minimapToStagePos(mx, my);
      onNavigate(pos.x, pos.y);
    },
    [minimapToStagePos, onNavigate]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const pos = minimapToStagePos(mx, my);
      onNavigate(pos.x, pos.y);
    },
    [minimapToStagePos, onNavigate]
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Stop dragging if mouse leaves minimap
  const handleMouseLeave = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 44,
        right: 24,
        width: MINIMAP_WIDTH,
        height: MINIMAP_HEIGHT,
        zIndex: 35,
        background: "var(--bg-glass)",
        backdropFilter: "blur(var(--blur-md))",
        WebkitBackdropFilter: "blur(var(--blur-md))",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-md)",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        style={{
          width: MINIMAP_WIDTH,
          height: MINIMAP_HEIGHT,
          cursor: "crosshair",
          display: "block",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
