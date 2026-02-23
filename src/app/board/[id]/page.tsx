"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Konva from "konva";
import { useAuth } from "@/hooks/useAuth";
import { useBoard } from "@/hooks/useBoard";
import { usePresence } from "@/hooks/usePresence";
import { useTheme } from "@/hooks/useTheme";
import { useExport } from "@/hooks/useExport";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useTimer } from "@/hooks/useTimer";
import { useVoting } from "@/hooks/useVoting";
import { usePresentationMode } from "@/hooks/usePresentationMode";
import AuthGuard from "@/components/ui/AuthGuard";
import Toolbar from "@/components/toolbar/Toolbar";
import PresenceBar from "@/components/ui/PresenceBar";
import AIChatPanel from "@/components/ui/AIChatPanel";
import TimerDisplay from "@/components/ui/TimerDisplay";
import PresentationNav from "@/components/ui/PresentationNav";
import PresentationOverlay from "@/components/ui/PresentationOverlay";
import Minimap from "@/components/ui/Minimap";
import CursorChat from "@/components/ui/CursorChat";
import AlignmentToolbar from "@/components/ui/AlignmentToolbar";
import CommentThread from "@/components/ui/CommentThread";
import { useComments } from "@/hooks/useComments";
import { Tool, BoardObject } from "@/lib/types";

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
  const { objects, loading, addObject, updateObject, deleteObject, restoreObject, toggleReaction, batchUpdateObjects, batchDeleteObjects } = useBoard(boardId);
  const { cursors, updateCursor, myColor, sendCursorMessage } = usePresence(
    boardId,
    user?.uid || "",
    user?.displayName || user?.email || "Anonymous"
  );
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [freehandStrokeWidth, setFreehandStrokeWidth] = useState(3);
  const [boardName, setBoardName] = useState("Untitled Board");
  const { isDark: isDarkMode, toggleTheme } = useTheme();
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const lastThumbnailSave = useRef<number>(0);
  const canvasStageRef = useRef<Konva.Stage | null>(null);
  const stageRefObject = useMemo(() => canvasStageRef as React.RefObject<Konva.Stage | null>, []);
  const { exportPNG, exportPDF } = useExport(stageRefObject);
  const handleStageRef = useCallback((stage: Konva.Stage | null) => {
    canvasStageRef.current = stage;
  }, []);
  const timer = useTimer(boardId, user?.uid || "");
  const voting = useVoting(boardId, user?.uid || "", objects);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const presentation = usePresentationMode(stageRefObject, objects, stageSize);
  const [noFramesToast, setNoFramesToast] = useState(false);
  const [viewportPos, setViewportPos] = useState({ x: 0, y: 0 });
  const [viewportScale, setViewportScale] = useState(1);
  const boardPanTo = useRef<((x: number, y: number) => void) | null>(null);
  const [cursorChatActive, setCursorChatActive] = useState(false);
  const mouseScreenPos = useRef({ x: 0, y: 0 });
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridEnabled, setGridEnabled] = useState(false);
  const { comments, addComment, addReply, toggleResolved, deleteComment } = useComments(boardId);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  const handleViewportChange = useCallback((pos: { x: number; y: number }, s: number) => {
    setViewportPos((prev) => (prev.x === pos.x && prev.y === pos.y ? prev : pos));
    setViewportScale((prev) => (prev === s ? prev : s));
  }, []);

  const handleViewportControl = useCallback((controls: { panTo: (x: number, y: number) => void }) => {
    boardPanTo.current = controls.panTo;
  }, []);

  const handleMinimapNavigate = useCallback((stageX: number, stageY: number) => {
    boardPanTo.current?.(stageX, stageY);
  }, []);

  // Track mouse screen position for cursor chat placement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseScreenPos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleCursorChatActivate = useCallback(() => {
    setCursorChatActive(true);
  }, []);

  const handleCursorChatSend = useCallback((message: string) => {
    sendCursorMessage(message);
    setCursorChatActive(false);
  }, [sendCursorMessage]);

  const handleCursorChatCancel = useCallback(() => {
    setCursorChatActive(false);
  }, []);

  const handleAddComment = useCallback(
    async (x: number, y: number, objectId?: string) => {
      const id = await addComment(
        x,
        y,
        user?.uid || "",
        user?.displayName || user?.email || "Anonymous",
        objectId
      );
      if (id) setActiveCommentId(id);
    },
    [addComment, user]
  );

  const handleCommentReply = useCallback(
    (commentId: string, text: string) => {
      addReply(commentId, {
        userId: user?.uid || "",
        userName: user?.displayName || user?.email || "Anonymous",
        text,
        createdAt: Date.now(),
      });
    },
    [addReply, user]
  );

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      deleteComment(commentId);
      setActiveCommentId(null);
    },
    [deleteComment]
  );

  const handleToggleResolved = useCallback(
    (commentId: string) => {
      toggleResolved(commentId);
    },
    [toggleResolved]
  );

  // Keep stageSize in sync with window
  useEffect(() => {
    const update = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Undo/Redo
  const undoRedoActions = useMemo(
    () => ({ updateObject, deleteObject, restoreObject, batchUpdateObjects, batchDeleteObjects }),
    [updateObject, deleteObject, restoreObject, batchUpdateObjects, batchDeleteObjects]
  );
  const { undo, redo, canUndo, canRedo, trackCreate, trackUpdate, trackDelete, trackBatch } = useUndoRedo(undoRedoActions);

  // Wrapped mutations that track undo history
  const trackedAddObject = useCallback(
    async (obj: Omit<BoardObject, "id" | "updatedAt">) => {
      const id = await addObject(obj);
      // Grab the full object from the returned id for undo tracking
      trackCreate(id, { ...obj, id, updatedAt: Date.now() } as BoardObject);
      return id;
    },
    [addObject, trackCreate]
  );

  const trackedUpdateObject = useCallback(
    (id: string, updates: Partial<BoardObject>) => {
      const before = objects.find((o) => o.id === id);
      if (before) {
        trackUpdate(before, { ...before, ...updates } as BoardObject);
      }
      updateObject(id, updates);
    },
    [objects, updateObject, trackUpdate]
  );

  const trackedDeleteObject = useCallback(
    (id: string) => {
      const obj = objects.find((o) => o.id === id);
      if (obj) {
        trackDelete(obj);
      }
      deleteObject(id);
    },
    [objects, deleteObject, trackDelete]
  );

  const trackedBatchDeleteObjects = useCallback(
    (ids: string[]) => {
      const entries = ids
        .map((id) => objects.find((o) => o.id === id))
        .filter(Boolean)
        .map((obj) => ({
          type: "delete" as const,
          objectId: obj!.id,
          before: obj!,
        }));
      trackBatch(entries);
      batchDeleteObjects(ids);
    },
    [objects, batchDeleteObjects, trackBatch]
  );

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
      {!presentation.isPresenting && <div
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
          {/* Timer */}
          <TimerDisplay
            status={timer.status}
            displayMs={timer.displayMs}
            finished={timer.finished}
            onStart={timer.start}
            onResume={timer.resume}
            onPause={timer.pause}
            onReset={timer.reset}
          />
          <div className="w-px h-5 mx-1" style={{ background: "var(--border-subtle)" }} />
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

          {/* Export PNG */}
          <button
            onClick={() => exportPNG(`${boardName}.png`)}
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
            title="Export as PNG"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>

          {/* Export PDF */}
          <button
            onClick={() => exportPDF(`${boardName}.pdf`)}
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
            title="Export as PDF"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 18 15 15" />
            </svg>
          </button>

          {/* Present button */}
          <button
            onClick={() => {
              const frames = objects.filter((o) => o.type === "frame");
              if (frames.length === 0) {
                setNoFramesToast(true);
                setTimeout(() => setNoFramesToast(false), 3000);
                return;
              }
              presentation.enter();
            }}
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
            title="Present (step through frames)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
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
      </div>}

      {/* Canvas */}
      <BoardCanvas
        objects={objects}
        cursors={cursors}
        activeTool={activeTool}
        userId={user?.uid || ""}
        bgColor={isDarkMode ? "#0a0d14" : "#f8f9fb"}
        onAddObject={trackedAddObject}
        onUpdateObject={trackedUpdateObject}
        onDeleteObject={trackedDeleteObject}
        onBatchDeleteObjects={trackedBatchDeleteObjects}
        onBatchUpdateObjects={batchUpdateObjects}
        onCursorMove={updateCursor}
        onToolChange={handleToolChange}
        onThumbnailCapture={handleThumbnailCapture}
        onSelectionChange={setSelectedObjectIds}
        onStageRef={handleStageRef}
        onUndo={undo}
        onRedo={redo}
        onToggleReaction={(objectId, emoji) => toggleReaction(objectId, emoji, user?.uid || "")}
        votingEnabled={voting.votingEnabled}
        onCastVote={voting.castVote}
        onRemoveVote={voting.removeVote}
        getObjectVoteCount={voting.getObjectVoteCount}
        getUserVoteCount={voting.getUserVoteCount}
        freehandStrokeWidth={freehandStrokeWidth}
        isPresentationMode={presentation.isPresenting}
        onViewportChange={handleViewportChange}
        onViewportControl={handleViewportControl}
        onCursorChatActivate={handleCursorChatActivate}
        snapEnabled={snapEnabled}
        gridEnabled={gridEnabled}
        comments={comments}
        activeCommentId={activeCommentId}
        onAddComment={handleAddComment}
        onSelectComment={setActiveCommentId}
      />

      {/* Toolbar */}
      <Toolbar
        activeTool={activeTool}
        onToolChange={handleToolChange}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        hasSelection={selectedObjectIds.length > 0}
        onDeleteSelected={() => {
          if (selectedObjectIds.length === 0) return;
          if (selectedObjectIds.length === 1) {
            trackedDeleteObject(selectedObjectIds[0]);
          } else {
            trackedBatchDeleteObjects(selectedObjectIds);
          }
          setSelectedObjectIds([]);
        }}
        votingEnabled={voting.votingEnabled}
        votesRemaining={voting.votesRemaining}
        votesPerUser={voting.votesPerUser}
        onToggleVoting={voting.toggleVoting}
        onSetVotesPerUser={voting.setVotesPerUser}
        freehandStrokeWidth={freehandStrokeWidth}
        onSetFreehandStrokeWidth={setFreehandStrokeWidth}
        hidden={presentation.isPresenting}
        snapEnabled={snapEnabled}
        gridEnabled={gridEnabled}
        onToggleSnap={() => setSnapEnabled((p) => !p)}
        onToggleGrid={() => setGridEnabled((p) => !p)}
      />

      {/* Zoom indicator */}
      {!presentation.isPresenting && <div
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
      </div>}

      {/* Minimap */}
      {!presentation.isPresenting && (
        <Minimap
          objects={objects}
          viewportPos={viewportPos}
          viewportScale={viewportScale}
          stageSize={stageSize}
          onNavigate={handleMinimapNavigate}
        />
      )}

      {/* Alignment toolbar for multi-select */}
      {selectedObjectIds.length >= 2 && !presentation.isPresenting && (() => {
        const selected = objects.filter((o) => selectedObjectIds.includes(o.id) && o.type !== "connector");
        if (selected.length < 2) return null;
        const bbox = selected.reduce(
          (acc, o) => ({
            minX: Math.min(acc.minX, o.x),
            minY: Math.min(acc.minY, o.y),
            maxX: Math.max(acc.maxX, o.x + o.width),
            maxY: Math.max(acc.maxY, o.y + o.height),
          }),
          { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
        );
        const screenX = bbox.minX * viewportScale + viewportPos.x;
        const screenY = bbox.minY * viewportScale + viewportPos.y;
        return (
          <AlignmentToolbar
            selectedObjects={selected}
            onBatchUpdate={batchUpdateObjects}
            screenPosition={{ x: screenX, y: screenY }}
          />
        );
      })()}

      {/* Cursor Chat input overlay */}
      {cursorChatActive && (
        <CursorChat
          screenX={mouseScreenPos.current.x}
          screenY={mouseScreenPos.current.y}
          color={myColor}
          onSend={handleCursorChatSend}
          onCancel={handleCursorChatCancel}
        />
      )}

      {/* Comment Thread popover */}
      {activeCommentId && (() => {
        const comment = comments.find((c) => c.id === activeCommentId);
        if (!comment) return null;
        // Calculate screen position of comment pin
        let worldX = comment.x;
        let worldY = comment.y;
        if (comment.objectId) {
          const obj = objects.find((o) => o.id === comment.objectId);
          if (obj) {
            worldX = obj.x + comment.x;
            worldY = obj.y + comment.y;
          }
        }
        const screenX = worldX * viewportScale + viewportPos.x;
        const screenY = worldY * viewportScale + viewportPos.y;
        return (
          <CommentThread
            comment={comment}
            screenPosition={{ x: screenX, y: screenY }}
            userId={user?.uid || ""}
            userName={user?.displayName || user?.email || "Anonymous"}
            onReply={handleCommentReply}
            onToggleResolved={handleToggleResolved}
            onDelete={handleDeleteComment}
            onClose={() => setActiveCommentId(null)}
          />
        );
      })()}

      {/* AI Chat Panel */}
      {!presentation.isPresenting && <AIChatPanel
        boardId={boardId}
        userId={user?.uid || ""}
        isOpen={isAIPanelOpen}
        onClose={() => setIsAIPanelOpen(false)}
        isDarkMode={isDarkMode}
      />}

      {/* Presentation mode overlays */}
      {presentation.isPresenting && (
        <PresentationOverlay
          screenRect={presentation.screenRect}
        />
      )}

      {presentation.isPresenting && (
        <PresentationNav
          frames={presentation.sortedFrames}
          currentIndex={presentation.currentIndex}
          onGoTo={presentation.goTo}
          onPrev={presentation.prev}
          onNext={presentation.next}
          onExit={presentation.exit}
        />
      )}

      {/* No frames toast */}
      {noFramesToast && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-100 text-sm px-4 py-2.5 animate-in fade-in slide-in-from-top-2"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          Add frames to use Presentation Mode.
        </div>
      )}
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
