// Mock react-konva components for testing
// Konva requires canvas which isn't available in jsdom
jest.mock("react-konva", () => {
  const React = require("react");
  const createMockComponent = (name: string) => {
    return React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      // Forward relevant props for testing
      const testProps: Record<string, unknown> = { "data-testid": name };
      if (props.name) testProps["data-name"] = props.name;
      if (props.text) testProps["data-text"] = props.text;
      if (props.fill) testProps["data-fill"] = props.fill;
      if (props.stroke) testProps["data-stroke"] = props.stroke;
      if (props.x !== undefined) testProps["data-x"] = props.x;
      if (props.y !== undefined) testProps["data-y"] = props.y;
      if (props.width !== undefined) testProps["data-width"] = props.width;
      if (props.height !== undefined) testProps["data-height"] = props.height;
      if (props.draggable !== undefined) testProps["data-draggable"] = String(props.draggable);
      if (props.listening !== undefined) testProps["data-listening"] = String(props.listening);

      return React.createElement(
        "div",
        {
          ref,
          ...testProps,
          onClick: props.onClick,
          // Map Konva event names to React DOM event names
          onDoubleClick: props.onDblClick,
        },
        props.children
      );
    });
  };

  return {
    Stage: createMockComponent("Stage"),
    Layer: createMockComponent("Layer"),
    Group: createMockComponent("Group"),
    Rect: createMockComponent("Rect"),
    Circle: createMockComponent("Circle"),
    Line: createMockComponent("Line"),
    Text: createMockComponent("Text"),
    Arrow: createMockComponent("Arrow"),
  };
});
