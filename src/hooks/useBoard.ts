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
  writeBatch,
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
    }, (error) => {
      console.error("Board objects listener error:", error);
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
      await setDoc(objectRef, stripUndefined({
        ...updates,
        updatedAt: Date.now(),
      }), { merge: true });
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

  // Re-create a previously deleted object with its original ID
  const restoreObject = useCallback(
    async (obj: BoardObject) => {
      const { id, ...data } = obj;
      const objectRef = doc(db, "boards", boardId, "objects", id);
      await setDoc(objectRef, stripUndefined({
        ...data,
        updatedAt: Date.now(),
      }));
    },
    [boardId]
  );

  const moveObject = useCallback(
    async (objectId: string, x: number, y: number) => {
      await updateObject(objectId, { x, y });
    },
    [updateObject]
  );

  const toggleReaction = useCallback(
    async (objectId: string, emoji: string, userId: string) => {
      const obj = objects.find((o) => o.id === objectId);
      if (!obj) return;
      const reactions = { ...(obj.reactions || {}) };
      const users = reactions[emoji] ? [...reactions[emoji]] : [];
      const idx = users.indexOf(userId);
      if (idx >= 0) {
        users.splice(idx, 1);
      } else {
        users.push(userId);
      }
      if (users.length > 0) {
        reactions[emoji] = users;
      } else {
        delete reactions[emoji];
      }
      const objectRef = doc(db, "boards", boardId, "objects", objectId);
      await updateDoc(objectRef, { reactions, updatedAt: Date.now() });
    },
    [boardId, objects]
  );

  const resizeObject = useCallback(
    async (objectId: string, width: number, height: number) => {
      await updateObject(objectId, { width, height });
    },
    [updateObject]
  );

  const batchUpdateObjects = useCallback(
    async (updates: Array<{ id: string; changes: Partial<BoardObject> }>) => {
      const now = Date.now();
      // Firestore WriteBatch supports up to 500 ops — chunk if needed
      for (let i = 0; i < updates.length; i += 450) {
        const chunk = updates.slice(i, i + 450);
        const batch = writeBatch(db);
        for (const { id, changes } of chunk) {
          const ref = doc(db, "boards", boardId, "objects", id);
          const data = stripUndefined({ ...changes, updatedAt: now } as Record<string, unknown>);
          batch.update(ref, data as { [x: string]: Partial<unknown> });
        }
        await batch.commit();
      }
    },
    [boardId]
  );

  const batchDeleteObjects = useCallback(
    async (ids: string[]) => {
      for (let i = 0; i < ids.length; i += 450) {
        const chunk = ids.slice(i, i + 450);
        const batch = writeBatch(db);
        for (const id of chunk) {
          const ref = doc(db, "boards", boardId, "objects", id);
          batch.delete(ref);
        }
        await batch.commit();
      }
    },
    [boardId]
  );

  return {
    objects,
    loading,
    addObject,
    updateObject,
    deleteObject,
    restoreObject,
    toggleReaction,
    moveObject,
    resizeObject,
    batchUpdateObjects,
    batchDeleteObjects,
  };
}
