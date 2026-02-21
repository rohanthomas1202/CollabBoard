import "./setup";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import StickyNote from "../StickyNote";
import type { BoardObject } from "@/lib/types";

describe("StickyNote", () => {
  const mockObj: BoardObject = {
    id: "sticky-1",
    type: "sticky-note",
    x: 100,
    y: 200,
    width: 200,
    height: 200,
    color: "#fef08a",
    rotation: 0,
    zIndex: 1,
    text: "Hello World",
    fontSize: 16,
    updatedAt: Date.now(),
    createdBy: "user-1",
  };

  const defaultProps = {
    obj: mockObj,
    isSelected: false,
    onSelect: jest.fn(),
    onDragEnd: jest.fn(),
    onDragMove: jest.fn(),
    draggable: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<StickyNote {...defaultProps} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders with correct position", () => {
    render(<StickyNote {...defaultProps} />);
    const group = screen.getByTestId("Group");
    expect(group.getAttribute("data-x")).toBe("100");
    expect(group.getAttribute("data-y")).toBe("200");
  });

  it("renders with correct name (id)", () => {
    render(<StickyNote {...defaultProps} />);
    const group = screen.getByTestId("Group");
    expect(group.getAttribute("data-name")).toBe("sticky-1");
  });

  it("renders text content", () => {
    render(<StickyNote {...defaultProps} />);
    const textElements = screen.getAllByTestId("Text");
    const textEl = textElements.find((el) => el.getAttribute("data-text") === "Hello World");
    expect(textEl).toBeTruthy();
  });

  it("renders note body with correct color", () => {
    render(<StickyNote {...defaultProps} />);
    const rects = screen.getAllByTestId("Rect");
    const noteBody = rects.find((el) => el.getAttribute("data-fill") === "#fef08a");
    expect(noteBody).toBeTruthy();
  });

  it("shows selected stroke when selected", () => {
    render(<StickyNote {...defaultProps} isSelected={true} />);
    const rects = screen.getAllByTestId("Rect");
    const selectedRect = rects.find((el) => el.getAttribute("data-stroke") === "#3b82f6");
    expect(selectedRect).toBeTruthy();
  });

  it("is draggable when draggable prop is true", () => {
    render(<StickyNote {...defaultProps} draggable={true} />);
    const group = screen.getByTestId("Group");
    expect(group.getAttribute("data-draggable")).toBe("true");
  });

  it("is not draggable when draggable prop is false", () => {
    render(<StickyNote {...defaultProps} draggable={false} />);
    const group = screen.getByTestId("Group");
    expect(group.getAttribute("data-draggable")).toBe("false");
  });

  it("renders text element even when no text provided", () => {
    const objNoText = { ...mockObj, text: undefined };
    render(<StickyNote {...defaultProps} obj={objNoText} />);
    const textElements = screen.getAllByTestId("Text");
    // Text element should still render (with empty or fallback text)
    expect(textElements.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onSelect when clicked", () => {
    const onSelect = jest.fn();
    render(<StickyNote {...defaultProps} onSelect={onSelect} />);
    const group = screen.getByTestId("Group");
    fireEvent.click(group);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders shadow rect", () => {
    render(<StickyNote {...defaultProps} />);
    const rects = screen.getAllByTestId("Rect");
    const shadow = rects.find((el) => el.getAttribute("data-fill") === "rgba(0,0,0,0.1)");
    expect(shadow).toBeTruthy();
  });
});
