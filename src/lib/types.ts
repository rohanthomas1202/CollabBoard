export type BoardObjectType =
  | "sticky-note"
  | "rectangle"
  | "circle"
  | "line"
  | "text"
  | "frame"
  | "connector"
  | "freehand";

export interface BoardObject {
  id: string;
  type: BoardObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  color: string;
  rotation: number;
  zIndex: number;
  connectedFrom?: string;
  connectedTo?: string;
  fontSize?: number;
  points?: number[];
  strokeWidth?: number;
  reactions?: Record<string, string[]>; // emoji → userId[]
  votes?: Record<string, number>; // userId → vote count
  updatedAt: number;
  createdBy: string;
}

export interface Board {
  id: string;
  name: string;
  ownerId: string;
  sharedWith?: string[];
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CursorData {
  x: number;
  y: number;
  name: string;
  color: string;
  lastSeen: number;
  message?: string;
  messageTimestamp?: number;
}

export interface PresenceData {
  [userId: string]: CursorData;
}

export interface UndoSubEntry {
  type: "create" | "update" | "delete";
  objectId: string;
  before?: BoardObject;
  after?: BoardObject;
}

export interface UndoEntry {
  type: "create" | "update" | "delete" | "batch";
  objectId: string;
  before?: BoardObject;
  after?: BoardObject;
  entries?: UndoSubEntry[];
}

export type Tool =
  | "select"
  | "pan"
  | "sticky-note"
  | "rectangle"
  | "circle"
  | "line"
  | "text"
  | "connector"
  | "freehand"
  | "comment";

export interface CommentMessage {
  userId: string;
  userName: string;
  text: string;
  createdAt: number;
}

export interface Comment {
  id: string;
  x: number;
  y: number;
  objectId?: string;
  resolved: boolean;
  messages: CommentMessage[];
  createdBy: string;
  createdAt: number;
}

export const COLORS = {
  stickyNote: ["#fef08a", "#fed7aa", "#bbf7d0", "#bfdbfe", "#e9d5ff", "#fecdd3"],
  shape: ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#f97316"],
  cursor: ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"],
};

export const DEFAULT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "sticky-note": { width: 200, height: 200 },
  rectangle: { width: 200, height: 150 },
  circle: { width: 150, height: 150 },
  text: { width: 200, height: 40 },
  frame: { width: 400, height: 300 },
};
