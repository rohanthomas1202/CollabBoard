"use client";

import { BoardObject } from "@/lib/types";

interface AlignmentToolbarProps {
  selectedObjects: BoardObject[];
  onBatchUpdate: (updates: Array<{ id: string; changes: Partial<BoardObject> }>) => void;
  screenPosition: { x: number; y: number };
}

type AlignAction = "left" | "center-h" | "right" | "top" | "center-v" | "bottom" | "distribute-h" | "distribute-v";

export default function AlignmentToolbar({ selectedObjects, onBatchUpdate, screenPosition }: AlignmentToolbarProps) {
  if (selectedObjects.length < 2) return null;

  const SPACING = 16;
  const FRAME_PAD = 20;

  /**
   * After horizontal alignment (left/center/right), objects that were spread out
   * horizontally may now overlap because they share the same X region.
   * Sort by original Y and push any overlapping ones down so nothing stacks.
   */
  const resolveVerticalOverlap = (
    items: Array<{ id: string; x: number; y: number; width: number; height: number }>
  ): Array<{ id: string; changes: Partial<BoardObject> }> => {
    const sorted = [...items].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const hOverlap =
        cur.x < prev.x + prev.width && cur.x + cur.width > prev.x;
      if (hOverlap && cur.y < prev.y + prev.height + SPACING) {
        cur.y = prev.y + prev.height + SPACING;
      }
    }
    return sorted.map(o => ({ id: o.id, changes: { x: o.x, y: o.y } }));
  };

  /**
   * After vertical alignment (top/center/bottom), push any overlapping ones
   * right so nothing stacks.
   */
  const resolveHorizontalOverlap = (
    items: Array<{ id: string; x: number; y: number; width: number; height: number }>
  ): Array<{ id: string; changes: Partial<BoardObject> }> => {
    const sorted = [...items].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const vOverlap =
        cur.y < prev.y + prev.height && cur.y + cur.height > prev.y;
      if (vOverlap && cur.x < prev.x + prev.width + SPACING) {
        cur.x = prev.x + prev.width + SPACING;
      }
    }
    return sorted.map(o => ({ id: o.id, changes: { x: o.x, y: o.y } }));
  };

  const handleAlign = (action: AlignAction) => {
    // If exactly one frame is selected, use it as the container — align
    // only the non-frame objects inside the frame's bounds. The frame stays put.
    const frames = selectedObjects.filter(o => o.type === "frame");
    const frame = frames.length === 1 ? frames[0] : null;
    const objs = frame
      ? selectedObjects.filter(o => o.id !== frame.id)
      : selectedObjects;

    if (objs.length === 0) return;

    // Reference bounds: either the frame interior (with padding) or
    // the bounding box of all objects being aligned.
    const refLeft   = frame ? frame.x + FRAME_PAD : Math.min(...objs.map(o => o.x));
    const refRight  = frame ? frame.x + frame.width - FRAME_PAD : Math.max(...objs.map(o => o.x + o.width));
    const refTop    = frame ? frame.y + FRAME_PAD : Math.min(...objs.map(o => o.y));
    const refBottom = frame ? frame.y + frame.height - FRAME_PAD : Math.max(...objs.map(o => o.y + o.height));
    const refCenterX = (refLeft + refRight) / 2;
    const refCenterY = (refTop + refBottom) / 2;

    let updates: Array<{ id: string; changes: Partial<BoardObject> }> = [];

    switch (action) {
      case "left": {
        const items = objs.map(o => ({ id: o.id, x: refLeft, y: o.y, width: o.width, height: o.height }));
        updates = resolveVerticalOverlap(items);
        break;
      }
      case "center-h": {
        const items = objs.map(o => ({ id: o.id, x: refCenterX - o.width / 2, y: o.y, width: o.width, height: o.height }));
        updates = resolveVerticalOverlap(items);
        break;
      }
      case "right": {
        const items = objs.map(o => ({ id: o.id, x: refRight - o.width, y: o.y, width: o.width, height: o.height }));
        updates = resolveVerticalOverlap(items);
        break;
      }
      case "top": {
        const items = objs.map(o => ({ id: o.id, x: o.x, y: refTop, width: o.width, height: o.height }));
        updates = resolveHorizontalOverlap(items);
        break;
      }
      case "center-v": {
        const items = objs.map(o => ({ id: o.id, x: o.x, y: refCenterY - o.height / 2, width: o.width, height: o.height }));
        updates = resolveHorizontalOverlap(items);
        break;
      }
      case "bottom": {
        const items = objs.map(o => ({ id: o.id, x: o.x, y: refBottom - o.height, width: o.width, height: o.height }));
        updates = resolveHorizontalOverlap(items);
        break;
      }
      case "distribute-h": {
        if (objs.length < (frame ? 2 : 3)) return;
        const sorted = [...objs].sort((a, b) => a.x - b.x);
        const totalWidth = sorted.reduce((s, o) => s + o.width, 0);
        const spanLeft = frame ? refLeft : sorted[0].x;
        const spanRight = frame ? refRight : sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
        const totalSpace = spanRight - spanLeft - totalWidth;
        const gap = totalSpace / (frame ? sorted.length + 1 : sorted.length - 1);
        if (frame) {
          // Distribute all objects evenly inside the frame
          let currentX = spanLeft + gap;
          updates = sorted.map(o => {
            const change = { id: o.id, changes: { x: currentX } };
            currentX += o.width + gap;
            return change;
          });
        } else {
          // Keep first and last anchored, distribute middle ones
          let currentX = sorted[0].x + sorted[0].width + gap;
          updates = sorted.slice(1, -1).map(o => {
            const change = { id: o.id, changes: { x: currentX } };
            currentX += o.width + gap;
            return change;
          });
        }
        break;
      }
      case "distribute-v": {
        if (objs.length < (frame ? 2 : 3)) return;
        const sorted = [...objs].sort((a, b) => a.y - b.y);
        const totalHeight = sorted.reduce((s, o) => s + o.height, 0);
        const spanTop = frame ? refTop : sorted[0].y;
        const spanBottom = frame ? refBottom : sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
        const totalSpace = spanBottom - spanTop - totalHeight;
        const gap = totalSpace / (frame ? sorted.length + 1 : sorted.length - 1);
        if (frame) {
          let currentY = spanTop + gap;
          updates = sorted.map(o => {
            const change = { id: o.id, changes: { y: currentY } };
            currentY += o.height + gap;
            return change;
          });
        } else {
          let currentY = sorted[0].y + sorted[0].height + gap;
          updates = sorted.slice(1, -1).map(o => {
            const change = { id: o.id, changes: { y: currentY } };
            currentY += o.height + gap;
            return change;
          });
        }
        break;
      }
    }

    if (updates.length > 0) {
      onBatchUpdate(updates);
    }
  };

  const actions: { id: AlignAction; label: string; icon: React.ReactNode }[] = [
    {
      id: "left", label: "Align Left",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="2" x2="4" y2="22"/><rect x="8" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/></svg>,
    },
    {
      id: "center-h", label: "Align Center",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="2" x2="12" y2="22"/><rect x="6" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/></svg>,
    },
    {
      id: "right", label: "Align Right",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="20" y1="2" x2="20" y2="22"/><rect x="4" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/></svg>,
    },
    {
      id: "top", label: "Align Top",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="4" x2="22" y2="4"/><rect x="6" y="8" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/></svg>,
    },
    {
      id: "center-v", label: "Align Middle",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="12" x2="22" y2="12"/><rect x="6" y="6" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/></svg>,
    },
    {
      id: "bottom", label: "Align Bottom",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="20" x2="22" y2="20"/><rect x="6" y="4" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/></svg>,
    },
    {
      id: "distribute-h", label: "Distribute Horizontally",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="2" x2="4" y2="22"/><line x1="20" y1="2" x2="20" y2="22"/><rect x="9" y="7" width="6" height="10" rx="1"/></svg>,
    },
    {
      id: "distribute-v", label: "Distribute Vertically",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="4" x2="22" y2="4"/><line x1="2" y1="20" x2="22" y2="20"/><rect x="7" y="9" width="10" height="6" rx="1"/></svg>,
    },
  ];

  return (
    <div
      style={{
        position: "absolute",
        left: screenPosition.x,
        top: screenPosition.y - 44,
        display: "flex",
        gap: 2,
        padding: "4px 6px",
        background: "var(--bg-glass)",
        backdropFilter: "blur(var(--blur-lg))",
        WebkitBackdropFilter: "blur(var(--blur-lg))",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-md)",
        zIndex: 1000,
      }}
    >
      {actions.map((action, i) => (
        <span key={action.id} style={{ display: "contents" }}>
          {i === 3 && <div style={{ width: 1, margin: "0 2px", background: "var(--border-subtle)", alignSelf: "stretch" }} />}
          {i === 6 && <div style={{ width: 1, margin: "0 2px", background: "var(--border-subtle)", alignSelf: "stretch" }} />}
          <button
            onClick={() => handleAlign(action.id)}
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-surface-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
            title={action.label}
          >
            {action.icon}
          </button>
        </span>
      ))}
    </div>
  );
}
