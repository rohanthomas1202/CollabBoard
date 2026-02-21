import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = jest.fn();

// Mock Firebase auth
jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn(
    (_auth: unknown, callback: (user: unknown) => void) => {
      callback({ getIdToken: jest.fn().mockResolvedValue("mock-id-token") });
      return jest.fn(); // unsubscribe
    }
  ),
}));

// Mock Firebase Firestore
const mockGetDocs = jest.fn().mockResolvedValue({ docs: [] });
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(() => ({ id: "mock-chat-id" })),
  setDoc: jest.fn().mockResolvedValue(undefined),
  getDoc: jest.fn().mockResolvedValue({ exists: () => false }),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));

jest.mock("@/lib/firebase", () => ({
  auth: {
    currentUser: {
      getIdToken: jest.fn().mockResolvedValue("mock-id-token"),
    },
  },
  db: {},
}));

// Mock useChat from @ai-sdk/react
const mockSendMessage = jest.fn();
const mockSetMessages = jest.fn();
const mockClearError = jest.fn();
let mockMessages: Array<{
  id: string;
  role: string;
  parts: Array<{
    type: string;
    text?: string;
    state?: string;
    toolName?: string;
  }>;
}> = [];
let mockStatus = "ready";
let mockError: Error | null = null;

jest.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: mockMessages,
    sendMessage: mockSendMessage,
    setMessages: mockSetMessages,
    status: mockStatus,
    error: mockError,
    clearError: mockClearError,
  }),
}));

jest.mock("ai", () => ({
  DefaultChatTransport: jest.fn(),
}));

import AIChatPanel from "../AIChatPanel";

const defaultProps = {
  boardId: "board-1",
  userId: "user-1",
  isOpen: true,
  onClose: jest.fn(),
  isDarkMode: true,
};

describe("AIChatPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMessages = [];
    mockStatus = "ready";
    mockError = null;
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <AIChatPanel {...defaultProps} isOpen={false} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders panel when isOpen is true", () => {
    render(<AIChatPanel {...defaultProps} />);
    expect(screen.getByText("AI Assistant")).toBeTruthy();
  });

  it("renders empty state with example prompts", () => {
    render(<AIChatPanel {...defaultProps} />);
    expect(screen.getByText("AI Board Assistant")).toBeTruthy();
    expect(screen.getByText(/Create a SWOT analysis template/)).toBeTruthy();
    expect(screen.getByText(/Add a yellow sticky note/)).toBeTruthy();
    expect(screen.getByText(/Arrange all sticky notes/)).toBeTruthy();
  });

  it("sends message when example prompt is clicked", () => {
    render(<AIChatPanel {...defaultProps} />);
    fireEvent.click(screen.getByText(/Create a SWOT analysis template/));
    expect(mockSendMessage).toHaveBeenCalledWith({
      text: "Create a SWOT analysis template",
    });
  });

  it("renders user messages", () => {
    mockMessages = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Add a sticky note" }],
      },
    ];

    render(<AIChatPanel {...defaultProps} />);
    expect(screen.getByText("Add a sticky note")).toBeTruthy();
  });

  it("renders assistant messages", () => {
    mockMessages = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [{ type: "text", text: "Created a sticky note for you." }],
      },
    ];

    render(<AIChatPanel {...defaultProps} />);
    expect(screen.getByText("Created a sticky note for you.")).toBeTruthy();
  });

  it("renders tool invocation in progress", () => {
    mockMessages = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-createStickyNote",
            state: "input-available",
          },
        ],
      },
    ];

    render(<AIChatPanel {...defaultProps} />);
    expect(screen.getByText(/create Sticky Note.../)).toBeTruthy();
  });

  it("renders completed tool invocation", () => {
    mockMessages = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-getBoardState",
            state: "output-available",
          },
        ],
      },
    ];

    render(<AIChatPanel {...defaultProps} />);
    expect(screen.getByText(/get Board State/)).toBeTruthy();
  });

  it("shows loading indicator when status is submitted", () => {
    mockMessages = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
    ];
    mockStatus = "submitted";

    render(<AIChatPanel {...defaultProps} />);
    const dots = document.querySelectorAll(".animate-bounce");
    expect(dots.length).toBe(3);
  });

  it("shows error message when error exists", () => {
    mockError = new Error("Something went wrong");

    render(<AIChatPanel {...defaultProps} />);
    expect(screen.getByText("Error: Something went wrong")).toBeTruthy();
    expect(screen.getByText("Dismiss")).toBeTruthy();
  });

  it("clears error on dismiss click", () => {
    mockError = new Error("Test error");

    render(<AIChatPanel {...defaultProps} />);
    fireEvent.click(screen.getByText("Dismiss"));
    expect(mockClearError).toHaveBeenCalled();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = jest.fn();
    render(<AIChatPanel {...defaultProps} onClose={onClose} />);

    const header =
      screen.getByText("AI Assistant").parentElement!.parentElement!;
    const buttons = header.querySelectorAll("button");
    // Close button is the last button in the header
    const lastButton = buttons[buttons.length - 1];
    fireEvent.click(lastButton);
    expect(onClose).toHaveBeenCalled();
  });

  it("submits message on form submit", () => {
    render(<AIChatPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText("Ask the AI agent...");
    fireEvent.change(input, { target: { value: "Create a rectangle" } });
    fireEvent.submit(input.closest("form")!);
    expect(mockSendMessage).toHaveBeenCalledWith({
      text: "Create a rectangle",
    });
  });

  it("does not submit empty message", () => {
    render(<AIChatPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText("Ask the AI agent...");
    fireEvent.submit(input.closest("form")!);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("disables input when loading", () => {
    mockStatus = "submitted";
    render(<AIChatPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText("Ask the AI agent...");
    expect(input).toBeDisabled();
  });

  it("renders in light mode", () => {
    render(<AIChatPanel {...defaultProps} isDarkMode={false} />);
    expect(screen.getByText("AI Assistant")).toBeTruthy();
  });

  it("renders new chat and history buttons in header", () => {
    render(<AIChatPanel {...defaultProps} />);
    expect(screen.getByTitle("New chat")).toBeTruthy();
    expect(screen.getByTitle("Chat history")).toBeTruthy();
  });

  it("shows empty history panel when history button is clicked", () => {
    render(<AIChatPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Chat history"));
    expect(screen.getByText("No chat history yet")).toBeTruthy();
  });

  it("clears messages when new chat button is clicked", () => {
    mockMessages = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
    ];
    render(<AIChatPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle("New chat"));
    expect(mockSetMessages).toHaveBeenCalledWith([]);
  });

  it("shows history items when chat list has entries", async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [],
    });
    // After mount (which loads empty list), click history to trigger reload
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: "chat-1",
          data: () => ({
            title: "SWOT Analysis",
            createdAt: Date.now() - 3600000,
            updatedAt: Date.now() - 3600000,
          }),
        },
      ],
    });

    render(<AIChatPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Chat history"));

    // Wait for async loadChatList
    await screen.findByText("SWOT Analysis");
    expect(screen.getByText("SWOT Analysis")).toBeTruthy();
  });
});
