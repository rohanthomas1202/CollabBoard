"use client";

import { useRef, useEffect } from "react";
import { BoardObject } from "@/lib/types";

interface PresentationNavProps {
  frames: BoardObject[];
  currentIndex: number;
  onGoTo: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
}

export default function PresentationNav({
  frames,
  currentIndex,
  onGoTo,
  onPrev,
  onNext,
  onExit,
}: PresentationNavProps) {
  const pillsRef = useRef<HTMLDivElement>(null);
  const activePillRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll active pill into view
  useEffect(() => {
    if (activePillRef.current && pillsRef.current) {
      activePillRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentIndex]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        zIndex: 60,
        background: "var(--bg-glass)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid var(--border-subtle)",
        padding: "0 16px",
      }}
    >
      {/* Prev button */}
      <button
        onClick={onPrev}
        disabled={currentIndex === 0}
        style={{
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          color: currentIndex === 0 ? "var(--text-quaternary)" : "var(--text-secondary)",
          cursor: currentIndex === 0 ? "default" : "pointer",
          opacity: currentIndex === 0 ? 0.4 : 1,
          transition: "all 0.15s ease",
          flexShrink: 0,
        }}
        title="Previous frame (Left arrow)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Frame pills */}
      <div
        ref={pillsRef}
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          maxWidth: "calc(100vw - 220px)",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {frames.map((frame, i) => {
          const isActive = i === currentIndex;
          return (
            <button
              key={frame.id}
              ref={isActive ? activePillRef : undefined}
              onClick={() => onGoTo(i)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "none",
                background: isActive ? "var(--accent)" : "var(--bg-surface)",
                color: isActive ? "#ffffff" : "var(--text-secondary)",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.2s ease",
                boxShadow: isActive ? "var(--shadow-glow)" : "none",
              }}
              title={frame.text || `Frame ${i + 1}`}
            >
              {frame.text || `Frame ${i + 1}`}
            </button>
          );
        })}
      </div>

      {/* Next button */}
      <button
        onClick={onNext}
        disabled={currentIndex === frames.length - 1}
        style={{
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          color: currentIndex === frames.length - 1 ? "var(--text-quaternary)" : "var(--text-secondary)",
          cursor: currentIndex === frames.length - 1 ? "default" : "pointer",
          opacity: currentIndex === frames.length - 1 ? 0.4 : 1,
          transition: "all 0.15s ease",
          flexShrink: 0,
        }}
        title="Next frame (Right arrow)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Counter */}
      <div
        style={{
          fontSize: 12,
          color: "var(--text-quaternary)",
          fontWeight: 500,
          minWidth: 40,
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {currentIndex + 1}/{frames.length}
      </div>

      {/* Exit button */}
      <button
        onClick={onExit}
        style={{
          padding: "6px 14px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
          background: "transparent",
          color: "var(--text-secondary)",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          transition: "all 0.15s ease",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-surface-hover)";
          e.currentTarget.style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--text-secondary)";
        }}
        title="Exit presentation (Esc)"
      >
        Exit
      </button>
    </div>
  );
}
