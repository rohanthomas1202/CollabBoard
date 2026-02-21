import React from "react";
import { render, screen } from "@testing-library/react";
import PresenceBar from "../PresenceBar";
import type { CursorData } from "@/lib/types";

describe("PresenceBar", () => {
  const defaultProps = {
    cursors: {} as Record<string, CursorData>,
    userName: "Alice Smith",
    myColor: "#ef4444",
  };

  it("renders without crashing", () => {
    const { container } = render(<PresenceBar {...defaultProps} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("shows 'Just you' when no other cursors", () => {
    render(<PresenceBar {...defaultProps} />);
    expect(screen.getByText("Just you")).toBeTruthy();
  });

  it("shows current user avatar with initials", () => {
    render(<PresenceBar {...defaultProps} />);
    expect(screen.getByTitle("Alice Smith (you)")).toBeTruthy();
  });

  it("generates correct initials for two-word name", () => {
    render(<PresenceBar {...defaultProps} userName="John Doe" />);
    expect(screen.getByTitle("John Doe (you)").textContent).toContain("JD");
  });

  it("generates correct initials for single-word name", () => {
    render(<PresenceBar {...defaultProps} userName="Bob" />);
    expect(screen.getByTitle("Bob (you)").textContent).toContain("BO");
  });

  it("renders other user avatars", () => {
    const cursors: Record<string, CursorData> = {
      "user-2": { x: 10, y: 20, name: "Bob Jones", color: "#3b82f6", lastSeen: Date.now() },
      "user-3": { x: 30, y: 40, name: "Charlie", color: "#22c55e", lastSeen: Date.now() },
    };

    render(<PresenceBar {...defaultProps} cursors={cursors} />);
    expect(screen.getByTitle("Bob Jones")).toBeTruthy();
    expect(screen.getByTitle("Charlie")).toBeTruthy();
  });

  it("does not show 'Just you' when other users are present", () => {
    const cursors: Record<string, CursorData> = {
      "user-2": { x: 10, y: 20, name: "Bob", color: "#3b82f6", lastSeen: Date.now() },
    };

    render(<PresenceBar {...defaultProps} cursors={cursors} />);
    expect(screen.queryByText("Just you")).toBeNull();
  });

  it("shows correct number of avatars", () => {
    const cursors: Record<string, CursorData> = {
      "user-2": { x: 0, y: 0, name: "Bob", color: "#3b82f6", lastSeen: Date.now() },
      "user-3": { x: 0, y: 0, name: "Charlie", color: "#22c55e", lastSeen: Date.now() },
      "user-4": { x: 0, y: 0, name: "Diana", color: "#f59e0b", lastSeen: Date.now() },
    };

    render(<PresenceBar {...defaultProps} cursors={cursors} />);
    // 3 other users + 1 current user = 4 avatars
    expect(screen.getByTitle("Bob")).toBeTruthy();
    expect(screen.getByTitle("Charlie")).toBeTruthy();
    expect(screen.getByTitle("Diana")).toBeTruthy();
    expect(screen.getByTitle("Alice Smith (you)")).toBeTruthy();
  });

  it("applies correct background color to user avatar", () => {
    render(<PresenceBar {...defaultProps} myColor="#ff0000" />);
    const avatar = screen.getByTitle("Alice Smith (you)");
    expect(avatar.style.backgroundColor).toBe("rgb(255, 0, 0)");
  });
});
