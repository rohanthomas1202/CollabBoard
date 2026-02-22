import { renderHook, act } from "@testing-library/react";

const mockOnValue = jest.fn();
const mockSet = jest.fn();
const mockOnDisconnect = jest.fn();
const mockRemove = jest.fn();
const mockRef = jest.fn();

jest.mock("firebase/database", () => ({
  ref: (...args: unknown[]) => mockRef(...args),
  onValue: (...args: unknown[]) => mockOnValue(...args),
  set: (...args: unknown[]) => mockSet(...args),
  onDisconnect: (...args: unknown[]) => mockOnDisconnect(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  serverTimestamp: jest.fn(),
}));

jest.mock("@/lib/firebase", () => ({
  rtdb: {},
}));

jest.mock("@/lib/constants", () => ({
  CURSOR_THROTTLE_MS: 50,
}));

jest.mock("@/lib/types", () => ({
  COLORS: {
    cursor: ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"],
  },
}));

import { usePresence } from "../usePresence";

describe("usePresence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRef.mockReturnValue("mock-ref");
    mockOnValue.mockImplementation((_ref, callback) => {
      callback({ val: () => ({}) });
      return jest.fn();
    });
    mockOnDisconnect.mockReturnValue({ remove: jest.fn() });
  });

  it("starts with empty cursors", () => {
    const { result } = renderHook(() => usePresence("board-1", "user-1", "Alice"));
    expect(result.current.cursors).toEqual({});
  });

  it("returns a color for the current user", () => {
    const { result } = renderHook(() => usePresence("board-1", "user-1", "Alice"));
    expect(result.current.myColor).toBeDefined();
    expect(typeof result.current.myColor).toBe("string");
  });

  it("sets up presence reference on mount", () => {
    renderHook(() => usePresence("board-1", "user-1", "Alice"));
    expect(mockRef).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalled();
    expect(mockOnDisconnect).toHaveBeenCalled();
  });

  it("filters out own cursor from others", () => {
    mockOnValue.mockImplementation((_ref, callback) => {
      callback({
        val: () => ({
          "user-1": { x: 10, y: 20, name: "Alice", color: "#ef4444", lastSeen: 123 },
          "user-2": { x: 30, y: 40, name: "Bob", color: "#3b82f6", lastSeen: 456 },
        }),
      });
      return jest.fn();
    });

    const { result } = renderHook(() => usePresence("board-1", "user-1", "Alice"));
    expect(result.current.cursors).not.toHaveProperty("user-1");
    expect(result.current.cursors).toHaveProperty("user-2");
    expect(result.current.cursors["user-2"].name).toBe("Bob");
  });

  it("handles null data from snapshot", () => {
    mockOnValue.mockImplementation((_ref, callback) => {
      callback({ val: () => null });
      return jest.fn();
    });

    const { result } = renderHook(() => usePresence("board-1", "user-1", "Alice"));
    expect(result.current.cursors).toEqual({});
  });

  it("cleans up on unmount", () => {
    const unsubscribe = jest.fn();
    mockOnValue.mockImplementation(() => unsubscribe);

    const { unmount } = renderHook(() => usePresence("board-1", "user-1", "Alice"));
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();
  });

  it("does not set up listeners when boardId is empty", () => {
    renderHook(() => usePresence("", "user-1", "Alice"));
    expect(mockOnValue).not.toHaveBeenCalled();
  });

  it("does not set up listeners when userId is empty", () => {
    renderHook(() => usePresence("board-1", "", "Alice"));
    expect(mockOnValue).not.toHaveBeenCalled();
  });

  it("updateCursor is a function", () => {
    const { result } = renderHook(() => usePresence("board-1", "user-1", "Alice"));
    expect(typeof result.current.updateCursor).toBe("function");
  });

  it("updateCursor calls set with position data", () => {
    mockSet.mockClear();
    const { result } = renderHook(() => usePresence("board-1", "user-1", "Alice"));

    // Clear initial set calls
    mockSet.mockClear();

    act(() => {
      result.current.updateCursor(100, 200);
    });

    // It may be throttled, but at least one call should go through
    // since this is the first call
    expect(mockSet).toHaveBeenCalled();
  });
});
