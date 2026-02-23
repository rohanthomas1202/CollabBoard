"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Comment, CommentMessage } from "@/lib/types";

export function useComments(boardId: string) {
  const [comments, setComments] = useState<Comment[]>([]);

  // Real-time listener on boards/{boardId}/comments subcollection
  useEffect(() => {
    if (!boardId || !db) return;
    const colRef = collection(db, "boards", boardId, "comments");
    const unsub = onSnapshot(colRef, (snapshot) => {
      const items: Comment[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Comment[];
      // Sort newest first
      items.sort((a, b) => a.createdAt - b.createdAt);
      setComments(items);
    });
    return unsub;
  }, [boardId]);

  const addComment = useCallback(
    async (
      x: number,
      y: number,
      userId: string,
      userName: string,
      objectId?: string
    ) => {
      if (!boardId || !db) return "";
      const colRef = collection(db, "boards", boardId, "comments");
      const docRef = await addDoc(colRef, {
        x,
        y,
        objectId: objectId || null,
        resolved: false,
        messages: [],
        createdBy: userId,
        createdAt: Date.now(),
      });
      return docRef.id;
    },
    [boardId]
  );

  const addReply = useCallback(
    async (commentId: string, message: CommentMessage) => {
      if (!boardId || !db) return;
      const docRef = doc(db, "boards", boardId, "comments", commentId);
      await updateDoc(docRef, {
        messages: arrayUnion(message),
      });
    },
    [boardId]
  );

  const toggleResolved = useCallback(
    async (commentId: string) => {
      if (!boardId || !db) return;
      const comment = comments.find((c) => c.id === commentId);
      if (!comment) return;
      const docRef = doc(db, "boards", boardId, "comments", commentId);
      await updateDoc(docRef, { resolved: !comment.resolved });
    },
    [boardId, comments]
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!boardId || !db) return;
      const docRef = doc(db, "boards", boardId, "comments", commentId);
      await deleteDoc(docRef);
    },
    [boardId]
  );

  return { comments, addComment, addReply, toggleResolved, deleteComment };
}
