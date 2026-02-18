"use client";

import { CursorData } from "@/lib/types";

interface PresenceBarProps {
  cursors: Record<string, CursorData>;
  userName: string;
  myColor: string;
}

export default function PresenceBar({ cursors, userName, myColor }: PresenceBarProps) {
  const onlineUsers = Object.entries(cursors);

  return (
    <div className="flex items-center gap-2">
      {/* Current user */}
      <div
        className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white"
        style={{ backgroundColor: myColor }}
      >
        {userName} (you)
      </div>

      {/* Other users */}
      {onlineUsers.map(([uid, cursor]) => (
        <div
          key={uid}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: cursor.color }}
        >
          {cursor.name}
        </div>
      ))}

      {onlineUsers.length === 0 && (
        <span className="text-xs text-gray-400">Only you on this board</span>
      )}
    </div>
  );
}
