"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const BOARD_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)",
  "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
];

function boardGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return BOARD_GRADIENTS[Math.abs(hash) % BOARD_GRADIENTS.length];
}

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.2, 1, 0.2, 1] as [number, number, number, number] },
  },
};

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [allBoards, setAllBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const { isDark, toggleTheme } = useTheme();

  // Derive myBoards and sharedBoards from allBoards (no separate state needed)
  const myBoards = useMemo(
    () => (user ? allBoards.filter((b) => b.ownerId === user.uid) : []),
    [allBoards, user]
  );
  const sharedBoards = useMemo(
    () =>
      user
        ? allBoards.filter(
            (b) => b.ownerId !== user.uid && (b.sharedWith || []).includes(user.uid)
          )
        : [],
    [allBoards, user]
  );

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    let unsubscribe: (() => void) | null = null;

    const subscribe = () => {
      if (unsubscribe) unsubscribe();
      unsubscribe = onSnapshot(
        collection(db, "boards"),
        { includeMetadataChanges: true },
        (snapshot) => {
          const list: Board[] = [];
          snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as Board));
          list.sort((a, b) => b.createdAt - a.createdAt);
          setAllBoards(list);
          // Only clear loading when we have server-confirmed data
          if (!snapshot.metadata.fromCache || list.length > 0) {
            setBoardsLoading(false);
          }
        },
        (error) => {
          console.error("All boards listener error:", error);
          setBoardsLoading(false);
        }
      );
    };

    subscribe();

    // Re-subscribe when the page becomes visible again.
    // Handles: browser back/forward cache, tab switching, and
    // cases where the Firestore WebSocket dropped during navigation.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        subscribe();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (unsubscribe) unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [user]);

  const displayedBoards = useMemo(() => {
    const source =
      activeTab === "my" ? myBoards : activeTab === "shared" ? sharedBoards : allBoards;
    if (!searchQuery.trim()) return source;
    const q = searchQuery.toLowerCase();
    return source.filter((b) => b.name.toLowerCase().includes(q));
  }, [activeTab, myBoards, sharedBoards, allBoards, searchQuery]);

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
        <div className="flex flex-col items-center gap-4">
          <div className="dashboard-loader" />
          <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading your workspace...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const tabs: { key: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    {
      key: "all",
      label: "All Boards",
      count: allBoards.length,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      key: "my",
      label: "My Boards",
      count: myBoards.length,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      key: "shared",
      label: "Shared",
      count: sharedBoards.length,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
    },
  ];

  const userInitial = (user.displayName || user.email || "U")[0].toUpperCase();
  const firstName = (user.displayName || user.email || "").split(/[\s@]/)[0];

  return (
    <div className="min-h-screen" data-theme={isDark ? "dark" : "light"} style={{ background: "var(--bg-primary)" }}>
      {/* Ambient background glow */}
      <div className="dashboard-ambient" />

      {/* Header */}
      <header className="dashboard-header">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="dashboard-logo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <h1 className="text-base font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              CollabBoard
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={toggleTheme} className="dashboard-icon-btn" title={isDark ? "Light mode" : "Dark mode"}>
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

            <div className="dashboard-user-pill">
              <div className="dashboard-avatar">{userInitial}</div>
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                {user.displayName || user.email}
              </span>
            </div>

            <button onClick={logout} className="dashboard-icon-btn" title="Sign out">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 pt-10 pb-16">
        {/* Greeting + stats */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 1, 0.2, 1] }}
        >
          <h2 className="text-3xl font-bold tracking-tight mb-2" style={{ color: "var(--text-primary)" }}>
            {getGreeting()}, {firstName}
          </h2>
          <p className="text-base" style={{ color: "var(--text-tertiary)" }}>
            {allBoards.length === 0
              ? "Create your first board to get started."
              : `You have ${myBoards.length} board${myBoards.length !== 1 ? "s" : ""}${sharedBoards.length > 0 ? ` and ${sharedBoards.length} shared with you` : ""}.`}
          </p>
        </motion.div>

        {/* Controls row */}
        <motion.div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.2, 1, 0.2, 1] }}
        >
          {/* Tabs */}
          <div className="dashboard-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`dashboard-tab ${activeTab === tab.key ? "dashboard-tab-active" : ""}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span className="dashboard-tab-count">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="dashboard-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search boards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="dashboard-search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="dashboard-search-clear"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* New board button */}
            <button onClick={createBoard} className="dashboard-new-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New Board</span>
            </button>
          </div>
        </motion.div>

        {/* Board grid */}
        {boardsLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="dashboard-loader" />
          </div>
        ) : displayedBoards.length === 0 ? (
          <motion.div
            className="text-center py-28"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.2, 1, 0.2, 1] }}
          >
            <div className="dashboard-empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id="emptyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent)" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="url(#emptyGrad)" />
                <line x1="12" y1="8" x2="12" y2="16" stroke="url(#emptyGrad)" />
                <line x1="8" y1="12" x2="16" y2="12" stroke="url(#emptyGrad)" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              {searchQuery
                ? "No boards found"
                : activeTab === "shared"
                ? "No shared boards yet"
                : "Create your first board"}
            </h3>
            <p className="text-sm mb-8 max-w-xs mx-auto" style={{ color: "var(--text-tertiary)" }}>
              {searchQuery
                ? `No results for "${searchQuery}". Try a different search.`
                : activeTab === "shared"
                ? "When someone shares a board with you, it will appear here."
                : "Start collaborating by creating a new whiteboard."}
            </p>
            {!searchQuery && activeTab !== "shared" && (
              <button onClick={createBoard} className="dashboard-new-btn" style={{ display: "inline-flex" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Create Board</span>
              </button>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              key={activeTab + searchQuery}
            >
              {displayedBoards.map((board) => {
                const isOwner = board.ownerId === user.uid;
                const isHovered = hoveredCard === board.id;
                return (
                  <motion.div
                    key={board.id}
                    variants={staggerItem}
                    className="dashboard-card group"
                    onClick={() => router.push(`/board/${board.id}`)}
                    onMouseEnter={() => setHoveredCard(board.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    {/* Gradient border glow on hover */}
                    <div
                      className="dashboard-card-glow"
                      style={{
                        opacity: isHovered ? 1 : 0,
                        background: boardGradient(board.id),
                      }}
                    />

                    <div className="dashboard-card-inner">
                      {/* Preview area */}
                      <div className="dashboard-card-preview">
                        {board.thumbnail ? (
                          <>
                            <img
                              src={board.thumbnail}
                              alt={board.name}
                              className="dashboard-card-thumbnail"
                              draggable={false}
                            />
                            {/* Hover zoom overlay */}
                            <div className="dashboard-card-zoom-overlay">
                              <img
                                src={board.thumbnail}
                                alt=""
                                className="dashboard-card-zoom-img"
                                draggable={false}
                              />
                              <div className="dashboard-card-zoom-label">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                  <circle cx="11" cy="11" r="8" />
                                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                  <line x1="11" y1="8" x2="11" y2="14" />
                                  <line x1="8" y1="11" x2="14" y2="11" />
                                </svg>
                                <span>Preview</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              className="dashboard-card-gradient"
                              style={{ background: boardGradient(board.id) }}
                            />
                            <div className="dashboard-card-grid" />
                            <div className="dashboard-card-icon">
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                                <rect x="3" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="3" width="7" height="7" rx="1" />
                                <rect x="3" y="14" width="7" height="7" rx="1" />
                                <rect x="14" y="14" width="7" height="7" rx="1" />
                              </svg>
                            </div>
                          </>
                        )}
                        {!isOwner && (
                          <span className="dashboard-badge-shared">Shared</span>
                        )}
                      </div>

                      {/* Card body */}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-1">
                          <h3
                            className="font-semibold text-sm truncate flex-1 cursor-pointer dashboard-card-title"
                            onClick={(e) => {
                              e.stopPropagation();
                              renameBoardHandler(board.id, board.name);
                            }}
                            title="Click to rename"
                          >
                            {board.name}
                          </h3>
                          <div className="flex items-center gap-0.5 ml-2 opacity-0 group-hover:opacity-100" style={{ transition: "opacity 150ms" }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyShareLink(board.id);
                              }}
                              className="dashboard-card-action"
                              title={copiedId === board.id ? "Copied!" : "Copy share link"}
                            >
                              {copiedId === board.id ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round">
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              ) : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <rect x="9" y="9" width="13" height="13" rx="2" />
                                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                </svg>
                              )}
                            </button>
                            {isOwner && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteBoardHandler(board.id);
                                }}
                                className="dashboard-card-action dashboard-card-action-danger"
                                title="Delete board"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs" style={{ color: "var(--text-quaternary)" }}>
                          {timeAgo(board.updatedAt || board.createdAt)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
