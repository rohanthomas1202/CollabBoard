import {
  streamText,
  UIMessage,
  convertToModelMessages,
  tool,
  stepCountIs,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { randomUUID } from "crypto";
import { after } from "next/server";
import { langfuseSpanProcessor } from "@/instrumentation";

export const maxDuration = 60;

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// --- Firestore REST API value helpers ---

function toFirestoreValue(val: unknown): Record<string, unknown> {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "string") return { stringValue: val };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    return Number.isInteger(val)
      ? { integerValue: String(val) }
      : { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === "object") {
    return {
      mapValue: {
        fields: toFirestoreFields(val as Record<string, unknown>),
      },
    };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      fields[key] = toFirestoreValue(val);
    }
  }
  return fields;
}

function fromFirestoreValue(val: Record<string, unknown>): unknown {
  if ("stringValue" in val) return val.stringValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return val.doubleValue;
  if ("booleanValue" in val) return val.booleanValue;
  if ("nullValue" in val) return null;
  if ("mapValue" in val) {
    const map = val.mapValue as {
      fields: Record<string, Record<string, unknown>>;
    };
    return fromFirestoreFields(map.fields);
  }
  if ("arrayValue" in val) {
    const arr = val.arrayValue as {
      values?: Record<string, unknown>[];
    };
    return (arr.values || []).map(fromFirestoreValue);
  }
  return null;
}

function fromFirestoreFields(
  fields: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(fields || {})) {
    obj[key] = fromFirestoreValue(val);
  }
  return obj;
}

// --- Firestore REST API CRUD ---

async function firestoreCreate(
  token: string,
  boardId: string,
  docId: string,
  data: Record<string, unknown>
) {
  const url = `${FIRESTORE_BASE}/boards/${boardId}/objects?documentId=${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore create failed (${res.status}): ${text}`);
  }
}

async function firestoreUpdate(
  token: string,
  boardId: string,
  docId: string,
  data: Record<string, unknown>
) {
  const fieldPaths = Object.keys(data)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const url = `${FIRESTORE_BASE}/boards/${boardId}/objects/${encodeURIComponent(docId)}?${fieldPaths}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore update failed (${res.status}): ${text}`);
  }
}

async function firestoreDelete(
  token: string,
  boardId: string,
  docId: string
) {
  const url = `${FIRESTORE_BASE}/boards/${boardId}/objects/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore delete failed (${res.status}): ${text}`);
  }
}

async function firestoreList(token: string, boardId: string) {
  const url = `${FIRESTORE_BASE}/boards/${boardId}/objects?pageSize=500`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore list failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  const documents = (json.documents || []) as Array<{
    name: string;
    fields: Record<string, Record<string, unknown>>;
  }>;
  return documents.map((d) => {
    const id = d.name.split("/").pop()!;
    return { id, ...fromFirestoreFields(d.fields || {}) };
  });
}

// --- Route handler ---

export async function POST(req: Request) {
  // Token comes via header (injected by client's custom fetch)
  const idToken = req.headers.get("x-firebase-token") || "";
  const body = await req.json();
  const { messages, boardId, userId } = body as {
    messages: UIMessage[];
    boardId: string;
    userId: string;
  };

  if (!boardId || !userId) {
    return new Response("Missing boardId or userId", { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("ANTHROPIC_API_KEY not configured", { status: 500 });
  }

  if (!idToken) {
    return new Response("Missing authentication token", { status: 401 });
  }

  // Per-request zIndex tracker to avoid repeated list queries
  let cachedMaxZIndex: number | null = null;
  async function getNextZIndex(): Promise<number> {
    if (cachedMaxZIndex !== null) {
      return ++cachedMaxZIndex;
    }
    const objects = await firestoreList(idToken, boardId);
    const maxZ =
      objects.length === 0
        ? 0
        : Math.max(
            ...objects.map(
              (o) => ((o as Record<string, unknown>).zIndex as number) || 0
            )
          );
    cachedMaxZIndex = maxZ + 1;
    return cachedMaxZIndex;
  }

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `You are an AI board assistant for CollabBoard, a collaborative whiteboard app.
You help users create, arrange, and manipulate objects on their whiteboard.

IMPORTANT RULES:
- When creating multiple objects, space them out so they don't overlap. Use at least 20px gaps.
- Call getBoardState first when you need to understand the current layout, find objects, or plan spatial arrangements.
- Sticky note colors (pastel): #fef08a (yellow), #fed7aa (orange), #bbf7d0 (green), #bfdbfe (blue), #e9d5ff (purple), #fecdd3 (pink)
- Shape colors (vivid): #3b82f6 (blue), #ef4444 (red), #22c55e (green), #f59e0b (amber), #8b5cf6 (purple), #06b6d4 (cyan), #f97316 (orange)
- Default dimensions: sticky-note 200x200, rectangle 200x150, circle 150x150, text 200x40, frame 400x300
- For templates (SWOT, retro, journey map), use frames as containers and place sticky notes inside them.
- Always provide a brief summary of what you did after completing operations.
- When arranging in a grid, calculate positions based on object dimensions plus 20px gaps.
- Connector color default is #6b7280 (gray).
- For complex templates, create the frames first, then add sticky notes inside each frame.`,
    messages: await convertToModelMessages(messages),
    tools: {
      getBoardState: tool({
        description:
          "Get all objects currently on the board. Call this first when you need to understand the current layout, find objects by text content, or plan spatial arrangements.",
        inputSchema: z.object({}),
        execute: async () => {
          const objects = await firestoreList(idToken, boardId);
          return {
            objectCount: objects.length,
            objects: objects.map((o: Record<string, unknown>) => ({
              id: o.id,
              type: o.type,
              x: o.x,
              y: o.y,
              width: o.width,
              height: o.height,
              text: o.text || null,
              color: o.color,
            })),
          };
        },
      }),

      createStickyNote: tool({
        description:
          "Create a sticky note on the board. Use for ideas, labels, tasks, or any text content. Default size is 200x200.",
        inputSchema: z.object({
          text: z.string().describe("The text content of the sticky note"),
          x: z.number().describe("X position on the canvas"),
          y: z.number().describe("Y position on the canvas"),
          color: z
            .string()
            .optional()
            .describe(
              "Hex color. Options: #fef08a (yellow), #fed7aa (orange), #bbf7d0 (green), #bfdbfe (blue), #e9d5ff (purple), #fecdd3 (pink). Default: #fef08a"
            ),
          width: z
            .number()
            .optional()
            .describe("Width in pixels. Default: 200"),
          height: z
            .number()
            .optional()
            .describe("Height in pixels. Default: 200"),
        }),
        execute: async ({ text, x, y, color, width, height }) => {
          const zIndex = await getNextZIndex();
          const id = randomUUID();
          await firestoreCreate(idToken, boardId, id, {
            type: "sticky-note",
            x,
            y,
            width: width ?? 200,
            height: height ?? 200,
            text,
            color: color ?? "#fef08a",
            rotation: 0,
            zIndex,
            fontSize: 16,
            updatedAt: Date.now(),
            createdBy: userId,
          });
          return { id, status: "created" };
        },
      }),

      createShape: tool({
        description:
          "Create a geometric shape (rectangle or circle) on the board.",
        inputSchema: z.object({
          type: z.enum(["rectangle", "circle"]).describe("Shape type"),
          x: z.number().describe("X position"),
          y: z.number().describe("Y position"),
          width: z
            .number()
            .optional()
            .describe(
              "Width. Default: 200 for rectangle, 150 for circle"
            ),
          height: z
            .number()
            .optional()
            .describe(
              "Height. Default: 150 for rectangle, 150 for circle"
            ),
          color: z
            .string()
            .optional()
            .describe(
              "Hex color. Options: #3b82f6 (blue), #ef4444 (red), #22c55e (green), #f59e0b (amber), #8b5cf6 (purple), #06b6d4 (cyan), #f97316 (orange)"
            ),
          text: z
            .string()
            .optional()
            .describe("Optional text label inside the shape"),
        }),
        execute: async ({ type, x, y, width, height, color, text }) => {
          const defaults =
            type === "rectangle"
              ? { width: 200, height: 150 }
              : { width: 150, height: 150 };
          const zIndex = await getNextZIndex();
          const id = randomUUID();
          await firestoreCreate(idToken, boardId, id, {
            type,
            x,
            y,
            width: width ?? defaults.width,
            height: height ?? defaults.height,
            color: color ?? "#3b82f6",
            text,
            rotation: 0,
            zIndex,
            fontSize: 16,
            updatedAt: Date.now(),
            createdBy: userId,
          });
          return { id, status: "created" };
        },
      }),

      createTextElement: tool({
        description:
          "Create a free text label on the board. Use for headings, annotations, or labels.",
        inputSchema: z.object({
          text: z.string().describe("The text content"),
          x: z.number().describe("X position"),
          y: z.number().describe("Y position"),
          color: z
            .string()
            .optional()
            .describe("Text color hex. Default: #e8eaed"),
          fontSize: z
            .number()
            .optional()
            .describe("Font size. Default: 20"),
        }),
        execute: async ({ text, x, y, color, fontSize }) => {
          const zIndex = await getNextZIndex();
          const id = randomUUID();
          await firestoreCreate(idToken, boardId, id, {
            type: "text",
            x,
            y,
            width: Math.max(200, text.length * 12),
            height: 40,
            text,
            color: color ?? "#e8eaed",
            rotation: 0,
            zIndex,
            fontSize: fontSize ?? 20,
            updatedAt: Date.now(),
            createdBy: userId,
          });
          return { id, status: "created" };
        },
      }),

      createFrame: tool({
        description:
          "Create a frame container on the board. Use to visually group related elements, like sections in a template.",
        inputSchema: z.object({
          title: z.string().describe("Frame title text"),
          x: z.number().describe("X position"),
          y: z.number().describe("Y position"),
          width: z
            .number()
            .optional()
            .describe("Width. Default: 400"),
          height: z
            .number()
            .optional()
            .describe("Height. Default: 300"),
        }),
        execute: async ({ title, x, y, width, height }) => {
          const zIndex = await getNextZIndex();
          const id = randomUUID();
          await firestoreCreate(idToken, boardId, id, {
            type: "frame",
            x,
            y,
            width: width ?? 400,
            height: height ?? 300,
            text: title,
            color: "#4b5563",
            rotation: 0,
            zIndex,
            updatedAt: Date.now(),
            createdBy: userId,
          });
          return { id, status: "created" };
        },
      }),

      createConnector: tool({
        description:
          "Create a visual connector (arrow) between two existing objects on the board.",
        inputSchema: z.object({
          fromId: z.string().describe("ID of the source object"),
          toId: z.string().describe("ID of the target object"),
          color: z
            .string()
            .optional()
            .describe("Connector color. Default: #6b7280"),
        }),
        execute: async ({ fromId, toId, color }) => {
          const zIndex = await getNextZIndex();
          const id = randomUUID();
          await firestoreCreate(idToken, boardId, id, {
            type: "connector",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            color: color ?? "#6b7280",
            rotation: 0,
            zIndex,
            connectedFrom: fromId,
            connectedTo: toId,
            updatedAt: Date.now(),
            createdBy: userId,
          });
          return { id, status: "created" };
        },
      }),

      moveObject: tool({
        description: "Move an existing object to a new position.",
        inputSchema: z.object({
          objectId: z.string().describe("ID of the object to move"),
          x: z.number().describe("New X position"),
          y: z.number().describe("New Y position"),
        }),
        execute: async ({ objectId, x, y }) => {
          try {
            await firestoreUpdate(idToken, boardId, objectId, {
              x,
              y,
              updatedAt: Date.now(),
            });
            return { objectId, status: "moved", x, y };
          } catch {
            return { objectId, status: "error", message: "Object not found" };
          }
        },
      }),

      updateText: tool({
        description:
          "Update the text content of an existing object (sticky note, shape, text, or frame).",
        inputSchema: z.object({
          objectId: z.string().describe("ID of the object"),
          text: z.string().describe("New text content"),
        }),
        execute: async ({ objectId, text }) => {
          try {
            await firestoreUpdate(idToken, boardId, objectId, {
              text,
              updatedAt: Date.now(),
            });
            return { objectId, status: "updated" };
          } catch {
            return { objectId, status: "error", message: "Object not found" };
          }
        },
      }),

      changeColor: tool({
        description: "Change the color of an existing object.",
        inputSchema: z.object({
          objectId: z.string().describe("ID of the object"),
          color: z.string().describe("New hex color value"),
        }),
        execute: async ({ objectId, color }) => {
          try {
            await firestoreUpdate(idToken, boardId, objectId, {
              color,
              updatedAt: Date.now(),
            });
            return { objectId, status: "color changed" };
          } catch {
            return { objectId, status: "error", message: "Object not found" };
          }
        },
      }),

      deleteObject: tool({
        description: "Delete an object from the board.",
        inputSchema: z.object({
          objectId: z.string().describe("ID of the object to delete"),
        }),
        execute: async ({ objectId }) => {
          try {
            await firestoreDelete(idToken, boardId, objectId);
            return { objectId, status: "deleted" };
          } catch {
            return { objectId, status: "error", message: "Object not found" };
          }
        },
      }),
    },
    stopWhen: stepCountIs(15),
    experimental_telemetry: {
      isEnabled: true,
      functionId: "collabboard-chat",
      metadata: {
        userId,
        boardId,
        langfuseSessionId: `board-${boardId}`,
        langfuseUserId: userId,
      },
    },
  });

  after(async () => {
    await langfuseSpanProcessor.forceFlush();
  });

  return result.toUIMessageStreamResponse();
}
