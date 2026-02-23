"use client";

import { useCallback } from "react";
import Konva from "konva";

/**
 * Temporarily resets the stage transform to 1:1 scale and (0,0) origin,
 * computes the tight bounding box of all board content, renders it with
 * a white background at 2× resolution, then restores the original view.
 */
export function useExport(stageRef: React.RefObject<Konva.Stage | null>) {
  const getContentDataUrl = useCallback((): {
    dataUrl: string;
    width: number;
    height: number;
  } | null => {
    const stage = stageRef.current;
    if (!stage) return null;

    const layer = stage.getLayers()[0];
    if (!layer) return null;

    // Save current viewport transform
    const prevScale = { x: stage.scaleX(), y: stage.scaleY() };
    const prevPos = { x: stage.x(), y: stage.y() };

    // Reset to 1:1 so bounding rects are in world coordinates
    stage.scaleX(1);
    stage.scaleY(1);
    stage.x(0);
    stage.y(0);
    stage.batchDraw();

    // Get bounding box of all visible content (skip Transformer)
    const children = layer.getChildren(
      (node) => node.getClassName() !== "Transformer"
    );
    if (children.length === 0) {
      // Restore and bail
      stage.scaleX(prevScale.x);
      stage.scaleY(prevScale.y);
      stage.x(prevPos.x);
      stage.y(prevPos.y);
      stage.batchDraw();
      return null;
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    children.forEach((node) => {
      const rect = node.getClientRect({ relativeTo: stage });
      if (rect.width === 0 && rect.height === 0) return;
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    });

    if (!isFinite(minX)) {
      stage.scaleX(prevScale.x);
      stage.scaleY(prevScale.y);
      stage.x(prevPos.x);
      stage.y(prevPos.y);
      stage.batchDraw();
      return null;
    }

    // Tight padding — just enough for a clean edge
    const pad = 24;
    const cropX = minX - pad;
    const cropY = minY - pad;
    const cropW = maxX - minX + pad * 2;
    const cropH = maxY - minY + pad * 2;

    // Cap pixel ratio so the output canvas stays within browser limits
    // Most browsers cap at ~16384px per side or ~268M total pixels
    const MAX_PIXELS = 16_000_000; // safe ceiling
    let pixelRatio = 2;
    if (cropW * pixelRatio * cropH * pixelRatio > MAX_PIXELS) {
      pixelRatio = Math.max(1, Math.sqrt(MAX_PIXELS / (cropW * cropH)));
    }

    // Inject temporary white background
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

    let dataUrl: string;
    try {
      dataUrl = stage.toDataURL({
        x: cropX,
        y: cropY,
        width: cropW,
        height: cropH,
        pixelRatio,
        mimeType: "image/png",
      });
    } catch {
      bgRect.destroy();
      stage.scaleX(prevScale.x);
      stage.scaleY(prevScale.y);
      stage.x(prevPos.x);
      stage.y(prevPos.y);
      stage.batchDraw();
      return null;
    }

    // Clean up: remove temp rect and restore viewport
    bgRect.destroy();
    stage.scaleX(prevScale.x);
    stage.scaleY(prevScale.y);
    stage.x(prevPos.x);
    stage.y(prevPos.y);
    stage.batchDraw();

    // Validate — a corrupt/empty toDataURL won't start with the PNG data URI
    if (!dataUrl || !dataUrl.startsWith("data:image/png")) {
      return null;
    }

    return { dataUrl, width: cropW * pixelRatio, height: cropH * pixelRatio };
  }, [stageRef]);

  const exportPNG = useCallback(
    (filename = "board-export.png") => {
      const result = getContentDataUrl();
      if (!result) return;

      const link = document.createElement("a");
      link.download = filename;
      link.href = result.dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [getContentDataUrl]
  );

  const exportPDF = useCallback(
    async (filename = "board-export.pdf") => {
      const result = getContentDataUrl();
      if (!result) return;

      const { jsPDF } = await import("jspdf");

      const { width, height } = result;
      // Use landscape or portrait based on content aspect ratio
      const orientation = width > height ? "landscape" : "portrait";
      const pdf = new jsPDF({
        orientation,
        unit: "px",
        format: [width, height],
      });

      pdf.addImage(result.dataUrl, "PNG", 0, 0, width, height);
      pdf.save(filename);
    },
    [getContentDataUrl]
  );

  return { exportPNG, exportPDF };
}
