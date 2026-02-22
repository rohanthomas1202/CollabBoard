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

// --- Overlap prevention ---

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const OVERLAP_GAP = 20;

export function rectsOverlap(a: Rect, b: Rect, gap: number): boolean {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

export function resolvePosition(
  proposed: Rect,
  occupied: Rect[],
  gap: number
): { x: number; y: number } {
  if (!occupied.some((o) => rectsOverlap(proposed, o, gap))) {
    return { x: proposed.x, y: proposed.y };
  }
  let cx = proposed.x;
  let cy = proposed.y;
  for (let i = 0; i < 200; i++) {
    const c = { x: cx, y: cy, width: proposed.width, height: proposed.height };
    if (!occupied.some((o) => rectsOverlap(c, o, gap))) {
      return { x: cx, y: cy };
    }
    let maxRight = cx;
    for (const o of occupied) {
      if (rectsOverlap(c, o, gap)) {
        maxRight = Math.max(maxRight, o.x + o.width + gap);
      }
    }
    cx = maxRight;
    if (cx - proposed.x > 5000) {
      cx = proposed.x;
      cy += proposed.height + gap;
    }
  }
  return { x: cx, y: cy };
}

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
  data: Record<string, unknown>,
  signal?: AbortSignal
) {
  const url = `${FIRESTORE_BASE}/boards/${boardId}/objects?documentId=${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
    signal,
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
  data: Record<string, unknown>,
  signal?: AbortSignal
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
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore update failed (${res.status}): ${text}`);
  }
}

async function firestoreDelete(
  token: string,
  boardId: string,
  docId: string,
  signal?: AbortSignal
) {
  const url = `${FIRESTORE_BASE}/boards/${boardId}/objects/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore delete failed (${res.status}): ${text}`);
  }
}

async function firestoreList(token: string, boardId: string, signal?: AbortSignal) {
  const url = `${FIRESTORE_BASE}/boards/${boardId}/objects?pageSize=500`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
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

  const signal = req.signal;

  // Per-request caches — single firestoreList call shared by zIndex and overlap
  let cachedObjects: Array<Record<string, unknown>> | null = null;
  let cachedMaxZIndex: number | null = null;
  const occupiedFrames: Rect[] = [];
  const occupiedNonFrames: Rect[] = [];
  let occupiedInitialized = false;

  async function getCachedObjects(): Promise<Array<Record<string, unknown>>> {
    if (cachedObjects !== null) return cachedObjects;
    cachedObjects = (await firestoreList(
      idToken,
      boardId,
      signal
    )) as Array<Record<string, unknown>>;
    return cachedObjects;
  }

  async function getNextZIndex(): Promise<number> {
    if (cachedMaxZIndex !== null) return ++cachedMaxZIndex;
    const objects = await getCachedObjects();
    const maxZ =
      objects.length === 0
        ? 0
        : Math.max(...objects.map((o) => (o.zIndex as number) || 0));
    cachedMaxZIndex = maxZ + 1;
    return cachedMaxZIndex;
  }

  async function allocateZIndices(count: number): Promise<number> {
    if (cachedMaxZIndex === null) {
      const objects = await getCachedObjects();
      const maxZ =
        objects.length === 0
          ? 0
          : Math.max(...objects.map((o) => (o.zIndex as number) || 0));
      cachedMaxZIndex = maxZ;
    }
    const startZ = cachedMaxZIndex + 1;
    cachedMaxZIndex += count;
    return startZ;
  }

  async function initOccupied(): Promise<void> {
    if (occupiedInitialized) return;
    const objects = await getCachedObjects();
    for (const o of objects) {
      if (o.type === "connector") continue;
      const rect: Rect = {
        x: (o.x as number) || 0,
        y: (o.y as number) || 0,
        width: (o.width as number) || 0,
        height: (o.height as number) || 0,
      };
      if (o.type === "frame") {
        occupiedFrames.push(rect);
      } else {
        occupiedNonFrames.push(rect);
      }
    }
    occupiedInitialized = true;
  }

  async function adjustPosition(
    x: number,
    y: number,
    w: number,
    h: number,
    objectType: string
  ): Promise<{ x: number; y: number }> {
    await initOccupied();
    // Frames check against other frames; non-frames check against non-frames
    const occupied = objectType === "frame" ? occupiedFrames : occupiedNonFrames;
    const pos = resolvePosition({ x, y, width: w, height: h }, occupied, OVERLAP_GAP);
    // Register so subsequent creates in same request see this object
    occupied.push({ x: pos.x, y: pos.y, width: w, height: h });
    return pos;
  }

  const result = streamText({
    abortSignal: req.signal,
    model: anthropic("claude-sonnet-4-20250514"),
    system: `You are an AI board assistant for CollabBoard, a collaborative whiteboard app.
You help users create, arrange, and manipulate objects on their whiteboard.

IMPORTANT RULES:
- The server automatically prevents overlaps (20px gap). Just provide approximate positions for your intended layout.
- Call getBoardState only when you need to find existing objects or reference their IDs. Pass objectTypes to filter and reduce response size.
- Sticky note colors (pastel): #fef08a (yellow), #fed7aa (orange), #bbf7d0 (green), #bfdbfe (blue), #e9d5ff (purple), #fecdd3 (pink)
- Shape colors (vivid): #3b82f6 (blue), #ef4444 (red), #22c55e (green), #f59e0b (amber), #8b5cf6 (purple), #06b6d4 (cyan), #f97316 (orange)
- Default dimensions: sticky-note 200x200, rectangle 200x150, circle 150x150, text 200x40, frame 400x300
- For templates (SWOT, retro, journey map), use frames as containers and place sticky notes inside them.
- Always provide a brief summary of what you did after completing operations.
- Connector color default is #6b7280 (gray). Arrows automatically start/end at shape edges (not centers), so they look clean in flowcharts.
- For flowcharts: use rectangles for process steps, circles or rectangles for start/end, and connectors for arrows. Layout shapes vertically with ~100px gaps. The AI-created connectors will render edge-to-edge automatically.
- For complex templates, create the frames first, then add sticky notes inside each frame.
- ALWAYS prefer createObjects over individual create tools when making 2 or more objects. This is significantly faster.
- ALWAYS prefer batchMutate over individual moveObject/updateText/changeColor/deleteObject when modifying 2 or more objects.
- After batch-creating objects, use the returned IDs to create connectors. You can create multiple connectors in sequence.`,
    messages: await convertToModelMessages(messages),
    tools: {
      getBoardState: tool({
        description:
          "Get objects on the board. Pass objectTypes to filter and reduce response size. Call when you need to find existing objects or reference their IDs.",
        inputSchema: z.object({
          objectTypes: z
            .array(
              z.enum([
                "sticky-note",
                "rectangle",
                "circle",
                "text",
                "frame",
                "connector",
              ])
            )
            .optional()
            .describe(
              "Only return these types. Omit for all objects."
            ),
        }),
        execute: async ({ objectTypes }) => {
          const objects = await firestoreList(idToken, boardId, signal);
          const filtered = objectTypes
            ? objects.filter((o: Record<string, unknown>) =>
                (objectTypes as string[]).includes(o.type as string)
              )
            : objects;
          return {
            objectCount: filtered.length,
            objects: filtered.map((o: Record<string, unknown>) => ({
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
          const w = width ?? 200;
          const h = height ?? 200;
          const pos = await adjustPosition(x, y, w, h, "sticky-note");
          const zIndex = await getNextZIndex();
          const id = randomUUID();
          await firestoreCreate(idToken, boardId, id, {
            type: "sticky-note",
            x: pos.x,
            y: pos.y,
            width: w,
            height: h,
            text,
            color: color ?? "#fef08a",
            rotation: 0,
            zIndex,
            fontSize: 16,
            updatedAt: Date.now(),
            createdBy: userId,
          }, signal);
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
          const w = width ?? defaults.width;
          const h = height ?? defaults.height;
          const pos = await adjustPosition(x, y, w, h, type);
          const zIndex = await getNextZIndex();
          const id = randomUUID();
          await firestoreCreate(idToken, boardId, id, {
            type,
            x: pos.x,
            y: pos.y,
            width: w,
            height: h,
            color: color ?? "#3b82f6",
            text,
            rotation: 0,
            zIndex,
            fontSize: 16,
            updatedAt: Date.now(),
            createdBy: userId,
          }, signal);
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
          const w = Math.max(200, text.length * 12);
          const h = 40;
          const pos = await adjustPosition(x, y, w, h, "text");
          const zIndex = await getNextZIndex();
          const id = randomUUID();
          await firestoreCreate(idToken, boardId, id, {
            type: "text",
            x: pos.x,
            y: pos.y,
            width: w,
            height: h,
            text,
            color: color ?? "#e8eaed",
            rotation: 0,
            zIndex,
            fontSize: fontSize ?? 20,
            updatedAt: Date.now(),
            createdBy: userId,
          }, signal);
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
          const w = width ?? 400;
          const h = height ?? 300;
          const pos = await adjustPosition(x, y, w, h, "frame");
          const zIndex = await getNextZIndex();
          const id = randomUUID();
          await firestoreCreate(idToken, boardId, id, {
            type: "frame",
            x: pos.x,
            y: pos.y,
            width: w,
            height: h,
            text: title,
            color: "#4b5563",
            rotation: 0,
            zIndex,
            updatedAt: Date.now(),
            createdBy: userId,
          }, signal);
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
          }, signal);
          return { id, status: "created" };
        },
      }),

      createObjects: tool({
        description:
          "Create multiple objects on the board in a single operation. Use this instead of calling individual create tools when making 2 or more objects. Supports sticky notes, shapes, text elements, and frames.",
        inputSchema: z.object({
          objects: z
            .array(
              z.union([
                z.object({
                  type: z.literal("sticky-note"),
                  text: z.string().describe("Sticky note text content"),
                  x: z.number().describe("X position"),
                  y: z.number().describe("Y position"),
                  color: z.string().optional().describe("Hex color. Default: #fef08a"),
                  width: z.number().optional().describe("Width. Default: 200"),
                  height: z.number().optional().describe("Height. Default: 200"),
                }),
                z.object({
                  type: z.literal("rectangle"),
                  x: z.number().describe("X position"),
                  y: z.number().describe("Y position"),
                  width: z.number().optional().describe("Width. Default: 200"),
                  height: z.number().optional().describe("Height. Default: 150"),
                  color: z.string().optional().describe("Hex color. Default: #3b82f6"),
                  text: z.string().optional().describe("Optional text label"),
                }),
                z.object({
                  type: z.literal("circle"),
                  x: z.number().describe("X position"),
                  y: z.number().describe("Y position"),
                  width: z.number().optional().describe("Width. Default: 150"),
                  height: z.number().optional().describe("Height. Default: 150"),
                  color: z.string().optional().describe("Hex color. Default: #3b82f6"),
                  text: z.string().optional().describe("Optional text label"),
                }),
                z.object({
                  type: z.literal("text"),
                  text: z.string().describe("Text content"),
                  x: z.number().describe("X position"),
                  y: z.number().describe("Y position"),
                  color: z.string().optional().describe("Text color. Default: #e8eaed"),
                  fontSize: z.number().optional().describe("Font size. Default: 20"),
                }),
                z.object({
                  type: z.literal("frame"),
                  title: z.string().describe("Frame title"),
                  x: z.number().describe("X position"),
                  y: z.number().describe("Y position"),
                  width: z.number().optional().describe("Width. Default: 400"),
                  height: z.number().optional().describe("Height. Default: 300"),
                }),
              ])
            )
            .min(1)
            .max(500)
            .describe("Array of objects to create (max 500)"),
        }),
        execute: async ({ objects }) => {
          const startZ = await allocateZIndices(objects.length);
          const now = Date.now();
          const results: Array<{ id: string; type: string }> = [];
          const createPromises: Array<Promise<void>> = [];

          for (let i = 0; i < objects.length; i++) {
            if (signal.aborted) break;
            const obj = objects[i];
            const id = randomUUID();
            const zIndex = startZ + i;
            let data: Record<string, unknown>;

            switch (obj.type) {
              case "sticky-note": {
                const w = obj.width ?? 200;
                const h = obj.height ?? 200;
                const pos = await adjustPosition(obj.x, obj.y, w, h, "sticky-note");
                data = {
                  type: "sticky-note",
                  x: pos.x, y: pos.y, width: w, height: h,
                  text: obj.text, color: obj.color ?? "#fef08a",
                  rotation: 0, zIndex, fontSize: 16,
                  updatedAt: now, createdBy: userId,
                };
                break;
              }
              case "rectangle": {
                const w = obj.width ?? 200;
                const h = obj.height ?? 150;
                const pos = await adjustPosition(obj.x, obj.y, w, h, "rectangle");
                data = {
                  type: "rectangle",
                  x: pos.x, y: pos.y, width: w, height: h,
                  color: obj.color ?? "#3b82f6", text: obj.text ?? "",
                  rotation: 0, zIndex, fontSize: 16,
                  updatedAt: now, createdBy: userId,
                };
                break;
              }
              case "circle": {
                const w = obj.width ?? 150;
                const h = obj.height ?? 150;
                const pos = await adjustPosition(obj.x, obj.y, w, h, "circle");
                data = {
                  type: "circle",
                  x: pos.x, y: pos.y, width: w, height: h,
                  color: obj.color ?? "#3b82f6", text: obj.text ?? "",
                  rotation: 0, zIndex, fontSize: 16,
                  updatedAt: now, createdBy: userId,
                };
                break;
              }
              case "text": {
                const w = Math.max(200, obj.text.length * 12);
                const h = 40;
                const pos = await adjustPosition(obj.x, obj.y, w, h, "text");
                data = {
                  type: "text",
                  x: pos.x, y: pos.y, width: w, height: h,
                  text: obj.text, color: obj.color ?? "#e8eaed",
                  rotation: 0, zIndex, fontSize: obj.fontSize ?? 20,
                  updatedAt: now, createdBy: userId,
                };
                break;
              }
              case "frame": {
                const w = obj.width ?? 400;
                const h = obj.height ?? 300;
                const pos = await adjustPosition(obj.x, obj.y, w, h, "frame");
                data = {
                  type: "frame",
                  x: pos.x, y: pos.y, width: w, height: h,
                  text: obj.title, color: "#4b5563",
                  rotation: 0, zIndex,
                  updatedAt: now, createdBy: userId,
                };
                break;
              }
            }

            createPromises.push(firestoreCreate(idToken, boardId, id, data, signal));
            results.push({ id, type: obj.type });
          }

          await Promise.all(createPromises);
          return { created: results.length, objects: results };
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
            }, signal);
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
            }, signal);
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
            }, signal);
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
            await firestoreDelete(idToken, boardId, objectId, signal);
            return { objectId, status: "deleted" };
          } catch {
            return { objectId, status: "error", message: "Object not found" };
          }
        },
      }),

      batchMutate: tool({
        description:
          "Perform multiple mutations on existing board objects in a single operation. Supports moving, updating text, changing color, and deleting. Use this instead of calling individual mutation tools when modifying 2 or more objects.",
        inputSchema: z.object({
          operations: z
            .array(
              z.union([
                z.object({
                  action: z.literal("move"),
                  objectId: z.string().describe("ID of the object to move"),
                  x: z.number().describe("New X position"),
                  y: z.number().describe("New Y position"),
                }),
                z.object({
                  action: z.literal("updateText"),
                  objectId: z.string().describe("ID of the object"),
                  text: z.string().describe("New text content"),
                }),
                z.object({
                  action: z.literal("changeColor"),
                  objectId: z.string().describe("ID of the object"),
                  color: z.string().describe("New hex color value"),
                }),
                z.object({
                  action: z.literal("delete"),
                  objectId: z.string().describe("ID of the object to delete"),
                }),
              ])
            )
            .min(1)
            .max(500)
            .describe("Array of mutation operations (max 500)"),
        }),
        execute: async ({ operations }) => {
          const now = Date.now();
          const results = await Promise.all(
            operations.map(async (op) => {
              if (signal.aborted) return { objectId: op.objectId, action: op.action, status: "aborted" };
              try {
                switch (op.action) {
                  case "move":
                    await firestoreUpdate(idToken, boardId, op.objectId, {
                      x: op.x, y: op.y, updatedAt: now,
                    }, signal);
                    return { objectId: op.objectId, action: "moved", status: "ok" };
                  case "updateText":
                    await firestoreUpdate(idToken, boardId, op.objectId, {
                      text: op.text, updatedAt: now,
                    }, signal);
                    return { objectId: op.objectId, action: "textUpdated", status: "ok" };
                  case "changeColor":
                    await firestoreUpdate(idToken, boardId, op.objectId, {
                      color: op.color, updatedAt: now,
                    }, signal);
                    return { objectId: op.objectId, action: "colorChanged", status: "ok" };
                  case "delete":
                    await firestoreDelete(idToken, boardId, op.objectId, signal);
                    return { objectId: op.objectId, action: "deleted", status: "ok" };
                }
              } catch {
                return { objectId: op.objectId, action: op.action, status: "error", message: "Object not found" };
              }
            })
          );
          return { processed: results.length, results };
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
