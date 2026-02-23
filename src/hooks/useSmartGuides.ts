import { BoardObject } from "@/lib/types";
import { SNAP_THRESHOLD, DEFAULT_GRID_SIZE, GUIDE_COLOR_EDGE, GUIDE_COLOR_CENTER } from "@/lib/constants";

export interface Guide {
  orientation: "vertical" | "horizontal";
  position: number; // world-space x for vertical, y for horizontal
  color: string;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: Guide[];
}

/**
 * Compute snap offsets and guides for a dragged object against other objects.
 * Checks 5 vertical alignments (left-left, right-right, left-right, right-left, center-center)
 * and 5 horizontal alignments (top-top, bottom-bottom, top-bottom, bottom-top, center-center).
 */
export function computeSnapResult(
  dragging: { x: number; y: number; width: number; height: number },
  others: BoardObject[],
  threshold: number = SNAP_THRESHOLD,
  gridSize?: number
): SnapResult {
  let snapX = dragging.x;
  let snapY = dragging.y;
  const guides: Guide[] = [];

  let bestDx = Infinity;
  let bestDy = Infinity;

  const dLeft = dragging.x;
  const dRight = dragging.x + dragging.width;
  const dCenterX = dragging.x + dragging.width / 2;
  const dTop = dragging.y;
  const dBottom = dragging.y + dragging.height;
  const dCenterY = dragging.y + dragging.height / 2;

  for (const other of others) {
    if (other.type === "connector" || other.type === "freehand") continue;

    const oLeft = other.x;
    const oRight = other.x + other.width;
    const oCenterX = other.x + other.width / 2;
    const oTop = other.y;
    const oBottom = other.y + other.height;
    const oCenterY = other.y + other.height / 2;

    // Vertical alignments (snap X)
    const vChecks = [
      { d: dLeft, o: oLeft, type: "edge" as const },      // left ↔ left
      { d: dRight, o: oRight, type: "edge" as const },     // right ↔ right
      { d: dLeft, o: oRight, type: "edge" as const },      // left ↔ right
      { d: dRight, o: oLeft, type: "edge" as const },      // right ↔ left
      { d: dCenterX, o: oCenterX, type: "center" as const }, // center ↔ center
    ];

    for (const check of vChecks) {
      const diff = Math.abs(check.d - check.o);
      if (diff < threshold && diff < bestDx) {
        bestDx = diff;
        snapX = dragging.x + (check.o - check.d);
      }
    }

    // Horizontal alignments (snap Y)
    const hChecks = [
      { d: dTop, o: oTop, type: "edge" as const },         // top ↔ top
      { d: dBottom, o: oBottom, type: "edge" as const },    // bottom ↔ bottom
      { d: dTop, o: oBottom, type: "edge" as const },       // top ↔ bottom
      { d: dBottom, o: oTop, type: "edge" as const },       // bottom ↔ top
      { d: dCenterY, o: oCenterY, type: "center" as const }, // center ↔ center
    ];

    for (const check of hChecks) {
      const diff = Math.abs(check.d - check.o);
      if (diff < threshold && diff < bestDy) {
        bestDy = diff;
        snapY = dragging.y + (check.o - check.d);
      }
    }
  }

  // Grid snapping (applied if no object snap was found)
  if (gridSize && gridSize > 0) {
    if (!isFinite(bestDx) || bestDx >= threshold) {
      snapX = Math.round(dragging.x / gridSize) * gridSize;
    }
    if (!isFinite(bestDy) || bestDy >= threshold) {
      snapY = Math.round(dragging.y / gridSize) * gridSize;
    }
  }

  // Build guide lines for the final snapped position
  const finalLeft = snapX;
  const finalRight = snapX + dragging.width;
  const finalCenterX = snapX + dragging.width / 2;
  const finalTop = snapY;
  const finalBottom = snapY + dragging.height;
  const finalCenterY = snapY + dragging.height / 2;

  for (const other of others) {
    if (other.type === "connector" || other.type === "freehand") continue;

    const oLeft = other.x;
    const oRight = other.x + other.width;
    const oCenterX = other.x + other.width / 2;
    const oTop = other.y;
    const oBottom = other.y + other.height;
    const oCenterY = other.y + other.height / 2;

    // Vertical guides
    const eps = 0.5;
    if (Math.abs(finalLeft - oLeft) < eps || Math.abs(finalRight - oRight) < eps ||
        Math.abs(finalLeft - oRight) < eps || Math.abs(finalRight - oLeft) < eps) {
      const matchX = Math.abs(finalLeft - oLeft) < eps ? oLeft :
                     Math.abs(finalRight - oRight) < eps ? oRight :
                     Math.abs(finalLeft - oRight) < eps ? oRight : oLeft;
      if (!guides.some(g => g.orientation === "vertical" && Math.abs(g.position - matchX) < eps)) {
        guides.push({ orientation: "vertical", position: matchX, color: GUIDE_COLOR_EDGE });
      }
    }
    if (Math.abs(finalCenterX - oCenterX) < eps) {
      if (!guides.some(g => g.orientation === "vertical" && Math.abs(g.position - oCenterX) < eps)) {
        guides.push({ orientation: "vertical", position: oCenterX, color: GUIDE_COLOR_CENTER });
      }
    }

    // Horizontal guides
    if (Math.abs(finalTop - oTop) < eps || Math.abs(finalBottom - oBottom) < eps ||
        Math.abs(finalTop - oBottom) < eps || Math.abs(finalBottom - oTop) < eps) {
      const matchY = Math.abs(finalTop - oTop) < eps ? oTop :
                     Math.abs(finalBottom - oBottom) < eps ? oBottom :
                     Math.abs(finalTop - oBottom) < eps ? oBottom : oTop;
      if (!guides.some(g => g.orientation === "horizontal" && Math.abs(g.position - matchY) < eps)) {
        guides.push({ orientation: "horizontal", position: matchY, color: GUIDE_COLOR_EDGE });
      }
    }
    if (Math.abs(finalCenterY - oCenterY) < eps) {
      if (!guides.some(g => g.orientation === "horizontal" && Math.abs(g.position - oCenterY) < eps)) {
        guides.push({ orientation: "horizontal", position: oCenterY, color: GUIDE_COLOR_CENTER });
      }
    }
  }

  return { x: snapX, y: snapY, guides };
}
