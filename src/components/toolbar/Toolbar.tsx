"use client";

import { Tool } from "@/lib/types";

interface ToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

const tools: { id: Tool; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "↖" },
  { id: "pan", label: "Pan", icon: "✋" },
  { id: "sticky-note", label: "Sticky Note", icon: "📝" },
  { id: "rectangle", label: "Rectangle", icon: "⬜" },
  { id: "circle", label: "Circle", icon: "⚪" },
  { id: "line", label: "Line", icon: "╱" },
  { id: "text", label: "Text", icon: "T" },
  { id: "connector", label: "Connector", icon: "↗" },
];

export default function Toolbar({ activeTool, onToolChange }: ToolbarProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 rounded-xl shadow-2xl border border-gray-700 px-2 py-2 flex gap-1 z-50">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onToolChange(tool.id)}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg text-sm transition-colors ${
            activeTool === tool.id
              ? "bg-blue-600 text-white"
              : "text-gray-300 hover:bg-gray-800"
          }`}
          title={tool.label}
        >
          <span className="text-lg">{tool.icon}</span>
          <span className="text-[10px] mt-0.5">{tool.label}</span>
        </button>
      ))}
    </div>
  );
}
