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
  doc,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Board } from "@/lib/types";

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Listen to user's boards
  useEffect(() => {
    if (!user) return;

    const boardsRef = collection(db, "boards");
    const q = query(
      boardsRef,
      where("ownerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const boardsList: Board[] = [];
      snapshot.forEach((d) => {
        boardsList.push({ id: d.id, ...d.data() } as Board);
      });
      setBoards(boardsList);
      setBoardsLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const createBoard = async () => {
    if (!user) return;
    const boardRef = await addDoc(collection(db, "boards"), {
      name: "Untitled Board",
      ownerId: user.uid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    router.push(`/board/${boardRef.id}`);
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
          <h2 className="text-lg font-semibold text-white">My Boards</h2>
          <button
            onClick={createBoard}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
          >
            + New Board
          </button>
        </div>

        {boardsLoading ? (
          <div className="text-gray-400">Loading boards...</div>
        ) : boards.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">No boards yet. Create your first one!</p>
            <button
              onClick={createBoard}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Create Board
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board) => (
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
                    <h3 className="text-white font-medium text-sm">{board.name}</h3>
                    <p className="text-gray-500 text-xs mt-1">
                      {new Date(board.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBoardHandler(board.id);
                    }}
                    className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                  >
                    Delete
                  </button>
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
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
