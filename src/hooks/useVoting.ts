"use client";

import { useState, useCallback, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BoardObject } from "@/lib/types";

const DEFAULT_VOTES_PER_USER = 3;

export function useVoting(
  boardId: string,
  userId: string,
  objects: BoardObject[]
) {
  const [votingEnabled, setVotingEnabled] = useState(false);
  const [votesPerUser, setVotesPerUser] = useState(DEFAULT_VOTES_PER_USER);

  // Count how many votes the current user has cast across all objects
  const votesUsed = useMemo(() => {
    if (!votingEnabled) return 0;
    return objects.reduce((sum, obj) => {
      if (!obj.votes) return sum;
      return sum + (obj.votes[userId] || 0);
    }, 0);
  }, [objects, userId, votingEnabled]);

  const votesRemaining = votesPerUser - votesUsed;

  const toggleVoting = useCallback(() => {
    setVotingEnabled((v) => !v);
  }, []);

  const castVote = useCallback(
    async (objectId: string) => {
      if (!votingEnabled || votesRemaining <= 0) return;
      const obj = objects.find((o) => o.id === objectId);
      if (!obj) return;
      // Don't vote on connectors or lines
      if (obj.type === "connector" || obj.type === "line") return;

      const votes = { ...(obj.votes || {}) };
      votes[userId] = (votes[userId] || 0) + 1;

      const objectRef = doc(db, "boards", boardId, "objects", objectId);
      await updateDoc(objectRef, { votes, updatedAt: Date.now() });
    },
    [boardId, userId, objects, votingEnabled, votesRemaining]
  );

  const removeVote = useCallback(
    async (objectId: string) => {
      if (!votingEnabled) return;
      const obj = objects.find((o) => o.id === objectId);
      if (!obj || !obj.votes?.[userId]) return;

      const votes = { ...(obj.votes || {}) };
      votes[userId] = Math.max(0, (votes[userId] || 0) - 1);
      if (votes[userId] === 0) delete votes[userId];

      const objectRef = doc(db, "boards", boardId, "objects", objectId);
      await updateDoc(objectRef, { votes, updatedAt: Date.now() });
    },
    [boardId, userId, objects, votingEnabled]
  );

  const clearAllVotes = useCallback(async () => {
    const updates = objects
      .filter((o) => o.votes && Object.keys(o.votes).length > 0)
      .map((o) => {
        const objectRef = doc(db, "boards", boardId, "objects", o.id);
        return updateDoc(objectRef, { votes: {}, updatedAt: Date.now() });
      });
    await Promise.all(updates);
  }, [boardId, objects]);

  // Total votes per object (all users combined)
  const getObjectVoteCount = useCallback(
    (objectId: string): number => {
      const obj = objects.find((o) => o.id === objectId);
      if (!obj?.votes) return 0;
      return Object.values(obj.votes).reduce((sum, n) => sum + n, 0);
    },
    [objects]
  );

  // Current user's votes on a specific object
  const getUserVoteCount = useCallback(
    (objectId: string): number => {
      const obj = objects.find((o) => o.id === objectId);
      if (!obj?.votes) return 0;
      return obj.votes[userId] || 0;
    },
    [objects, userId]
  );

  return {
    votingEnabled,
    votesPerUser,
    votesRemaining,
    toggleVoting,
    setVotesPerUser,
    castVote,
    removeVote,
    clearAllVotes,
    getObjectVoteCount,
    getUserVoteCount,
  };
}
