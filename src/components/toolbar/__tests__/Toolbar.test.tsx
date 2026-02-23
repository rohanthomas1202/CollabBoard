import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Toolbar from "../Toolbar";
import type { Tool } from "@/lib/types";

describe("Toolbar", () => {
  const defaultProps = {
    activeTool: "select" as Tool,
    onToolChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<Toolbar {...defaultProps} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders all tool buttons", () => {
    render(<Toolbar {...defaultProps} />);
    const buttons = screen.getAllByRole("button");
    // 8 tools + 1 delete button = 9
    expect(buttons.length).toBe(9);
  });

  it("highlights the active tool", () => {
    render(<Toolbar {...defaultProps} activeTool="rectangle" />);
    const rectButton = screen.getByTitle("Rectangle (R)");
    expect(rectButton.style.background).toContain("var(--accent)");
  });

  it("calls onToolChange when a tool is clicked", () => {
    const onToolChange = jest.fn();
    render(<Toolbar {...defaultProps} onToolChange={onToolChange} />);

    const rectButton = screen.getByTitle("Rectangle (R)");
    fireEvent.click(rectButton);
    expect(onToolChange).toHaveBeenCalledWith("rectangle");
  });

  it("renders correct labels for all tools", () => {
    render(<Toolbar {...defaultProps} />);
    expect(screen.getByTitle("Select (V)")).toBeTruthy();
    expect(screen.getByTitle("Pan (H)")).toBeTruthy();
    expect(screen.getByTitle("Sticky Note (N)")).toBeTruthy();
    expect(screen.getByTitle("Rectangle (R)")).toBeTruthy();
    expect(screen.getByTitle("Circle (O)")).toBeTruthy();
    expect(screen.getByTitle("Line (L)")).toBeTruthy();
    expect(screen.getByTitle("Connector (C)")).toBeTruthy();
    expect(screen.getByTitle("Text (T)")).toBeTruthy();
  });

  it("non-active tools have transparent background", () => {
    render(<Toolbar {...defaultProps} activeTool="select" />);
    const panButton = screen.getByTitle("Pan (H)");
    expect(panButton.style.background).toBe("transparent");
  });

  it("calls onToolChange with different tools", () => {
    const onToolChange = jest.fn();
    render(<Toolbar {...defaultProps} onToolChange={onToolChange} />);

    const tools: { title: string; id: Tool }[] = [
      { title: "Select (V)", id: "select" },
      { title: "Pan (H)", id: "pan" },
      { title: "Sticky Note (N)", id: "sticky-note" },
      { title: "Circle (O)", id: "circle" },
      { title: "Line (L)", id: "line" },
      { title: "Connector (C)", id: "connector" },
      { title: "Text (T)", id: "text" },
    ];

    tools.forEach(({ title, id }) => {
      fireEvent.click(screen.getByTitle(title));
      expect(onToolChange).toHaveBeenCalledWith(id);
    });
  });

  it("has glassmorphism styling", () => {
    const { container } = render(<Toolbar {...defaultProps} />);
    const toolbar = container.firstChild as HTMLElement;
    expect(toolbar.style.backdropFilter).toContain("blur");
  });
});
