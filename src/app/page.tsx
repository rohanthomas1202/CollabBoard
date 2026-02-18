"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Board } from "@/lib/types";

type Tab = "all" | "my" | "shared";

const themes = {
  dark: {
    bg: "#0f1117",
    headerBg: "rgba(26, 29, 39, 0.7)",
    headerBorder: "#2a2e3d",
    surface: "#1a1d27",
    surface2: "#242836",
    border: "#2a2e3d",
    borderHover: "#3d4258",
    text: "#e8eaed",
    textMuted: "#8b8fa3",
    textFaint: "#5c6070",
    cardPreview: "linear-gradient(135deg, #242836, #1a1d27)",
    previewIcon: "#3d4258",
    cardShadow: "0 8px 24px rgba(0,0,0,0.3)",
    toggleBg: "#242836",
    toggleBorder: "#2a2e3d",
    toggleColor: "#8b8fa3",
    deleteBg: "rgba(239,68,68,0.1)",
  },
  light: {
    bg: "#f5f6f8",
    headerBg: "rgba(255, 255, 255, 0.8)",
    headerBorder: "#e2e4e8",
    surface: "#ffffff",
    surface2: "#f0f1f3",
    border: "#e2e4e8",
    borderHover: "#d1d5db",
    text: "#1f2937",
    textMuted: "#6b7280",
    textFaint: "#9ca3af",
    cardPreview: "linear-gradient(135deg, #f0f1f3, #e8eaf0)",
    previewIcon: "#d1d5db",
    cardShadow: "0 8px 24px rgba(0,0,0,0.08)",
    toggleBg: "#f0f1f3",
    toggleBorder: "#e2e4e8",
    toggleColor: "#6b7280",
    deleteBg: "rgba(239,68,68,0.08)",
  },
};

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [allBoards, setAllBoards] = useState<Board[]>([]);
  const [myBoards, setMyBoards] = useState<Board[]>([]);
  const [sharedBoards, setSharedBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);

  const t = isDark ? themes.dark : themes.light;

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(collection(db, "boards"), (snapshot) => {
      const list: Board[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Board);
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      setAllBoards(list);
      setMyBoards(list.filter((b) => b.ownerId === user.uid));
      setBoardsLoading(false);
    }, (error) => {
      console.error("All boards listener error:", error);
      setBoardsLoading(false);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setSharedBoards(
      allBoards.filter(
        (b) => b.ownerId !== user.uid && (b.sharedWith || []).includes(user.uid)
      )
    );
  }, [allBoards, user]);

  const displayedBoards =
    activeTab === "my"
      ? myBoards
      : activeTab === "shared"
      ? sharedBoards
      : allBoards;

  const createBoard = async () => {
    if (!user) return;
    const boardRef = await addDoc(collection(db, "boards"), {
      name: "Untitled Board",
      ownerId: user.uid,
      sharedWith: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    router.push(`/board/${boardRef.id}`);
  };

  const renameBoardHandler = async (boardId: string, currentName: string) => {
    const newName = prompt("Rename board:", currentName);
    if (!newName || newName === currentName) return;
    await updateDoc(doc(db, "boards", boardId), { name: newName, updatedAt: Date.now() });
  };

  const deleteBoardHandler = async (boardId: string) => {
    if (!confirm("Delete this board?")) return;
    await deleteDoc(doc(db, "boards", boardId));
  };

  const copyShareLink = (boardId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/board/${boardId}`);
    setCopiedId(boardId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: t.bg }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#4f7df9", borderTopColor: "transparent" }} />
          <span style={{ color: t.textMuted }} className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All Boards", count: allBoards.length },
    { key: "my", label: "My Boards", count: myBoards.length },
    { key: "shared", label: "Shared", count: sharedBoards.length },
  ];

  const userInitial = (user.displayName || user.email || "U")[0].toUpperCase();

  return (
    <div className="min-h-screen" style={{ background: t.bg }}>
      {/* Header */}
      <header style={{ background: t.headerBg, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: `1px solid ${t.headerBorder}` }}>
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4f7df9, #3b6ce8)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <h1 className="text-base font-semibold" style={{ color: t.text }}>CollabBoard</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer"
              style={{ background: t.toggleBg, border: `1px solid ${t.toggleBorder}`, color: t.toggleColor }}
              title={isDark ? "Switch to light" : "Switch to dark"}
            >
              {isDark ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl" style={{ background: t.surface2 }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, #4f7df9, #8b5cf6)" }}>
                {userInitial}
              </div>
              <span className="text-sm" style={{ color: t.textMuted }}>
                {user.displayName || user.email}
              </span>
            </div>
            <button
              onClick={logout}
              className="text-sm px-3 py-1.5 rounded-xl transition-all duration-200 cursor-pointer"
              style={{ color: t.textMuted, background: "transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = t.surface2; e.currentTarget.style.color = t.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = t.textMuted; }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: t.surface }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  background: activeTab === tab.key ? t.surface2 : "transparent",
                  color: activeTab === tab.key ? t.text : t.textMuted,
                  boxShadow: activeTab === tab.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                {tab.label}
                <span className="ml-1.5 text-xs opacity-50">{tab.count}</span>
              </button>
            ))}
          </div>
          <button
            onClick={createBoard}
            className="px-4 py-2.5 rounded-xl font-medium text-sm text-white transition-all duration-200 flex items-center gap-2 cursor-pointer"
            style={{ background: "linear-gradient(135deg, #4f7df9, #3b6ce8)" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(79,125,249,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Board
          </button>
        </div>

        {boardsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#4f7df9", borderTopColor: "transparent" }} />
          </div>
        ) : displayedBoards.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: "rgba(79, 125, 249, 0.1)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4f7df9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <p className="mb-1 font-medium" style={{ color: t.text }}>
              {activeTab === "shared" ? "No shared boards yet" : "No boards yet"}
            </p>
            <p className="text-sm mb-6" style={{ color: t.textFaint }}>
              {activeTab === "shared"
                ? "Boards shared with you will appear here."
                : "Create your first collaborative whiteboard."}
            </p>
            {activeTab !== "shared" && (
              <button
                onClick={createBoard}
                className="px-6 py-3 rounded-xl font-medium text-sm text-white transition-all duration-200 cursor-pointer"
                style={{ background: "linear-gradient(135deg, #4f7df9, #3b6ce8)" }}
              >
                Create Board
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedBoards.map((board) => {
              const isOwner = board.ownerId === user.uid;
              return (
                <div
                  key={board.id}
                  className="rounded-2xl p-4 transition-all duration-200 cursor-pointer group"
                  style={{ background: t.surface, border: `1px solid ${t.border}` }}
                  onClick={() => router.push(`/board/${board.id}`)}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.borderHover; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = t.cardShadow; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  {/* Preview area */}
                  <div className="h-32 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden" style={{ background: t.cardPreview }}>
                    {board.thumbnail ? (
                      <img
                        src={board.thumbnail}
                        alt={board.name}
                        className="w-full h-full object-cover rounded-xl"
                        draggable={false}
                      />
                    ) : (
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.previewIcon} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                        <rect x="14" y="14" width="7" height="7" rx="1" />
                      </svg>
                    )}
                    {!isOwner && (
                      <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(79, 125, 249, 0.15)", color: "#4f7df9" }}>
                        Shared
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3
                        className="font-medium text-sm truncate transition-colors duration-200"
                        style={{ color: t.text }}
                        onClick={(e) => {
                          e.stopPropagation();
                          renameBoardHandler(board.id, board.name);
                        }}
                        title="Click to rename"
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#4f7df9"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = t.text; }}
                      >
                        {board.name}
                      </h3>
                      <p className="text-xs mt-1" style={{ color: t.textFaint }}>
                        {new Date(board.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {isOwner && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBoardHandler(board.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-lg cursor-pointer"
                        style={{ color: t.textFaint }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = t.deleteBg; e.currentTarget.style.color = "#ef4444"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = t.textFaint; }}
                        title="Delete board"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Share link */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyShareLink(board.id);
                    }}
                    className="mt-2.5 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 cursor-pointer"
                    style={{ color: copiedId === board.id ? "#22c55e" : "#4f7df9" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      {copiedId === board.id ? (
                        <path d="M20 6L9 17l-5-5" />
                      ) : (
                        <>
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </>
                      )}
                    </svg>
                    {copiedId === board.id ? "Copied!" : "Copy share link"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
