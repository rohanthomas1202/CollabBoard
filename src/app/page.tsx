"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
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

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [allBoards, setAllBoards] = useState<Board[]>([]);
  const [myBoards, setMyBoards] = useState<Board[]>([]);
  const [sharedBoards, setSharedBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("all");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Listen to ALL boards
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

  // Derive shared boards from all boards
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All Boards", count: allBoards.length },
    { key: "my", label: "My Boards", count: myBoards.length },
    { key: "shared", label: "Shared with Me", count: sharedBoards.length },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">CollabBoard</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">
              {user.displayName || user.email}
            </span>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-white text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>
          <button
            onClick={createBoard}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
          >
            + New Board
          </button>
        </div>

        {boardsLoading ? (
          <div className="text-gray-400">Loading boards...</div>
        ) : displayedBoards.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">
              {activeTab === "shared"
                ? "No boards have been shared with you yet."
                : "No boards yet. Create your first one!"}
            </p>
            {activeTab !== "shared" && (
              <button
                onClick={createBoard}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
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
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-colors cursor-pointer group"
                  onClick={() => router.push(`/board/${board.id}`)}
                >
                  <div className="h-32 bg-gray-800 rounded-lg mb-3 flex items-center justify-center">
                    <span className="text-4xl opacity-30">&#x1F5BC;</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3
                        className="text-white font-medium text-sm hover:text-blue-400 cursor-text"
                        onClick={(e) => {
                          e.stopPropagation();
                          renameBoardHandler(board.id, board.name);
                        }}
                        title="Click to rename"
                      >
                        {board.name}
                      </h3>
                      <p className="text-gray-500 text-xs mt-1">
                        {new Date(board.createdAt).toLocaleDateString()}
                        {!isOwner && (
                          <span className="ml-2 text-blue-400/70">Shared</span>
                        )}
                      </p>
                    </div>
                    {isOwner && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBoardHandler(board.id);
                        }}
                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  {/* Share link */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(
                        `${window.location.origin}/board/${board.id}`
                      );
                      alert("Board link copied to clipboard!");
                    }}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                  >
                    Copy share link
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
