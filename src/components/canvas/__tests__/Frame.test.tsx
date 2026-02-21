import "./setup";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Frame from "../Frame";
import type { BoardObject } from "@/lib/types";

describe("Frame", () => {
  const mockObj: BoardObject = {
    id: "frame-1",
    type: "frame",
    x: 50,
    y: 80,
    width: 400,
    height: 300,
    color: "#4b5563",
    rotation: 0,
    zIndex: 0,
    text: "My Frame",
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
    const { container } = render(<Frame {...defaultProps} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders with correct position", () => {
    render(<Frame {...defaultProps} />);
    const group = screen.getByTestId("Group");
    expect(group.getAttribute("data-x")).toBe("50");
    expect(group.getAttribute("data-y")).toBe("80");
  });

  it("renders frame title", () => {
    render(<Frame {...defaultProps} />);
    const texts = screen.getAllByTestId("Text");
    const title = texts.find((el) => el.getAttribute("data-text") === "My Frame");
    expect(title).toBeTruthy();
  });

  it("renders default title when no text provided", () => {
    const objNoText = { ...mockObj, text: undefined };
    render(<Frame {...defaultProps} obj={objNoText} />);
    const texts = screen.getAllByTestId("Text");
    const title = texts.find((el) => el.getAttribute("data-text") === "Frame");
    expect(title).toBeTruthy();
  });

  it("renders frame border rect", () => {
    render(<Frame {...defaultProps} />);
    const rect = screen.getByTestId("Rect");
    expect(rect.getAttribute("data-width")).toBe("400");
    expect(rect.getAttribute("data-height")).toBe("300");
  });

  it("shows selected stroke when selected", () => {
    render(<Frame {...defaultProps} isSelected={true} />);
    const rect = screen.getByTestId("Rect");
    expect(rect.getAttribute("data-stroke")).toBe("#3b82f6");
  });

  it("shows default stroke when not selected", () => {
    render(<Frame {...defaultProps} isSelected={false} />);
    const rect = screen.getByTestId("Rect");
    expect(rect.getAttribute("data-stroke")).toBe("#4b5563");
  });

  it("calls onSelect when clicked", () => {
    const onSelect = jest.fn();
    render(<Frame {...defaultProps} onSelect={onSelect} />);
    const group = screen.getByTestId("Group");
    fireEvent.click(group);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("calls onDblClick on double click", () => {
    const onDblClick = jest.fn();
    render(<Frame {...defaultProps} onDblClick={onDblClick} />);
    const group = screen.getByTestId("Group");
    fireEvent.doubleClick(group);
    expect(onDblClick).toHaveBeenCalledTimes(1);
  });

  it("is draggable when prop is true", () => {
    render(<Frame {...defaultProps} draggable={true} />);
    const group = screen.getByTestId("Group");
    expect(group.getAttribute("data-draggable")).toBe("true");
  });
});
