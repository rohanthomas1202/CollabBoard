"use client";

import { useCallback, useRef, useState } from "react";
import { BoardObject, UndoEntry, UndoSubEntry } from "@/lib/types";

const MAX_HISTORY = 50;

interface UndoRedoActions {
  updateObject: (id: string, updates: Partial<BoardObject>) => Promise<void>;
  deleteObject: (id: string) => Promise<void>;
  restoreObject: (obj: BoardObject) => Promise<void>;
  batchUpdateObjects: (updates: Array<{ id: string; changes: Partial<BoardObject> }>) => Promise<void>;
  batchDeleteObjects: (ids: string[]) => Promise<void>;
}

/**
 * Local undo/redo stack (per session, current user's actions only).
 *
 * The hook does NOT mutate Firestore directly — it receives the board's
 * mutation functions and calls them when undoing/redoing. The caller wraps
 * its own mutations with `track*` helpers so entries land on the stack.
 */
export function useUndoRedo(actions: UndoRedoActions) {
  const undoStack = useRef<UndoEntry[]>([]);
  const redoStack = useRef<UndoEntry[]>([]);
  // Reactive booleans so the UI re-renders when stacks change
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // Guard against re-entrant pushes while undo/redo is executing
  const isUndoRedoing = useRef(false);

  const syncFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  /** Push an entry onto the undo stack (called by wrapped mutations). */
  const push = useCallback((entry: UndoEntry) => {
    if (isUndoRedoing.current) return;
    undoStack.current = [...undoStack.current.slice(-(MAX_HISTORY - 1)), entry];
    redoStack.current = []; // new action clears redo
    syncFlags();
  }, [syncFlags]);

  // ── Track helpers — call these instead of raw board mutations ──────

  /** Track a newly created object. */
  const trackCreate = useCallback(
    (objectId: string, obj: BoardObject) => {
      push({ type: "create", objectId, after: obj });
    },
    [push]
  );

  /** Track an update. Call BEFORE writing to Firestore so `before` has the old state. */
  const trackUpdate = useCallback(
    (before: BoardObject, after: BoardObject) => {
      push({ type: "update", objectId: before.id, before, after });
    },
    [push]
  );

  /** Track a deletion. Pass the full object so it can be restored. */
  const trackDelete = useCallback(
    (obj: BoardObject) => {
      push({ type: "delete", objectId: obj.id, before: obj });
    },
    [push]
  );

  /** Track a batch of operations as a single undoable step. */
  const trackBatch = useCallback(
    (entries: UndoSubEntry[]) => {
      if (entries.length === 0) return;
      push({ type: "batch", objectId: "__batch__", entries });
    },
    [push]
  );

  // ── Undo / Redo ───────────────────────────────────────────────────

  const undo = useCallback(async () => {
    const entry = undoStack.current[undoStack.current.length - 1];
    if (!entry) return;
    undoStack.current = undoStack.current.slice(0, -1);
    isUndoRedoing.current = true;

    try {
      switch (entry.type) {
        case "create":
          await actions.deleteObject(entry.objectId);
          break;
        case "update":
          if (entry.before) {
            const { id, ...data } = entry.before;
            await actions.updateObject(id, data);
          }
          break;
        case "delete":
          if (entry.before) {
            await actions.restoreObject(entry.before);
          }
          break;
        case "batch":
          if (entry.entries) {
            const toUpdate: Array<{ id: string; changes: Partial<BoardObject> }> = [];
            const toDelete: string[] = [];
            const toRestore: BoardObject[] = [];
            for (const sub of [...entry.entries].reverse()) {
              switch (sub.type) {
                case "create":
                  toDelete.push(sub.objectId);
                  break;
                case "update":
                  if (sub.before) {
                    const { id, ...data } = sub.before;
                    toUpdate.push({ id, changes: data });
                  }
                  break;
                case "delete":
                  if (sub.before) toRestore.push(sub.before);
                  break;
              }
            }
            if (toUpdate.length > 0) await actions.batchUpdateObjects(toUpdate);
            if (toDelete.length > 0) await actions.batchDeleteObjects(toDelete);
            for (const obj of toRestore) await actions.restoreObject(obj);
          }
          break;
      }
      redoStack.current = [...redoStack.current, entry];
    } finally {
      isUndoRedoing.current = false;
      syncFlags();
    }
  }, [actions, syncFlags]);

  const redo = useCallback(async () => {
    const entry = redoStack.current[redoStack.current.length - 1];
    if (!entry) return;
    redoStack.current = redoStack.current.slice(0, -1);
    isUndoRedoing.current = true;

    try {
      switch (entry.type) {
        case "create":
          if (entry.after) {
            await actions.restoreObject(entry.after);
          }
          break;
        case "update":
          if (entry.after) {
            const { id, ...data } = entry.after;
            await actions.updateObject(id, data);
          }
          break;
        case "delete":
          await actions.deleteObject(entry.objectId);
          break;
        case "batch":
          if (entry.entries) {
            const toUpdate: Array<{ id: string; changes: Partial<BoardObject> }> = [];
            const toDelete: string[] = [];
            const toRestore: BoardObject[] = [];
            for (const sub of entry.entries) {
              switch (sub.type) {
                case "create":
                  if (sub.after) toRestore.push(sub.after);
                  break;
                case "update":
                  if (sub.after) {
                    const { id, ...data } = sub.after;
                    toUpdate.push({ id, changes: data });
                  }
                  break;
                case "delete":
                  toDelete.push(sub.objectId);
                  break;
              }
            }
            if (toUpdate.length > 0) await actions.batchUpdateObjects(toUpdate);
            if (toDelete.length > 0) await actions.batchDeleteObjects(toDelete);
            for (const obj of toRestore) await actions.restoreObject(obj);
          }
          break;
      }
      undoStack.current = [...undoStack.current, entry];
    } finally {
      isUndoRedoing.current = false;
      syncFlags();
    }
  }, [actions, syncFlags]);

  return { undo, redo, canUndo, canRedo, trackCreate, trackUpdate, trackDelete, trackBatch };
}
