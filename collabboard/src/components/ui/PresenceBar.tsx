"use client";

import { CursorData } from "@/lib/types";

interface PresenceBarProps {
  cursors: Record<string, CursorData>;
  userName: string;
  myColor: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function PresenceBar({ cursors, userName, myColor }: PresenceBarProps) {
  const onlineUsers = Object.entries(cursors);

  return (
    <div className="flex items-center gap-1">
      {/* Other users (stacked) */}
      <div className="flex items-center" style={{ direction: "rtl" }}>
        {onlineUsers.map(([uid, cursor], i) => (
          <div
            key={uid}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white relative group"
            style={{
              backgroundColor: cursor.color,
              marginRight: i > 0 ? "-6px" : "0",
              border: "2px solid var(--bg-primary)",
              zIndex: onlineUsers.length - i,
            }}
            title={cursor.name}
          >
            {getInitials(cursor.name)}
            {/* Tooltip */}
            <div
              className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
                boxShadow: "var(--shadow-md)",
                transition: "opacity var(--duration-fast) var(--ease-out)",
              }}
            >
              {cursor.name}
            </div>
          </div>
        ))}
      </div>

      {/* Current user */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white relative group"
        style={{ backgroundColor: myColor, border: "2px solid var(--bg-primary)" }}
        title={`${userName} (you)`}
      >
        {getInitials(userName)}
        <div
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--shadow-md)",
            transition: "opacity var(--duration-fast) var(--ease-out)",
          }}
        >
          {userName} (you)
        </div>
      </div>

      {onlineUsers.length === 0 && (
        <span className="text-xs ml-1" style={{ color: "var(--text-tertiary)" }}>Just you</span>
      )}
    </div>
  );
}
