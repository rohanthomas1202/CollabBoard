"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ref,
  onValue,
  set,
  onDisconnect,
  remove,
  serverTimestamp,
} from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { CursorData, COLORS } from "@/lib/types";
import { CURSOR_THROTTLE_MS } from "@/lib/constants";

export function usePresence(boardId: string, userId: string, userName: string) {
  const [cursors, setCursors] = useState<Record<string, CursorData>>({});
  const lastUpdateRef = useRef(0);
  const colorRef = useRef(
    COLORS.cursor[Math.abs(hashCode(userId)) % COLORS.cursor.length]
  );

  // Listen to all cursors on this board
  useEffect(() => {
    if (!boardId || !userId) return;

    const presenceRef = ref(rtdb, `presence/${boardId}`);

    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val() || {};
      // Remove our own cursor from the list
      const others: Record<string, CursorData> = {};
      Object.entries(data).forEach(([uid, cursor]) => {
        if (uid !== userId) {
          others[uid] = cursor as CursorData;
        }
      });
      setCursors(others);
    });

    // Set up our presence and clean up on disconnect
    const myRef = ref(rtdb, `presence/${boardId}/${userId}`);
    set(myRef, {
      name: userName || "Anonymous",
      color: colorRef.current,
      x: 0,
      y: 0,
      lastSeen: Date.now(),
    });
    onDisconnect(myRef).remove();

    return () => {
      unsubscribe();
      remove(myRef);
    };
  }, [boardId, userId, userName]);

  // Throttled cursor position update
  const updateCursor = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < CURSOR_THROTTLE_MS) return;
      lastUpdateRef.current = now;

      const myRef = ref(rtdb, `presence/${boardId}/${userId}`);
      set(myRef, {
        name: userName || "Anonymous",
        color: colorRef.current,
        x,
        y,
        lastSeen: Date.now(),
      });
    },
    [boardId, userId, userName]
  );

  return { cursors, updateCursor, myColor: colorRef.current };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}
