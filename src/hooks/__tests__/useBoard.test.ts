import { renderHook, act } from "@testing-library/react";

const mockOnSnapshot = jest.fn();
const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockQuery = jest.fn();
const mockOrderBy = jest.fn();

jest.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: jest.fn(),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
}));

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

jest.mock("uuid", () => ({
  v4: () => "mock-uuid-1234",
}));

import { useBoard } from "../useBoard";

describe("useBoard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSnapshot.mockImplementation((_query, callback) => {
      callback({
        forEach: jest.fn(),
      });
      return jest.fn();
    });
    mockCollection.mockReturnValue("collection-ref");
    mockDoc.mockReturnValue("doc-ref");
    mockQuery.mockReturnValue("query-ref");
    mockOrderBy.mockReturnValue("order-ref");
  });

  it("starts with loading true and empty objects", () => {
    mockOnSnapshot.mockImplementation(() => jest.fn());
    const { result } = renderHook(() => useBoard("board-1"));
    expect(result.current.loading).toBe(true);
    expect(result.current.objects).toEqual([]);
  });

  it("sets loading to false after snapshot arrives", () => {
    const { result } = renderHook(() => useBoard("board-1"));
    expect(result.current.loading).toBe(false);
  });

  it("populates objects from snapshot", () => {
    const mockObjects = [
      { id: "obj-1", data: () => ({ type: "rectangle", x: 10, y: 20, width: 100, height: 50, color: "#000", rotation: 0, zIndex: 1, updatedAt: 123, createdBy: "u1" }) },
      { id: "obj-2", data: () => ({ type: "circle", x: 30, y: 40, width: 80, height: 80, color: "#fff", rotation: 0, zIndex: 2, updatedAt: 456, createdBy: "u1" }) },
    ];

    mockOnSnapshot.mockImplementation((_query, callback) => {
      callback({
        forEach: (fn: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
          mockObjects.forEach(fn);
        },
      });
      return jest.fn();
    });

    const { result } = renderHook(() => useBoard("board-1"));
    expect(result.current.objects).toHaveLength(2);
    expect(result.current.objects[0].id).toBe("obj-1");
    expect(result.current.objects[1].id).toBe("obj-2");
  });

  it("does not subscribe when boardId is empty", () => {
    renderHook(() => useBoard(""));
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount", () => {
    const unsubscribe = jest.fn();
    mockOnSnapshot.mockImplementation(() => unsubscribe);

    const { unmount } = renderHook(() => useBoard("board-1"));
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("addObject creates a document with generated UUID", async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBoard("board-1"));
    let id: string = "";
    await act(async () => {
      id = await result.current.addObject({
        type: "rectangle",
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        color: "#3b82f6",
        rotation: 0,
        zIndex: 1,
        createdBy: "user-1",
      });
    });

    expect(id).toBe("mock-uuid-1234");
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it("updateObject calls updateDoc", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBoard("board-1"));
    await act(async () => {
      await result.current.updateObject("obj-1", { x: 50, y: 60 });
    });

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it("deleteObject calls deleteDoc", async () => {
    mockDeleteDoc.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBoard("board-1"));
    await act(async () => {
      await result.current.deleteObject("obj-1");
    });

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it("moveObject updates x and y", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBoard("board-1"));
    await act(async () => {
      await result.current.moveObject("obj-1", 100, 200);
    });

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const updateArgs = mockUpdateDoc.mock.calls[0][1];
    expect(updateArgs.x).toBe(100);
    expect(updateArgs.y).toBe(200);
  });

  it("resizeObject updates width and height", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBoard("board-1"));
    await act(async () => {
      await result.current.resizeObject("obj-1", 300, 400);
    });

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const updateArgs = mockUpdateDoc.mock.calls[0][1];
    expect(updateArgs.width).toBe(300);
    expect(updateArgs.height).toBe(400);
  });

  it("addObject strips undefined values", async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBoard("board-1"));
    await act(async () => {
      await result.current.addObject({
        type: "sticky-note",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        color: "#fef08a",
        rotation: 0,
        zIndex: 1,
        createdBy: "user-1",
        text: undefined,
        connectedFrom: undefined,
      });
    });

    const savedData = mockSetDoc.mock.calls[0][1];
    expect(savedData).not.toHaveProperty("text");
    expect(savedData).not.toHaveProperty("connectedFrom");
  });

  it("exposes all expected methods", () => {
    const { result } = renderHook(() => useBoard("board-1"));
    expect(result.current).toHaveProperty("objects");
    expect(result.current).toHaveProperty("loading");
    expect(result.current).toHaveProperty("addObject");
    expect(result.current).toHaveProperty("updateObject");
    expect(result.current).toHaveProperty("deleteObject");
    expect(result.current).toHaveProperty("moveObject");
    expect(result.current).toHaveProperty("resizeObject");
  });
});
