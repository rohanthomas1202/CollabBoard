import "./setup";
import React from "react";
import { render, screen } from "@testing-library/react";
import Cursors from "../Cursors";
import type { CursorData } from "@/lib/types";

describe("Cursors", () => {
  it("renders without crashing with empty cursors", () => {
    const { container } = render(<Cursors cursors={{}} />);
    expect(container).toBeTruthy();
  });

  it("renders a cursor group for each user", () => {
    const cursors: Record<string, CursorData> = {
      "user-1": { x: 100, y: 200, name: "Alice", color: "#ef4444", lastSeen: Date.now() },
      "user-2": { x: 300, y: 400, name: "Bob", color: "#3b82f6", lastSeen: Date.now() },
    };

    render(<Cursors cursors={cursors} />);
    const groups = screen.getAllByTestId("Group");
    expect(groups).toHaveLength(2);
  });

  it("positions cursors at correct coordinates", () => {
    const cursors: Record<string, CursorData> = {
      "user-1": { x: 150, y: 250, name: "Alice", color: "#ef4444", lastSeen: Date.now() },
    };

    render(<Cursors cursors={cursors} />);
    const group = screen.getByTestId("Group");
    expect(group.getAttribute("data-x")).toBe("150");
    expect(group.getAttribute("data-y")).toBe("250");
  });

  it("renders cursor name label", () => {
    const cursors: Record<string, CursorData> = {
      "user-1": { x: 100, y: 200, name: "Alice", color: "#ef4444", lastSeen: Date.now() },
    };

    render(<Cursors cursors={cursors} />);
    const texts = screen.getAllByTestId("Text");
    const nameLabel = texts.find((el) => el.getAttribute("data-text") === "Alice");
    expect(nameLabel).toBeTruthy();
  });

  it("renders cursor with correct color", () => {
    const cursors: Record<string, CursorData> = {
      "user-1": { x: 100, y: 200, name: "Alice", color: "#ef4444", lastSeen: Date.now() },
    };

    render(<Cursors cursors={cursors} />);
    const lines = screen.getAllByTestId("Line");
    const cursorLine = lines.find((el) => el.getAttribute("data-fill") === "#ef4444");
    expect(cursorLine).toBeTruthy();
  });

  it("renders name label background with user color", () => {
    const cursors: Record<string, CursorData> = {
      "user-1": { x: 100, y: 200, name: "Bob", color: "#3b82f6", lastSeen: Date.now() },
    };

    render(<Cursors cursors={cursors} />);
    const rects = screen.getAllByTestId("Rect");
    const labelBg = rects.find((el) => el.getAttribute("data-fill") === "#3b82f6");
    expect(labelBg).toBeTruthy();
  });

  it("sets listening to false on cursor groups", () => {
    const cursors: Record<string, CursorData> = {
      "user-1": { x: 100, y: 200, name: "Alice", color: "#ef4444", lastSeen: Date.now() },
    };

    render(<Cursors cursors={cursors} />);
    const group = screen.getByTestId("Group");
    expect(group.getAttribute("data-listening")).toBe("false");
  });

  it("renders nothing visible when cursors is empty", () => {
    const { container } = render(<Cursors cursors={{}} />);
    expect(screen.queryAllByTestId("Group")).toHaveLength(0);
  });
});
