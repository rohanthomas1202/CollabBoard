/**
 * @jest-environment node
 */

// Mock @ai-sdk/anthropic
jest.mock("@ai-sdk/anthropic", () => ({
  anthropic: jest.fn(() => "mock-model"),
}));

// Mock next/server
jest.mock("next/server", () => ({
  after: jest.fn((cb: () => void) => cb()),
}));

// Mock instrumentation
jest.mock("@/instrumentation", () => ({
  langfuseSpanProcessor: {
    forceFlush: jest.fn(() => Promise.resolve()),
  },
}));

// Mock ai SDK
const mockStreamText = jest.fn();
jest.mock("ai", () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
  tool: jest.fn((config) => config),
  convertToModelMessages: jest.fn((msgs) => Promise.resolve(msgs)),
  stepCountIs: jest.fn((n) => n),
  UIMessage: {},
}));

import { POST, rectsOverlap, resolvePosition, OVERLAP_GAP } from "../route";

/** Helper: build a Request with the token header and JSON body */
function makeRequest(
  body: Record<string, unknown>,
  token?: string
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["x-firebase-token"] = token;
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      ANTHROPIC_API_KEY: "test-key",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "test-project",
    };
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: jest.fn(
        () => new Response("streamed", { status: 200 })
      ),
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 400 when boardId is missing", async () => {
    const res = await POST(
      makeRequest({ messages: [], userId: "user-1" }, "token-1")
    );
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toBe("Missing boardId or userId");
  });

  it("returns 400 when userId is missing", async () => {
    const res = await POST(
      makeRequest({ messages: [], boardId: "board-1" }, "token-1")
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const res = await POST(
      makeRequest(
        { messages: [], boardId: "board-1", userId: "user-1" },
        "token-1"
      )
    );
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe("ANTHROPIC_API_KEY not configured");
  });

  it("returns 401 when idToken header is missing", async () => {
    const res = await POST(
      makeRequest({ messages: [], boardId: "board-1", userId: "user-1" })
    );
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toBe("Missing authentication token");
  });

  it("calls streamText with correct model and tools", async () => {
    const res = await POST(
      makeRequest(
        {
          messages: [{ role: "user", content: "Add a sticky note" }],
          boardId: "board-1",
          userId: "user-1",
        },
        "token-1"
      )
    );
    expect(res.status).toBe(200);
    expect(mockStreamText).toHaveBeenCalledTimes(1);

    const args = mockStreamText.mock.calls[0][0];
    expect(args.model).toBe("mock-model");
    expect(args.system).toContain("AI board assistant");
    expect(args.system).toContain("createObjects");
    expect(args.system).toContain("batchMutate");
    expect(args.system).toContain("automatically prevents overlaps");
    expect(args.system).not.toContain(
      "space them out so they don't overlap"
    );
    expect(args.stopWhen).toBe(15);

    // Verify all 12 tools are defined with execute functions
    const toolNames = Object.keys(args.tools);
    expect(toolNames).toContain("getBoardState");
    expect(toolNames).toContain("createStickyNote");
    expect(toolNames).toContain("createShape");
    expect(toolNames).toContain("createTextElement");
    expect(toolNames).toContain("createFrame");
    expect(toolNames).toContain("createConnector");
    expect(toolNames).toContain("createObjects");
    expect(toolNames).toContain("moveObject");
    expect(toolNames).toContain("updateText");
    expect(toolNames).toContain("changeColor");
    expect(toolNames).toContain("deleteObject");
    expect(toolNames).toContain("batchMutate");
    expect(toolNames).toHaveLength(12);

    // Tools SHOULD have execute (server-side execution via Firestore REST API)
    for (const name of toolNames) {
      expect(typeof args.tools[name].execute).toBe("function");
    }

    // Verify Langfuse telemetry is enabled
    expect(args.experimental_telemetry).toBeDefined();
    expect(args.experimental_telemetry.isEnabled).toBe(true);
    expect(args.experimental_telemetry.functionId).toBe("collabboard-chat");
  });

  it("returns streaming response", async () => {
    const res = await POST(
      makeRequest(
        { messages: [], boardId: "board-1", userId: "user-1" },
        "token-1"
      )
    );
    expect(res.status).toBe(200);

    const streamResult = mockStreamText.mock.results[0].value;
    expect(streamResult.toUIMessageStreamResponse).toHaveBeenCalled();
  });
});

describe("rectsOverlap", () => {
  it("returns true for overlapping rects", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 50, y: 50, width: 100, height: 100 };
    expect(rectsOverlap(a, b, OVERLAP_GAP)).toBe(true);
  });

  it("returns false for rects with sufficient gap", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 125, y: 0, width: 100, height: 100 };
    expect(rectsOverlap(a, b, OVERLAP_GAP)).toBe(false);
  });

  it("returns true when gap is insufficient", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 110, y: 0, width: 100, height: 100 };
    // Only 10px gap, need 20
    expect(rectsOverlap(a, b, OVERLAP_GAP)).toBe(true);
  });

  it("returns false for rects exactly gap-apart", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 120, y: 0, width: 100, height: 100 };
    // Exactly 20px gap
    expect(rectsOverlap(a, b, OVERLAP_GAP)).toBe(false);
  });

  it("returns false for vertically separated rects", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 0, y: 200, width: 100, height: 100 };
    expect(rectsOverlap(a, b, OVERLAP_GAP)).toBe(false);
  });
});

describe("resolvePosition", () => {
  it("returns original position when no overlaps", () => {
    const proposed = { x: 0, y: 0, width: 200, height: 200 };
    const result = resolvePosition(proposed, [], OVERLAP_GAP);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it("shifts right past overlapping rect", () => {
    const proposed = { x: 0, y: 0, width: 200, height: 200 };
    const occupied = [{ x: 0, y: 0, width: 200, height: 200 }];
    const result = resolvePosition(proposed, occupied, OVERLAP_GAP);
    expect(result.x).toBe(220); // 200 + 20 gap
    expect(result.y).toBe(0);
  });

  it("jumps past multiple overlapping rects", () => {
    const proposed = { x: 0, y: 0, width: 100, height: 100 };
    const occupied = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 120, y: 0, width: 100, height: 100 },
    ];
    const result = resolvePosition(proposed, occupied, OVERLAP_GAP);
    expect(result.x).toBe(240); // past second rect: 120 + 100 + 20
    expect(result.y).toBe(0);
  });

  it("returns original position when no conflict exists", () => {
    const proposed = { x: 500, y: 500, width: 200, height: 200 };
    const occupied = [{ x: 0, y: 0, width: 100, height: 100 }];
    const result = resolvePosition(proposed, occupied, OVERLAP_GAP);
    expect(result).toEqual({ x: 500, y: 500 });
  });
});
