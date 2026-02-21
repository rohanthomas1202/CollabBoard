import "./setup";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Shape from "../Shape";
import type { BoardObject } from "@/lib/types";

describe("Shape", () => {
  const baseObj: BoardObject = {
    id: "shape-1",
    type: "rectangle",
    x: 50,
    y: 60,
    width: 200,
    height: 150,
    color: "#3b82f6",
    rotation: 0,
    zIndex: 1,
    updatedAt: Date.now(),
    createdBy: "user-1",
  };

  const defaultProps = {
    obj: baseObj,
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
    const { container } = render(<Shape {...defaultProps} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders rectangle shape", () => {
    render(<Shape {...defaultProps} />);
    const rect = screen.getByTestId("Rect");
    expect(rect).toBeTruthy();
    expect(rect.getAttribute("data-fill")).toBe("#3b82f6");
  });

  it("renders circle shape", () => {
    const circleObj = { ...baseObj, type: "circle" as const, width: 150, height: 150 };
    render(<Shape {...defaultProps} obj={circleObj} />);
    const circle = screen.getByTestId("Circle");
    expect(circle).toBeTruthy();
  });

  it("renders line shape", () => {
    const lineObj = { ...baseObj, type: "line" as const };
    render(<Shape {...defaultProps} obj={lineObj} />);
    const line = screen.getByTestId("Line");
    expect(line).toBeTruthy();
  });

  it("renders with correct position", () => {
    render(<Shape {...defaultProps} />);
    const group = screen.getByTestId("Group");
    expect(group.getAttribute("data-x")).toBe("50");
    expect(group.getAttribute("data-y")).toBe("60");
  });

  it("shows selected stroke when selected", () => {
    render(<Shape {...defaultProps} isSelected={true} />);
    const rect = screen.getByTestId("Rect");
    expect(rect.getAttribute("data-stroke")).toBe("#3b82f6");
  });

  it("shows default stroke when not selected", () => {
    render(<Shape {...defaultProps} isSelected={false} />);
    const rect = screen.getByTestId("Rect");
    expect(rect.getAttribute("data-stroke")).toBe("#374151");
  });

  it("calls onSelect when clicked", () => {
    const onSelect = jest.fn();
    render(<Shape {...defaultProps} onSelect={onSelect} />);
    const group = screen.getByTestId("Group");
    fireEvent.click(group);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("calls onDblClick on double click", () => {
    const onDblClick = jest.fn();
    render(<Shape {...defaultProps} onDblClick={onDblClick} />);
    const group = screen.getByTestId("Group");
    fireEvent.doubleClick(group);
    expect(onDblClick).toHaveBeenCalledTimes(1);
  });

  it("renders text on shape when text is provided", () => {
    const objWithText = { ...baseObj, text: "Label" };
    render(<Shape {...defaultProps} obj={objWithText} />);
    const texts = screen.getAllByTestId("Text");
    const label = texts.find((el) => el.getAttribute("data-text") === "Label");
    expect(label).toBeTruthy();
  });

  it("does not render text for line type even if text exists", () => {
    const lineWithText = { ...baseObj, type: "line" as const, text: "Label" };
    render(<Shape {...defaultProps} obj={lineWithText} />);
    const texts = screen.queryAllByTestId("Text");
    const label = texts.find((el) => el.getAttribute("data-text") === "Label");
    expect(label).toBeUndefined();
  });

  it("is draggable when prop is true", () => {
    render(<Shape {...defaultProps} draggable={true} />);
    const group = screen.getByTestId("Group");
    expect(group.getAttribute("data-draggable")).toBe("true");
  });
});
