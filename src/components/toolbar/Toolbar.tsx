"use client";

import React from "react";
import { Tool } from "@/lib/types";

interface ToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onDeleteSelected?: () => void;
  hasSelection?: boolean;
  votingEnabled?: boolean;
  votesRemaining?: number;
  votesPerUser?: number;
  onToggleVoting?: () => void;
  onSetVotesPerUser?: (n: number) => void;
  freehandStrokeWidth?: number;
  onSetFreehandStrokeWidth?: (w: number) => void;
  hidden?: boolean;
  snapEnabled?: boolean;
  gridEnabled?: boolean;
  onToggleSnap?: () => void;
  onToggleGrid?: () => void;
}

const toolGroups: { id: Tool; label: string; icon: React.ReactNode }[][] = [
  [
    {
      id: "select",
      label: "Select (V)",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        </svg>
      ),
    },
    {
      id: "pan",
      label: "Pan (H)",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 11V6a2 2 0 00-4 0v5M14 10V4a2 2 0 00-4 0v6M10 10.5V6a2 2 0 00-4 0v8" />
          <path d="M18 11a2 2 0 014 0v3a8 8 0 01-8 8h-2c-2.8 0-4.5-.9-5.9-2.6L3.7 16c-.7-.8-.7-2 .1-2.7a1.9 1.9 0 012.7.1L8 15" />
        </svg>
      ),
    },
  ],
  [
    {
      id: "sticky-note",
      label: "Sticky Note (N)",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15.5 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.5L15.5 3z" />
          <polyline points="14,3 14,9 21,9" />
        </svg>
      ),
    },
    {
      id: "rectangle",
      label: "Rectangle (R)",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      ),
    },
    {
      id: "circle",
      label: "Circle (O)",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
        </svg>
      ),
    },
  ],
  [
    {
      id: "line",
      label: "Line (L)",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="19" x2="19" y2="5" />
        </svg>
      ),
    },
    {
      id: "freehand",
      label: "Draw (D)",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      ),
    },
    {
      id: "connector",
      label: "Connector (C)",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="19" r="3" />
          <circle cx="19" cy="5" r="3" />
          <line x1="7.5" y1="16.5" x2="16.5" y2="7.5" />
        </svg>
      ),
    },
  ],
  [
    {
      id: "text",
      label: "Text (T)",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4,7 4,4 20,4 20,7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      ),
    },
    {
      id: "comment",
      label: "Comment (M)",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
  ],
];

export default function Toolbar({ activeTool, onToolChange, onUndo, onRedo, canUndo, canRedo, onDeleteSelected, hasSelection, votingEnabled, votesRemaining, votesPerUser, onToggleVoting, onSetVotesPerUser, freehandStrokeWidth = 3, onSetFreehandStrokeWidth, hidden = false, snapEnabled, gridEnabled, onToggleSnap, onToggleGrid }: ToolbarProps) {
  if (hidden) return null;
  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 px-2 py-2 flex items-center gap-0.5 z-50"
      style={{
        background: "var(--bg-glass)",
        backdropFilter: "blur(var(--blur-lg))",
        WebkitBackdropFilter: "blur(var(--blur-lg))",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-lg)",
        borderRadius: "var(--radius-xl)",
      }}
    >
      {toolGroups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && (
            <div className="w-px mx-1" style={{ height: 20, background: "var(--border-subtle)" }} />
          )}
          {group.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className="flex items-center justify-center w-10 h-10 cursor-pointer"
              style={{
                background: activeTool === tool.id ? "var(--accent)" : "transparent",
                color: activeTool === tool.id ? "#ffffff" : "var(--text-secondary)",
                boxShadow: activeTool === tool.id ? "var(--shadow-glow)" : "none",
                borderRadius: "var(--radius-md)",
                border: "none",
                transition: "all var(--duration-fast) var(--ease-out)",
              }}
              onMouseEnter={(e) => {
                if (activeTool !== tool.id) {
                  e.currentTarget.style.background = "var(--bg-surface-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTool !== tool.id) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
        </div>
      ))}
      {/* Freehand stroke width picker */}
      {activeTool === "freehand" && onSetFreehandStrokeWidth && (
        <div className="flex items-center gap-0.5">
          <div className="w-px mx-1" style={{ height: 20, background: "var(--border-subtle)" }} />
          {([
            { w: 2, label: "Thin" },
            { w: 3, label: "Medium" },
            { w: 6, label: "Thick" },
          ] as const).map(({ w, label }) => (
            <button
              key={w}
              onClick={() => onSetFreehandStrokeWidth(w)}
              className="flex items-center justify-center h-10 px-1.5 cursor-pointer"
              style={{
                background: freehandStrokeWidth === w ? "var(--accent-muted, rgba(99,102,241,0.15))" : "transparent",
                color: freehandStrokeWidth === w ? "var(--accent)" : "var(--text-quaternary)",
                borderRadius: "var(--radius-sm)",
                border: "none",
                transition: "all var(--duration-fast) var(--ease-out)",
                minWidth: 28,
              }}
              onMouseEnter={(e) => {
                if (freehandStrokeWidth !== w) {
                  e.currentTarget.style.background = "var(--bg-surface-hover)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
              onMouseLeave={(e) => {
                if (freehandStrokeWidth !== w) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-quaternary)";
                }
              }}
              title={`${label} (${w}px)`}
            >
              <div
                style={{
                  width: 16,
                  height: w,
                  background: freehandStrokeWidth === w ? "var(--accent)" : "var(--text-quaternary)",
                  borderRadius: w,
                }}
              />
            </button>
          ))}
        </div>
      )}
      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <div className="w-px mx-1" style={{ height: 20, background: "var(--border-subtle)" }} />
        <button
          onClick={() => canUndo && onUndo?.()}
          className="flex items-center justify-center w-10 h-10"
          style={{
            background: "transparent",
            color: canUndo ? "var(--text-secondary)" : "var(--text-quaternary)",
            opacity: canUndo ? 1 : 0.4,
            borderRadius: "var(--radius-md)",
            border: "none",
            cursor: canUndo ? "pointer" : "default",
            transition: "all var(--duration-fast) var(--ease-out)",
          }}
          onMouseEnter={(e) => {
            if (canUndo) {
              e.currentTarget.style.background = "var(--bg-surface-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = canUndo ? "var(--text-secondary)" : "var(--text-quaternary)";
          }}
          title="Undo (Cmd+Z)"
          disabled={!canUndo}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
        <button
          onClick={() => canRedo && onRedo?.()}
          className="flex items-center justify-center w-10 h-10"
          style={{
            background: "transparent",
            color: canRedo ? "var(--text-secondary)" : "var(--text-quaternary)",
            opacity: canRedo ? 1 : 0.4,
            borderRadius: "var(--radius-md)",
            border: "none",
            cursor: canRedo ? "pointer" : "default",
            transition: "all var(--duration-fast) var(--ease-out)",
          }}
          onMouseEnter={(e) => {
            if (canRedo) {
              e.currentTarget.style.background = "var(--bg-surface-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = canRedo ? "var(--text-secondary)" : "var(--text-quaternary)";
          }}
          title="Redo (Cmd+Shift+Z)"
          disabled={!canRedo}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
          </svg>
        </button>
      </div>

      {/* Delete button */}
      <div className="flex items-center gap-0.5">
        <div className="w-px mx-1" style={{ height: 20, background: "var(--border-subtle)" }} />
        <button
          onClick={() => onDeleteSelected?.()}
          className="flex items-center justify-center w-10 h-10 cursor-pointer"
          style={{
            background: "transparent",
            color: hasSelection ? "var(--error)" : "var(--text-quaternary)",
            opacity: hasSelection ? 1 : 0.5,
            borderRadius: "var(--radius-md)",
            border: "none",
            transition: "all var(--duration-fast) var(--ease-out)",
          }}
          onMouseEnter={(e) => {
            if (hasSelection) {
              e.currentTarget.style.background = "var(--error-muted)";
              e.currentTarget.style.color = "var(--error)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = hasSelection ? "var(--error)" : "var(--text-quaternary)";
          }}
          title="Delete selected (Del)"
          disabled={!hasSelection}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      {/* Snap & Grid toggles */}
      {onToggleSnap && onToggleGrid && (
        <div className="flex items-center gap-0.5">
          <div className="w-px mx-1" style={{ height: 20, background: "var(--border-subtle)" }} />
          <button
            onClick={onToggleSnap}
            className="flex items-center justify-center w-10 h-10 cursor-pointer"
            style={{
              background: snapEnabled ? "var(--accent-muted, rgba(99,102,241,0.15))" : "transparent",
              color: snapEnabled ? "var(--accent)" : "var(--text-tertiary)",
              borderRadius: "var(--radius-md)",
              border: "none",
              transition: "all var(--duration-fast) var(--ease-out)",
            }}
            onMouseEnter={(e) => {
              if (!snapEnabled) {
                e.currentTarget.style.background = "var(--bg-surface-hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!snapEnabled) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-tertiary)";
              }
            }}
            title={snapEnabled ? "Snap ON" : "Snap OFF"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 3L3 21" /><path d="M21 3v7" /><path d="M21 3h-7" />
              <path d="M3 21v-7" /><path d="M3 21h7" />
            </svg>
          </button>
          <button
            onClick={onToggleGrid}
            className="flex items-center justify-center w-10 h-10 cursor-pointer"
            style={{
              background: gridEnabled ? "var(--accent-muted, rgba(99,102,241,0.15))" : "transparent",
              color: gridEnabled ? "var(--accent)" : "var(--text-tertiary)",
              borderRadius: "var(--radius-md)",
              border: "none",
              transition: "all var(--duration-fast) var(--ease-out)",
            }}
            onMouseEnter={(e) => {
              if (!gridEnabled) {
                e.currentTarget.style.background = "var(--bg-surface-hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!gridEnabled) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-tertiary)";
              }
            }}
            title={gridEnabled ? "Grid ON" : "Grid OFF"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
        </div>
      )}

      {/* Voting toggle */}
      {onToggleVoting && (
        <div className="flex items-center gap-0.5">
          <div className="w-px mx-1" style={{ height: 20, background: "var(--border-subtle)" }} />
          <button
            onClick={onToggleVoting}
            className="flex items-center justify-center gap-1 h-10 px-2 cursor-pointer"
            style={{
              background: votingEnabled ? "var(--accent)" : "transparent",
              color: votingEnabled ? "#ffffff" : "var(--text-secondary)",
              boxShadow: votingEnabled ? "var(--shadow-glow)" : "none",
              borderRadius: "var(--radius-md)",
              border: "none",
              transition: "all var(--duration-fast) var(--ease-out)",
              fontSize: 13,
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              if (!votingEnabled) {
                e.currentTarget.style.background = "var(--bg-surface-hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!votingEnabled) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
            title={votingEnabled ? `Voting ON (${votesRemaining} left)` : "Enable dot voting"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {votingEnabled && (
              <span style={{ fontSize: 11, opacity: 0.9 }}>{votesRemaining}</span>
            )}
          </button>
          {/* Vote count selector */}
          {votingEnabled && onSetVotesPerUser && (
            <div className="flex items-center gap-0.5 ml-0.5">
              {[3, 5, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => onSetVotesPerUser(n)}
                  className="flex items-center justify-center h-7 px-1.5 cursor-pointer"
                  style={{
                    background: votesPerUser === n ? "var(--accent-muted, rgba(99,102,241,0.15))" : "transparent",
                    color: votesPerUser === n ? "var(--accent)" : "var(--text-quaternary)",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    fontSize: 11,
                    fontWeight: 600,
                    transition: "all var(--duration-fast) var(--ease-out)",
                    minWidth: 24,
                  }}
                  onMouseEnter={(e) => {
                    if (votesPerUser !== n) {
                      e.currentTarget.style.background = "var(--bg-surface-hover)";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (votesPerUser !== n) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--text-quaternary)";
                    }
                  }}
                  title={`${n} votes per user`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
