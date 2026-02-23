import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock framer-motion to render plain divs in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(({ children, variants, initial, animate, whileHover, whileTap, layoutId, ...rest }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) =>
      React.createElement("div", { ...rest, ref }, children)
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => React.createElement(React.Fragment, null, children),
}));

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockLogout = jest.fn();
let mockUser: { uid: string; email: string; displayName?: string } | null = null;
let mockLoading = false;

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
    logout: mockLogout,
  }),
}));

// Mock Firestore
const mockOnSnapshot = jest.fn();
const mockAddDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  doc: jest.fn(),
}));

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

import DashboardPage from "../page";

describe("DashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { uid: "user-1", email: "test@test.com", displayName: "Test User" };
    mockLoading = false;
    mockOnSnapshot.mockImplementation((_col, callback) => {
      callback({ forEach: jest.fn() });
      return jest.fn();
    });
  });

  it("shows loading spinner while loading", () => {
    mockLoading = true;
    render(<DashboardPage />);
    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("redirects to login when not authenticated", () => {
    mockUser = null;
    render(<DashboardPage />);
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("renders header with CollabBoard title", () => {
    render(<DashboardPage />);
    expect(screen.getByText("CollabBoard")).toBeTruthy();
  });

  it("shows user display name", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Test User")).toBeTruthy();
  });

  it("shows user email when no display name", () => {
    mockUser = { uid: "user-1", email: "test@test.com" };
    render(<DashboardPage />);
    expect(screen.getByText("test@test.com")).toBeTruthy();
  });

  it("shows user initial in avatar", () => {
    render(<DashboardPage />);
    expect(screen.getByText("T")).toBeTruthy();
  });

  it("renders tab buttons", () => {
    render(<DashboardPage />);
    expect(screen.getByText("All Boards")).toBeTruthy();
    expect(screen.getByText("My Boards")).toBeTruthy();
    expect(screen.getByText("Shared")).toBeTruthy();
  });

  it("renders New Board button", () => {
    render(<DashboardPage />);
    expect(screen.getByText("New Board")).toBeTruthy();
  });

  it("shows empty state when no boards", () => {
    render(<DashboardPage />);
    expect(screen.getByText("No boards yet")).toBeTruthy();
    expect(screen.getByText("Create your first collaborative whiteboard.")).toBeTruthy();
  });

  it("creates a new board on button click", async () => {
    mockAddDoc.mockResolvedValue({ id: "new-board-1" });
    render(<DashboardPage />);

    fireEvent.click(screen.getByText("New Board"));

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/board/new-board-1");
    });
  });

  it("renders boards from snapshot", () => {
    const mockBoards = [
      { id: "board-1", data: () => ({ name: "Board One", ownerId: "user-1", createdAt: Date.now(), updatedAt: Date.now(), sharedWith: [] }) },
      { id: "board-2", data: () => ({ name: "Board Two", ownerId: "user-1", createdAt: Date.now() - 1000, updatedAt: Date.now(), sharedWith: [] }) },
    ];

    mockOnSnapshot.mockImplementation((_col, callback) => {
      callback({
        forEach: (fn: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
          mockBoards.forEach(fn);
        },
      });
      return jest.fn();
    });

    render(<DashboardPage />);
    expect(screen.getByText("Board One")).toBeTruthy();
    expect(screen.getByText("Board Two")).toBeTruthy();
  });

  it("switches tabs", () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByText("My Boards"));
    // Tab should now be active (visual change)
    expect(screen.getByText("My Boards")).toBeTruthy();
  });

  it("calls logout on Sign Out click", () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByText("Sign Out"));
    expect(mockLogout).toHaveBeenCalled();
  });

  it("has theme toggle button", () => {
    render(<DashboardPage />);
    const toggleButton = screen.getByTitle("Switch to light");
    expect(toggleButton).toBeTruthy();
  });

  it("toggles theme on click", () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByTitle("Switch to light"));
    expect(screen.getByTitle("Switch to dark")).toBeTruthy();
  });

  it("navigates to board on card click", () => {
    const mockBoards = [
      { id: "board-1", data: () => ({ name: "Test Board", ownerId: "user-1", createdAt: Date.now(), updatedAt: Date.now(), sharedWith: [] }) },
    ];

    mockOnSnapshot.mockImplementation((_col, callback) => {
      callback({
        forEach: (fn: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
          mockBoards.forEach(fn);
        },
      });
      return jest.fn();
    });

    render(<DashboardPage />);
    fireEvent.click(screen.getByText("Test Board").closest("[class*='group']")!);
    expect(mockPush).toHaveBeenCalledWith("/board/board-1");
  });

  it("shows shared tab empty state", () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByText("Shared"));
    expect(screen.getByText("No shared boards yet")).toBeTruthy();
  });

  it("shows thumbnail when board has one", () => {
    const mockBoards = [
      {
        id: "board-1",
        data: () => ({
          name: "Board With Thumb",
          ownerId: "user-1",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sharedWith: [],
          thumbnail: "data:image/jpeg;base64,abc123",
        }),
      },
    ];

    mockOnSnapshot.mockImplementation((_col, callback) => {
      callback({
        forEach: (fn: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
          mockBoards.forEach(fn);
        },
      });
      return jest.fn();
    });

    render(<DashboardPage />);
    const img = screen.getByAltText("Board With Thumb");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("data:image/jpeg;base64,abc123");
  });
});
