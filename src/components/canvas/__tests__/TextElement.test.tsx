import "./setup";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TextElement from "../TextElement";
import type { BoardObject } from "@/lib/types";

describe("TextElement", () => {
  const mockObj: BoardObject = {
    id: "text-1",
    type: "text",
    x: 100,
    y: 150,
    width: 200,
    height: 40,
    color: "#e8eaed",
    rotation: 0,
    zIndex: 1,
    text: "Sample Text",
    fontSize: 20,
    updatedAt: Date.now(),
    createdBy: "user-1",
  };

  const defaultProps = {
    obj: mockObj,
    isSelected: false,
    onSelect: jest.fn(),
    onDragEnd: jest.fn(),
    onDragMove: jest.fn(),
    onDblClick: jest.fn(),
    draggable: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<TextElement {...defaultProps} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders with correct position", () => {
    render(<TextElement {...defaultProps} />);
    const group = screen.getByTestId("Group");
    expect(group.getAttribute("data-x")).toBe("100");
    expect(group.getAttribute("data-y")).toBe("150");
  });

  it("renders text content", () => {
    render(<TextElement {...defaultProps} />);
    const text = screen.getByTestId("Text");
    expect(text.getAttribute("data-text")).toBe("Sample Text");
  });

  it("renders default text when no text provided", () => {
    const objNoText = { ...mockObj, text: undefined };
    render(<TextElement {...defaultProps} obj={objNoText} />);
    const text = screen.getByTestId("Text");
    expect(text.getAttribute("data-text")).toBe("Text");
  });

  it("shows selection border when selected", () => {
    render(<TextElement {...defaultProps} isSelected={true} />);
    const rect = screen.getByTestId("Rect");
    expect(rect.getAttribute("data-stroke")).toBe("#3b82f6");
  });

  it("does not show selection border when not selected", () => {
    render(<TextElement {...defaultProps} isSelected={false} />);
    expect(screen.queryByTestId("Rect")).toBeNull();
  });

  it("calls onSelect when clicked", () => {
    const onSelect = jest.fn();
    render(<TextElement {...defaultProps} onSelect={onSelect} />);
    const group = screen.getByTestId("Group");
    fireEvent.click(group);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("calls onDblClick on double click", () => {
    const onDblClick = jest.fn();
    render(<TextElement {...defaultProps} onDblClick={onDblClick} />);
    const group = screen.getByTestId("Group");
    fireEvent.doubleClick(group);
    expect(onDblClick).toHaveBeenCalledTimes(1);
  });

  it("renders text with correct color", () => {
    render(<TextElement {...defaultProps} />);
    const text = screen.getByTestId("Text");
    expect(text.getAttribute("data-fill")).toBe("#e8eaed");
  });

  it("is draggable when prop is true", () => {
    render(<TextElement {...defaultProps} draggable={true} />);
    const group = screen.getByTestId("Group");
    expect(group.getAttribute("data-draggable")).toBe("true");
  });
});
