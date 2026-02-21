"use client";

import React from "react";
import { Tool } from "@/lib/types";

interface ToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDeleteSelected?: () => void;
  hasSelection?: boolean;
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
  ],
];

export default function Toolbar({ activeTool, onToolChange, onDeleteSelected, hasSelection }: ToolbarProps) {
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
    </div>
  );
}
