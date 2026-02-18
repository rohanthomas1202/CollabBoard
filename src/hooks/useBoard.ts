"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BoardObject } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

// Strip undefined values — Firestore rejects them
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

export function useBoard(boardId: string) {
  const [objects, setObjects] = useState<BoardObject[]>([]);
  const [loading, setLoading] = useState(true);

  // Listen to all objects in the board
  useEffect(() => {
    if (!boardId) return;

    const objectsRef = collection(db, "boards", boardId, "objects");
    const q = query(objectsRef, orderBy("zIndex", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const objs: BoardObject[] = [];
      snapshot.forEach((doc) => {
        objs.push({ id: doc.id, ...doc.data() } as BoardObject);
      });
      setObjects(objs);
      setLoading(false);
    });

    return unsubscribe;
  }, [boardId]);

  const addObject = useCallback(
    async (obj: Omit<BoardObject, "id" | "updatedAt">) => {
      const id = uuidv4();
      const objectRef = doc(db, "boards", boardId, "objects", id);
      await setDoc(objectRef, stripUndefined({
        ...obj,
        updatedAt: Date.now(),
      }));
      return id;
    },
    [boardId]
  );

  const updateObject = useCallback(
    async (objectId: string, updates: Partial<BoardObject>) => {
      const objectRef = doc(db, "boards", boardId, "objects", objectId);
      await updateDoc(objectRef, stripUndefined({
        ...updates,
        updatedAt: Date.now(),
      }));
    },
    [boardId]
  );

  const deleteObject = useCallback(
    async (objectId: string) => {
      const objectRef = doc(db, "boards", boardId, "objects", objectId);
      await deleteDoc(objectRef);
    },
    [boardId]
  );

  const moveObject = useCallback(
    async (objectId: string, x: number, y: number) => {
      await updateObject(objectId, { x, y });
    },
    [updateObject]
  );

  const resizeObject = useCallback(
    async (objectId: string, width: number, height: number) => {
      await updateObject(objectId, { width, height });
    },
    [updateObject]
  );

  return {
    objects,
    loading,
    addObject,
    updateObject,
    deleteObject,
    moveObject,
    resizeObject,
  };
}
