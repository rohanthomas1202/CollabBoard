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

// Dynamic import for Konva (no SSR)
const BoardCanvas = dynamic(() => import("@/components/canvas/Board"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-[#1a1a2e]">
      <div className="text-white">Loading board...</div>
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

  // Listen to board metadata for the name + auto-add to sharedWith
  useEffect(() => {
    if (!boardId) return;
    const unsubscribe = onSnapshot(doc(db, "boards", boardId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBoardName(data.name || "Untitled Board");
        // Auto-add user to sharedWith if they're not the owner
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
      <div className="flex items-center justify-center h-screen bg-[#1a1a2e]">
        <div className="text-white">Loading board...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-[#1a1a2e]">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-gray-900/90 backdrop-blur border-b border-gray-800 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-gray-400 hover:text-white text-sm"
          >
            &larr; Boards
          </button>
          <h1
            className="text-white font-medium text-sm hover:text-blue-400 cursor-pointer"
            onClick={handleRename}
            title="Click to rename"
          >
            {boardName}
          </h1>
        </div>

        <PresenceBar
          cursors={cursors}
          userName={user?.displayName || user?.email || "Anonymous"}
          myColor={myColor}
        />

        <button
          onClick={logout}
          className="text-gray-400 hover:text-white text-sm"
        >
          Sign Out
        </button>
      </div>

      {/* Canvas */}
      <BoardCanvas
        objects={objects}
        cursors={cursors}
        activeTool={activeTool}
        userId={user?.uid || ""}
        onAddObject={addObject}
        onUpdateObject={updateObject}
        onDeleteObject={deleteObject}
        onCursorMove={updateCursor}
        onToolChange={handleToolChange}
      />

      {/* Toolbar */}
      <Toolbar activeTool={activeTool} onToolChange={handleToolChange} />

      {/* Zoom indicator */}
      <div className="absolute bottom-6 right-6 bg-gray-900/80 text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-gray-700 z-50">
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
