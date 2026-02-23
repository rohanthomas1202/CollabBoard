"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Konva from "konva";
import { BoardObject } from "@/lib/types";

interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PresentationState {
  isPresenting: boolean;
  currentIndex: number;
  sortedFrames: BoardObject[];
  screenRect: ScreenRect;
  enter: () => void;
  exit: () => void;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
}

const TWEEN_DURATION = 0.35; // seconds
const FRAME_PADDING = 80; // px padding around frame when zooming
const MAX_PRESENT_SCALE = 2;
const SAME_ROW_THRESHOLD = 200; // frames within this Y distance are "same row"

function sortFrames(frames: BoardObject[]): BoardObject[] {
  return [...frames].sort((a, b) => {
    // Group by row (Y within threshold)
    const rowDiff = Math.abs(a.y - b.y);
    if (rowDiff > SAME_ROW_THRESHOLD) {
      return a.y - b.y;
    }
    // Same row: sort left to right
    return a.x - b.x;
  });
}

export function usePresentationMode(
  stageRef: React.RefObject<Konva.Stage | null>,
  objects: BoardObject[],
  stageSize: { width: number; height: number }
): PresentationState {
  const [isPresenting, setIsPresenting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sortedFrames, setSortedFrames] = useState<BoardObject[]>([]);
  const [screenRect, setScreenRect] = useState<ScreenRect>({ x: 0, y: 0, width: 0, height: 0 });
  const savedTransform = useRef<{ x: number; y: number; scaleX: number; scaleY: number } | null>(null);
  const tweenRef = useRef<Konva.Tween | null>(null);

  // Compute target transform to fit a frame with padding
  const getFrameTransform = useCallback(
    (frame: BoardObject) => {
      const padW = frame.width + FRAME_PADDING * 2;
      const padH = frame.height + FRAME_PADDING * 2;
      const scaleX = stageSize.width / padW;
      const scaleY = stageSize.height / padH;
      const newScale = Math.min(scaleX, scaleY, MAX_PRESENT_SCALE);

      // Center the frame in the viewport
      const cx = frame.x + frame.width / 2;
      const cy = frame.y + frame.height / 2;
      const x = stageSize.width / 2 - cx * newScale;
      const y = stageSize.height / 2 - cy * newScale;

      return { x, y, scaleX: newScale, scaleY: newScale };
    },
    [stageSize]
  );

  // Compute where a frame will appear on screen given a target stage transform
  const computeScreenRect = useCallback(
    (frame: BoardObject, target: { x: number; y: number; scaleX: number; scaleY: number }): ScreenRect => {
      return {
        x: frame.x * target.scaleX + target.x,
        y: frame.y * target.scaleY + target.y,
        width: frame.width * target.scaleX,
        height: frame.height * target.scaleY,
      };
    },
    []
  );

  // Animate stage to a target transform
  const animateTo = useCallback(
    (target: { x: number; y: number; scaleX: number; scaleY: number }, onFinish?: () => void) => {
      const stage = stageRef.current;
      if (!stage) return;

      // Kill any running tween
      if (tweenRef.current) {
        tweenRef.current.destroy();
        tweenRef.current = null;
      }

      tweenRef.current = new Konva.Tween({
        node: stage,
        duration: TWEEN_DURATION,
        easing: Konva.Easings.EaseInOut,
        x: target.x,
        y: target.y,
        scaleX: target.scaleX,
        scaleY: target.scaleY,
        onFinish: () => {
          tweenRef.current = null;
          onFinish?.();
        },
      });
      tweenRef.current.play();
    },
    [stageRef]
  );

  const enter = useCallback(() => {
    const frames = objects.filter((o) => o.type === "frame");
    if (frames.length === 0) return;

    const stage = stageRef.current;
    if (!stage) return;

    // Save current viewport
    savedTransform.current = {
      x: stage.x(),
      y: stage.y(),
      scaleX: stage.scaleX(),
      scaleY: stage.scaleY(),
    };

    const sorted = sortFrames(frames);
    setSortedFrames(sorted);
    setCurrentIndex(0);
    setIsPresenting(true);

    // Compute target and screen rect for first frame
    const target = getFrameTransform(sorted[0]);
    setScreenRect(computeScreenRect(sorted[0], target));
    animateTo(target);
  }, [objects, stageRef, getFrameTransform, computeScreenRect, animateTo]);

  const exit = useCallback(() => {
    if (savedTransform.current) {
      animateTo(savedTransform.current, () => {
        savedTransform.current = null;
      });
    }
    setIsPresenting(false);
    setCurrentIndex(0);
    setSortedFrames([]);
    setScreenRect({ x: 0, y: 0, width: 0, height: 0 });
  }, [animateTo]);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= sortedFrames.length) return;
      setCurrentIndex(index);
      const frame = sortedFrames[index];
      const target = getFrameTransform(frame);
      setScreenRect(computeScreenRect(frame, target));
      animateTo(target);
    },
    [sortedFrames, getFrameTransform, computeScreenRect, animateTo]
  );

  const next = useCallback(() => {
    if (currentIndex < sortedFrames.length - 1) {
      goTo(currentIndex + 1);
    }
  }, [currentIndex, sortedFrames.length, goTo]);

  const prev = useCallback(() => {
    if (currentIndex > 0) {
      goTo(currentIndex - 1);
    }
  }, [currentIndex, goTo]);

  // Keyboard navigation (capture phase to intercept before Board.tsx)
  useEffect(() => {
    if (!isPresenting) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.stopPropagation();
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.stopPropagation();
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        exit();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true); // capture phase
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isPresenting, next, prev, exit]);

  return {
    isPresenting,
    currentIndex,
    sortedFrames,
    screenRect,
    enter,
    exit,
    goTo,
    next,
    prev,
  };
}
