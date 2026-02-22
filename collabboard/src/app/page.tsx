"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
import { useTheme } from "@/hooks/useTheme";
import { Board } from "@/lib/types";

type Tab = "all" | "my" | "shared";

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.2, 1, 0.2, 1] as [number, number, number, number] } },
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
  const { isDark, toggleTheme } = useTheme();

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-7 h-7 rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent", animation: "spin 1s linear infinite" }}
          />
          <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading...</span>
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
    <div className="min-h-screen" data-theme={isDark ? "dark" : "light"} style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: "var(--bg-glass)",
          backdropFilter: "blur(var(--blur-lg))",
          WebkitBackdropFilter: "blur(var(--blur-lg))",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 flex items-center justify-center"
              style={{ background: "var(--accent)", borderRadius: "var(--radius-sm)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>CollabBoard</h1>
          </div>
          <div className="flex items-center gap-2">
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
              title={isDark ? "Switch to light" : "Switch to dark"}
            >
              {isDark ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
            <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ borderRadius: "var(--radius-sm)" }}>
              <div
                className="w-6 h-6 flex items-center justify-center text-xs font-semibold text-white"
                style={{ background: "var(--accent)", borderRadius: "var(--radius-full)" }}
              >
                {userInitial}
              </div>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {user.displayName || user.email}
              </span>
            </div>
            <button
              onClick={logout}
              className="text-sm px-3 py-1.5 cursor-pointer"
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
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          {/* Tabs — Linear-style underline */}
          <div className="flex gap-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="relative px-4 pb-3 text-sm font-medium cursor-pointer"
                style={{
                  background: "none",
                  border: "none",
                  color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-tertiary)",
                  transition: "color var(--duration-fast) var(--ease-out)",
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.key) e.currentTarget.style.color = "var(--text-secondary)";
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.key) e.currentTarget.style.color = "var(--text-tertiary)";
                }}
              >
                {tab.label}
                <span className="ml-1.5 text-xs" style={{ color: "var(--text-quaternary)" }}>{tab.count}</span>
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0"
                    style={{ height: 2, background: "var(--accent)", borderRadius: "var(--radius-full)" }}
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                )}
              </button>
            ))}
          </div>
          <button
            onClick={createBoard}
            className="flex items-center gap-2 px-4 text-sm font-medium text-white cursor-pointer"
            style={{
              height: 36,
              background: "var(--accent)",
              border: "none",
              borderRadius: "var(--radius-full)",
              transition: "all var(--duration-normal) var(--ease-out)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent-hover)";
              e.currentTarget.style.boxShadow = "var(--shadow-glow)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--accent)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Board
          </button>
        </div>

        {boardsLoading ? (
          <div className="flex items-center justify-center py-24">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent", animation: "spin 1s linear infinite" }}
            />
          </div>
        ) : displayedBoards.length === 0 ? (
          <div className="text-center py-24">
            <div
              className="inline-flex items-center justify-center w-12 h-12 mb-4"
              style={{ background: "var(--accent-muted)", borderRadius: "var(--radius-lg)" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <p className="text-lg font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              {activeTab === "shared" ? "No shared boards yet" : "No boards yet"}
            </p>
            <p className="text-sm mb-6" style={{ color: "var(--text-tertiary)" }}>
              {activeTab === "shared"
                ? "Boards shared with you will appear here."
                : "Create your first collaborative whiteboard."}
            </p>
            {activeTab !== "shared" && (
              <button
                onClick={createBoard}
                className="px-5 text-sm font-medium text-white cursor-pointer"
                style={{
                  height: 40,
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: "var(--radius-full)",
                  transition: "all var(--duration-normal) var(--ease-out)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--accent-hover)";
                  e.currentTarget.style.boxShadow = "var(--shadow-glow)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--accent)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                Create Board
              </button>
            )}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            key={activeTab}
          >
            {displayedBoards.map((board) => {
              const isOwner = board.ownerId === user.uid;
              return (
                <motion.div
                  key={board.id}
                  variants={staggerItem}
                  className="p-4 cursor-pointer group"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "var(--shadow-sm)",
                    transition: "all var(--duration-normal) var(--ease-out)",
                  }}
                  onClick={() => router.push(`/board/${board.id}`)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-hover)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "var(--shadow-md)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-subtle)";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                  }}
                >
                  {/* Preview area */}
                  <div
                    className="mb-3 flex items-center justify-center relative overflow-hidden"
                    style={{
                      height: 160,
                      background: "var(--bg-secondary)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    {board.thumbnail ? (
                      <img
                        src={board.thumbnail}
                        alt={board.name}
                        className="w-full h-full object-cover"
                        style={{ borderRadius: "var(--radius-md)" }}
                        draggable={false}
                      />
                    ) : (
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-quaternary)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                        <rect x="14" y="14" width="7" height="7" rx="1" />
                      </svg>
                    )}
                    {!isOwner && (
                      <span
                        className="absolute top-2 right-2 text-[10px] px-2 py-0.5 font-medium"
                        style={{
                          background: "var(--accent-muted)",
                          color: "var(--accent)",
                          borderRadius: "var(--radius-full)",
                        }}
                      >
                        Shared
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3
                        className="font-medium text-sm truncate cursor-pointer"
                        style={{
                          color: "var(--text-primary)",
                          transition: "color var(--duration-fast) var(--ease-out)",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          renameBoardHandler(board.id, board.name);
                        }}
                        title="Click to rename"
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
                      >
                        {board.name}
                      </h3>
                      <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                        {new Date(board.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {isOwner && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBoardHandler(board.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 cursor-pointer"
                        style={{
                          color: "var(--text-quaternary)",
                          background: "transparent",
                          border: "none",
                          borderRadius: "var(--radius-sm)",
                          transition: "all var(--duration-fast) var(--ease-out)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--error-muted)";
                          e.currentTarget.style.color = "var(--error)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "var(--text-quaternary)";
                        }}
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
                    className="mt-2.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                    style={{
                      color: copiedId === board.id ? "var(--success)" : "var(--accent)",
                      background: "none",
                      border: "none",
                      transition: "color var(--duration-fast) var(--ease-out)",
                    }}
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
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </main>
    </div>
  );
}
