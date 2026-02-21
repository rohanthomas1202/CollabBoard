"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useBoard } from "@/hooks/useBoard";
import { usePresence } from "@/hooks/usePresence";
import { useTheme } from "@/hooks/useTheme";
import AuthGuard from "@/components/ui/AuthGuard";
import Toolbar from "@/components/toolbar/Toolbar";
import PresenceBar from "@/components/ui/PresenceBar";
import AIChatPanel from "@/components/ui/AIChatPanel";
import { Tool } from "@/lib/types";

const BoardCanvas = dynamic(() => import("@/components/canvas/Board"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent", animation: "spin 1s linear infinite" }}
        />
        <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading board...</span>
      </div>
    </div>
  ),
});

function BoardPageInner() {
  const params = useParams();
  const router = useRouter();
  const boardId = params.id as string;
  const { user, logout } = useAuth();
  const { objects, loading, addObject, updateObject, deleteObject } = useBoard(boardId);
  const { cursors, updateCursor, myColor } = usePresence(
    boardId,
    user?.uid || "",
    user?.displayName || user?.email || "Anonymous"
  );
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [boardName, setBoardName] = useState("Untitled Board");
  const { isDark: isDarkMode, toggleTheme } = useTheme();
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const lastThumbnailSave = useRef<number>(0);

  const handleThumbnailCapture = useCallback(
    (dataUrl: string, force?: boolean) => {
      if (!boardId) return;
      const now = Date.now();
      if (!force && now - lastThumbnailSave.current < 25000) return;
      lastThumbnailSave.current = now;
      updateDoc(doc(db, "boards", boardId), { thumbnail: dataUrl }).catch(() => {});
    },
    [boardId]
  );

  useEffect(() => {
    if (!boardId) return;
    const unsubscribe = onSnapshot(doc(db, "boards", boardId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBoardName(data.name || "Untitled Board");
        if (user && data.ownerId !== user.uid) {
          const shared = data.sharedWith || [];
          if (!shared.includes(user.uid)) {
            updateDoc(doc(db, "boards", boardId), {
              sharedWith: arrayUnion(user.uid),
            });
          }
        }
      }
    });
    return unsubscribe;
  }, [boardId, user]);

  const handleRename = useCallback(() => {
    const newName = prompt("Rename board:", boardName);
    if (!newName || newName === boardName) return;
    updateDoc(doc(db, "boards", boardId), { name: newName, updatedAt: Date.now() });
    setBoardName(newName);
  }, [boardId, boardName]);

  const handleToolChange = useCallback((tool: Tool) => {
    setActiveTool(tool);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "var(--bg-primary)" }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent", animation: "spin 1s linear infinite" }}
          />
          <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading board...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative" data-theme={isDarkMode ? "dark" : "light"} style={{ background: "var(--bg-primary)" }}>
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 z-50"
        style={{
          height: 48,
          background: "var(--bg-glass)",
          backdropFilter: "blur(var(--blur-lg))",
          WebkitBackdropFilter: "blur(var(--blur-lg))",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm cursor-pointer"
            style={{
              color: "var(--text-secondary)",
              background: "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              transition: "all var(--duration-fast) var(--ease-out)",
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Boards
          </button>
          <div className="w-px h-5" style={{ background: "var(--border-subtle)" }} />
          <h1
            className="font-medium text-sm cursor-pointer"
            onClick={handleRename}
            title="Click to rename"
            style={{
              color: "var(--text-primary)",
              transition: "color var(--duration-fast) var(--ease-out)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
          >
            {boardName}
          </h1>
        </div>

        <PresenceBar
          cursors={cursors}
          userName={user?.displayName || user?.email || "Anonymous"}
          myColor={myColor}
        />

        <div className="flex items-center gap-1">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center cursor-pointer"
            style={{
              background: "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-tertiary)",
              transition: "all var(--duration-fast) var(--ease-out)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-surface-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-tertiary)";
            }}
            title={isDarkMode ? "Switch to light" : "Switch to dark"}
          >
            {isDarkMode ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>

          {/* AI Assistant toggle */}
          <button
            onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
            className="w-8 h-8 flex items-center justify-center cursor-pointer"
            style={{
              background: isAIPanelOpen ? "var(--accent)" : "transparent",
              color: isAIPanelOpen ? "#ffffff" : "var(--text-tertiary)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              transition: "all var(--duration-fast) var(--ease-out)",
            }}
            onMouseEnter={(e) => {
              if (!isAIPanelOpen) {
                e.currentTarget.style.background = "var(--bg-surface-hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isAIPanelOpen) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-tertiary)";
              }
            }}
            title="AI Assistant"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M12 7v4M10 9h4" />
            </svg>
          </button>

          <button
            onClick={logout}
            className="text-sm px-2.5 py-1.5 cursor-pointer"
            style={{
              color: "var(--text-tertiary)",
              background: "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              transition: "all var(--duration-fast) var(--ease-out)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-surface-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-tertiary)";
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Canvas */}
      <BoardCanvas
        objects={objects}
        cursors={cursors}
        activeTool={activeTool}
        userId={user?.uid || ""}
        bgColor={isDarkMode ? "#0a0d14" : "#f8f9fb"}
        onAddObject={addObject}
        onUpdateObject={updateObject}
        onDeleteObject={deleteObject}
        onCursorMove={updateCursor}
        onToolChange={handleToolChange}
        onThumbnailCapture={handleThumbnailCapture}
        onSelectionChange={setSelectedObjectId}
      />

      {/* Toolbar */}
      <Toolbar
        activeTool={activeTool}
        onToolChange={handleToolChange}
        hasSelection={!!selectedObjectId}
        onDeleteSelected={() => {
          if (selectedObjectId) {
            deleteObject(selectedObjectId);
            setSelectedObjectId(null);
          }
        }}
      />

      {/* Zoom indicator */}
      <div
        className="absolute bottom-6 text-xs px-3 py-1.5 z-30"
        style={{
          right: isAIPanelOpen ? 396 : 24,
          background: "var(--bg-glass)",
          backdropFilter: "blur(var(--blur-md))",
          WebkitBackdropFilter: "blur(var(--blur-md))",
          color: "var(--text-quaternary)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)",
          transition: "right var(--duration-slow) var(--ease-out)",
        }}
      >
        Scroll to zoom | Space+drag to pan
      </div>

      {/* AI Chat Panel */}
      <AIChatPanel
        boardId={boardId}
        userId={user?.uid || ""}
        isOpen={isAIPanelOpen}
        onClose={() => setIsAIPanelOpen(false)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

export default function BoardPage() {
  return (
    <AuthGuard>
      <BoardPageInner />
    </AuthGuard>
  );
}
