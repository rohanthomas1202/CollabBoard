import { COLORS, DEFAULT_DIMENSIONS, type BoardObject, type Board, type CursorData, type Tool, type BoardObjectType } from "../types";

describe("types", () => {
  describe("COLORS", () => {
    it("has stickyNote colors array", () => {
      expect(COLORS.stickyNote).toBeInstanceOf(Array);
      expect(COLORS.stickyNote.length).toBeGreaterThan(0);
    });

    it("has shape colors array", () => {
      expect(COLORS.shape).toBeInstanceOf(Array);
      expect(COLORS.shape.length).toBeGreaterThan(0);
    });

    it("has cursor colors array", () => {
      expect(COLORS.cursor).toBeInstanceOf(Array);
      expect(COLORS.cursor.length).toBeGreaterThan(0);
    });

    it("all colors are valid hex strings", () => {
      const allColors = [...COLORS.stickyNote, ...COLORS.shape, ...COLORS.cursor];
      allColors.forEach((color) => {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });
  });

  describe("DEFAULT_DIMENSIONS", () => {
    it("has dimensions for sticky-note", () => {
      expect(DEFAULT_DIMENSIONS["sticky-note"]).toEqual({ width: 200, height: 200 });
    });

    it("has dimensions for rectangle", () => {
      expect(DEFAULT_DIMENSIONS["rectangle"]).toEqual({ width: 200, height: 150 });
    });

    it("has dimensions for circle", () => {
      expect(DEFAULT_DIMENSIONS["circle"]).toEqual({ width: 150, height: 150 });
    });

    it("has dimensions for text", () => {
      expect(DEFAULT_DIMENSIONS["text"]).toEqual({ width: 200, height: 40 });
    });

    it("has dimensions for frame", () => {
      expect(DEFAULT_DIMENSIONS["frame"]).toEqual({ width: 400, height: 300 });
    });

    it("all dimensions have positive width and height", () => {
      Object.values(DEFAULT_DIMENSIONS).forEach((dim) => {
        expect(dim.width).toBeGreaterThan(0);
        expect(dim.height).toBeGreaterThan(0);
      });
    });
  });

  describe("type validation", () => {
    it("BoardObject can be constructed with required fields", () => {
      const obj: BoardObject = {
        id: "test-1",
        type: "rectangle",
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        color: "#3b82f6",
        rotation: 0,
        zIndex: 1,
        updatedAt: Date.now(),
        createdBy: "user-1",
      };
      expect(obj.id).toBe("test-1");
      expect(obj.type).toBe("rectangle");
    });

    it("BoardObject supports optional fields", () => {
      const obj: BoardObject = {
        id: "test-2",
        type: "connector",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        color: "#6b7280",
        rotation: 0,
        zIndex: 1,
        updatedAt: Date.now(),
        createdBy: "user-1",
        text: "Hello",
        connectedFrom: "obj-a",
        connectedTo: "obj-b",
        fontSize: 14,
      };
      expect(obj.text).toBe("Hello");
      expect(obj.connectedFrom).toBe("obj-a");
      expect(obj.connectedTo).toBe("obj-b");
      expect(obj.fontSize).toBe(14);
    });

    it("Board can be constructed", () => {
      const board: Board = {
        id: "board-1",
        name: "Test Board",
        ownerId: "user-1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(board.name).toBe("Test Board");
    });

    it("Board supports optional fields", () => {
      const board: Board = {
        id: "board-2",
        name: "Shared Board",
        ownerId: "user-1",
        sharedWith: ["user-2", "user-3"],
        thumbnail: "data:image/jpeg;base64,...",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(board.sharedWith).toHaveLength(2);
      expect(board.thumbnail).toBeDefined();
    });

    it("CursorData can be constructed", () => {
      const cursor: CursorData = {
        x: 100,
        y: 200,
        name: "Alice",
        color: "#ef4444",
        lastSeen: Date.now(),
      };
      expect(cursor.name).toBe("Alice");
    });

    it("all board object types are valid", () => {
      const validTypes: BoardObjectType[] = [
        "sticky-note",
        "rectangle",
        "circle",
        "line",
        "text",
        "frame",
        "connector",
      ];
      expect(validTypes).toHaveLength(7);
    });

    it("all tool types are valid", () => {
      const validTools: Tool[] = [
        "select",
        "pan",
        "sticky-note",
        "rectangle",
        "circle",
        "line",
        "text",
        "connector",
      ];
      expect(validTools).toHaveLength(8);
    });
  });
});
