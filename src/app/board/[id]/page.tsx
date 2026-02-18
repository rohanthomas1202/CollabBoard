"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useBoard } from "@/hooks/useBoard";
import { usePresence } from "@/hooks/usePresence";
import AuthGuard from "@/components/ui/AuthGuard";
import Toolbar from "@/components/toolbar/Toolbar";
import PresenceBar from "@/components/ui/PresenceBar";
import { Tool } from "@/lib/types";

const BoardCanvas = dynamic(() => import("@/components/canvas/Board"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen" style={{ background: "#0f1117" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#4f7df9", borderTopColor: "transparent" }} />
        <span style={{ color: "#8b8fa3" }} className="text-sm">Loading board...</span>
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
  const [boardName, setBoardName] = useState("Untitled Board");
  const [isDarkMode, setIsDarkMode] = useState(true);

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
      <div className="flex items-center justify-center h-screen" style={{ background: "#0f1117" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#4f7df9", borderTopColor: "transparent" }} />
          <span style={{ color: "#8b8fa3" }} className="text-sm">Loading board...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative" style={{ background: isDarkMode ? "#0f1117" : "#f5f6f8" }}>
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-4 z-50"
        style={{
          background: isDarkMode ? "rgba(26, 29, 39, 0.75)" : "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: `1px solid ${isDarkMode ? "#2a2e3d" : "#e2e4e8"}`,
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer"
            style={{ color: isDarkMode ? "#8b8fa3" : "#6b7280", background: "transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = isDarkMode ? "#242836" : "#f0f0f2"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Boards
          </button>
          <div className="w-px h-5" style={{ background: isDarkMode ? "#2a2e3d" : "#e2e4e8" }} />
          <h1
            className="font-medium text-sm cursor-pointer transition-colors duration-200"
            onClick={handleRename}
            title="Click to rename"
            style={{ color: isDarkMode ? "#e8eaed" : "#1f2937" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#4f7df9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = isDarkMode ? "#e8eaed" : "#1f2937"; }}
          >
            {boardName}
          </h1>
        </div>

        <PresenceBar
          cursors={cursors}
          userName={user?.displayName || user?.email || "Anonymous"}
          myColor={myColor}
        />

        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer"
            style={{
              background: isDarkMode ? "#242836" : "#f0f0f2",
              color: isDarkMode ? "#8b8fa3" : "#6b7280",
              border: `1px solid ${isDarkMode ? "#2a2e3d" : "#e2e4e8"}`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = isDarkMode ? "#3d4258" : "#d1d5db"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = isDarkMode ? "#2a2e3d" : "#e2e4e8"; }}
            title={isDarkMode ? "Switch to light" : "Switch to dark"}
          >
            {isDarkMode ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>

          <button
            onClick={logout}
            className="text-sm px-2.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer"
            style={{ color: isDarkMode ? "#8b8fa3" : "#6b7280", background: "transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = isDarkMode ? "#242836" : "#f0f0f2"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
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
        bgColor={isDarkMode ? "#0f1117" : "#f5f6f8"}
        onAddObject={addObject}
        onUpdateObject={updateObject}
        onDeleteObject={deleteObject}
        onCursorMove={updateCursor}
        onToolChange={handleToolChange}
      />

      {/* Toolbar */}
      <Toolbar activeTool={activeTool} onToolChange={handleToolChange} />

      {/* Zoom indicator */}
      <div
        className="absolute bottom-6 right-6 text-xs px-3 py-1.5 rounded-lg z-50"
        style={{
          background: isDarkMode ? "rgba(26, 29, 39, 0.8)" : "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          color: isDarkMode ? "#5c6070" : "#9ca3af",
          border: `1px solid ${isDarkMode ? "#2a2e3d" : "#e2e4e8"}`,
        }}
      >
        Scroll to zoom | Space+drag to pan
      </div>
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
