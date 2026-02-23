"use client";

import { useState, useRef, useEffect } from "react";
import { Comment } from "@/lib/types";

interface CommentThreadProps {
  comment: Comment;
  screenPosition: { x: number; y: number };
  userId: string;
  userName: string;
  onReply: (commentId: string, text: string) => void;
  onToggleResolved: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onClose: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function CommentThread({
  comment,
  screenPosition,
  userId,
  userName,
  onReply,
  onToggleResolved,
  onDelete,
  onClose,
}: CommentThreadProps) {
  const [replyText, setReplyText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-focus input and scroll to bottom
  useEffect(() => {
    inputRef.current?.focus();
  }, [comment.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comment.messages.length]);

  const handleSubmit = () => {
    const text = replyText.trim();
    if (!text) return;
    onReply(comment.id, text);
    setReplyText("");
  };

  // Clamp position to stay within viewport
  const popoverWidth = 280;
  const popoverMaxHeight = 360;
  let left = screenPosition.x + 20;
  let top = screenPosition.y - 20;
  if (typeof window !== "undefined") {
    if (left + popoverWidth > window.innerWidth - 16) {
      left = screenPosition.x - popoverWidth - 20;
    }
    if (top + popoverMaxHeight > window.innerHeight - 16) {
      top = window.innerHeight - popoverMaxHeight - 16;
    }
    if (top < 60) top = 60;
  }

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: popoverWidth,
        maxHeight: popoverMaxHeight,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-glass)",
        backdropFilter: "blur(var(--blur-lg))",
        WebkitBackdropFilter: "blur(var(--blur-lg))",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-lg)",
        zIndex: 1100,
        overflow: "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          borderBottom: "1px solid var(--border-subtle)",
          gap: 4,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {comment.messages.length === 0
            ? "New comment"
            : `${comment.messages.length} ${comment.messages.length === 1 ? "reply" : "replies"}`}
        </span>
        <div style={{ display: "flex", gap: 2 }}>
          {/* Resolve/Unresolve button */}
          <button
            onClick={() => onToggleResolved(comment.id)}
            style={{
              width: 26,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: comment.resolved
                ? "rgba(34,197,94,0.15)"
                : "transparent",
              color: comment.resolved ? "#22c55e" : "var(--text-tertiary)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = comment.resolved
                ? "rgba(34,197,94,0.25)"
                : "var(--bg-surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = comment.resolved
                ? "rgba(34,197,94,0.15)"
                : "transparent";
            }}
            title={comment.resolved ? "Unresolve" : "Resolve"}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          {/* Delete button */}
          {comment.createdBy === userId && (
            <button
              onClick={() => onDelete(comment.id)}
              style={{
                width: 26,
                height: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                color: "var(--text-tertiary)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--error-muted)";
                e.currentTarget.style.color = "var(--error)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-tertiary)";
              }}
              title="Delete thread"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              width: 26,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              color: "var(--text-tertiary)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-surface-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-tertiary)";
            }}
            title="Close"
          >
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      {comment.messages.length > 0 && (
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "6px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: 220,
          }}
        >
          {comment.messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {msg.userName}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-quaternary)",
                  }}
                >
                  {formatTime(msg.createdAt)}
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.4,
                  color: "var(--text-secondary)",
                  wordBreak: "break-word",
                }}
              >
                {msg.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "8px 10px",
          borderTop:
            comment.messages.length > 0
              ? "1px solid var(--border-subtle)"
              : "none",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
            if (e.key === "Escape") {
              onClose();
            }
            e.stopPropagation();
          }}
          placeholder="Add a comment..."
          style={{
            flex: 1,
            height: 30,
            fontSize: 12,
            padding: "0 8px",
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            outline: "none",
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!replyText.trim()}
          style={{
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: replyText.trim() ? "var(--accent)" : "transparent",
            color: replyText.trim() ? "#ffffff" : "var(--text-quaternary)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: replyText.trim() ? "pointer" : "default",
            transition: "all 0.15s ease",
          }}
          title="Send"
        >
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
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
