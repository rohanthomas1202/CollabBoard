import "./setup";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Connector from "../Connector";
import type { BoardObject } from "@/lib/types";

describe("Connector", () => {
  const fromObj: BoardObject = {
    id: "obj-a",
    type: "rectangle",
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    color: "#3b82f6",
    rotation: 0,
    zIndex: 1,
    updatedAt: Date.now(),
    createdBy: "user-1",
  };

  const toObj: BoardObject = {
    id: "obj-b",
    type: "circle",
    x: 400,
    y: 300,
    width: 150,
    height: 150,
    color: "#22c55e",
    rotation: 0,
    zIndex: 2,
    updatedAt: Date.now(),
    createdBy: "user-1",
  };

  const connectorObj: BoardObject = {
    id: "conn-1",
    type: "connector",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    color: "#6b7280",
    rotation: 0,
    zIndex: 3,
    connectedFrom: "obj-a",
    connectedTo: "obj-b",
    updatedAt: Date.now(),
    createdBy: "user-1",
  };

  const allObjects = [fromObj, toObj, connectorObj];

  const defaultProps = {
    obj: connectorObj,
    allObjects,
    isSelected: false,
    onSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders when both connected objects exist", () => {
    const { container } = render(<Connector {...defaultProps} />);
    expect(container.firstChild).toBeTruthy();
    expect(screen.getByTestId("Arrow")).toBeTruthy();
  });

  it("returns null when fromObj is missing", () => {
    const { container } = render(
      <Connector {...defaultProps} allObjects={[toObj]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when toObj is missing", () => {
    const { container } = render(
      <Connector {...defaultProps} allObjects={[fromObj]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when both objects are missing", () => {
    const { container } = render(
      <Connector {...defaultProps} allObjects={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("uses selected color when selected", () => {
    render(<Connector {...defaultProps} isSelected={true} />);
    const arrow = screen.getByTestId("Arrow");
    expect(arrow.getAttribute("data-stroke")).toBe("#3b82f6");
  });

  it("uses connector color when not selected", () => {
    render(<Connector {...defaultProps} isSelected={false} />);
    const arrow = screen.getByTestId("Arrow");
    expect(arrow.getAttribute("data-stroke")).toBe("#6b7280");
  });

  it("calls onSelect when clicked", () => {
    const onSelect = jest.fn();
    render(<Connector {...defaultProps} onSelect={onSelect} />);
    const arrow = screen.getByTestId("Arrow");
    fireEvent.click(arrow);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("handles connector with no color (falls back to default)", () => {
    const noColorConnector = { ...connectorObj, color: "" };
    render(<Connector {...defaultProps} obj={noColorConnector} isSelected={false} />);
    const arrow = screen.getByTestId("Arrow");
    // Falls back to #6b7280 due to `obj.color || "#6b7280"`
    expect(arrow.getAttribute("data-stroke")).toBe("#6b7280");
  });
});
