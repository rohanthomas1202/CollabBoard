"use client";

import { useRef, useEffect } from "react";
import { CURSOR_CHAT_MAX_LENGTH } from "@/lib/constants";

interface CursorChatProps {
  screenX: number;
  screenY: number;
  color: string;
  onSend: (message: string) => void;
  onCancel: () => void;
}

export default function CursorChat({
  screenX,
  screenY,
  color,
  onSend,
  onCancel,
}: CursorChatProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus the input on mount
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      const value = inputRef.current?.value.trim();
      if (value) {
        onSend(value);
      } else {
        onCancel();
      }
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        left: screenX,
        top: screenY - 36,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        gap: 0,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
          marginRight: 6,
        }}
      />
      <input
        ref={inputRef}
        type="text"
        maxLength={CURSOR_CHAT_MAX_LENGTH}
        placeholder="Say something..."
        onKeyDown={handleKeyDown}
        onBlur={onCancel}
        style={{
          background: "var(--bg-glass)",
          backdropFilter: "blur(var(--blur-md))",
          WebkitBackdropFilter: "blur(var(--blur-md))",
          border: `2px solid ${color}`,
          borderRadius: "var(--radius-md)",
          padding: "4px 10px",
          fontSize: 13,
          color: "var(--text-primary)",
          outline: "none",
          width: 200,
          boxShadow: "var(--shadow-md)",
        }}
      />
    </div>
  );
}
