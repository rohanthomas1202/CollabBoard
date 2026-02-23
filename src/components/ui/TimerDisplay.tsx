"use client";

import React from "react";
import { TIMER_PRESETS } from "@/hooks/useTimer";

interface TimerDisplayProps {
  status: "idle" | "running" | "paused";
  displayMs: number;
  finished: boolean;
  onStart: (durationMs?: number) => void;
  onResume: () => void;
  onPause: () => void;
  onReset: () => void;
}

function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function presetLabel(ms: number): string {
  const min = ms / 60_000;
  return `${min}m`;
}

export default function TimerDisplay({
  status,
  displayMs,
  finished,
  onStart,
  onResume,
  onPause,
  onReset,
}: TimerDisplayProps) {
  const [showPresets, setShowPresets] = React.useState(false);

  return (
    <div
      className="flex items-center gap-2"
      style={{ position: "relative" }}
    >
      {/* Time display */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 text-sm font-mono"
        style={{
          color: finished
            ? "var(--error)"
            : status === "running"
            ? "var(--accent)"
            : "var(--text-secondary)",
          fontWeight: 600,
          animation: finished ? "pulse 1s infinite" : "none",
        }}
      >
        {/* Timer icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {formatTime(displayMs)}
      </div>

      {/* Controls */}
      {status === "idle" && (
        <>
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="text-xs px-2 py-1 cursor-pointer"
            style={{
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontWeight: 500,
            }}
          >
            Start
          </button>
          {showPresets && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 4,
                display: "flex",
                gap: 4,
                background: "var(--bg-glass)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "6px 8px",
                boxShadow: "var(--shadow-lg)",
                zIndex: 100,
              }}
            >
              {TIMER_PRESETS.map((ms) => (
                <button
                  key={ms}
                  onClick={() => {
                    onStart(ms);
                    setShowPresets(false);
                  }}
                  className="text-xs px-2 py-1 cursor-pointer"
                  style={{
                    background: "transparent",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-surface-hover)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                >
                  {presetLabel(ms)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {status === "running" && (
        <button
          onClick={onPause}
          className="text-xs px-2 py-1 cursor-pointer"
          style={{
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-surface-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          Pause
        </button>
      )}

      {status === "paused" && (
        <div className="flex items-center gap-1">
          <button
            onClick={onResume}
            className="text-xs px-2 py-1 cursor-pointer"
            style={{
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontWeight: 500,
            }}
          >
            Resume
          </button>
          <button
            onClick={onReset}
            className="text-xs px-2 py-1 cursor-pointer"
            style={{
              background: "transparent",
              color: "var(--text-tertiary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Reset
          </button>
        </div>
      )}

      {/* Finished: show reset */}
      {finished && status === "running" && (
        <button
          onClick={onReset}
          className="text-xs px-2 py-1 cursor-pointer"
          style={{
            background: "var(--error)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-sm)",
            fontWeight: 500,
          }}
        >
          Reset
        </button>
      )}
    </div>
  );
}
