"use client";

interface PresentationOverlayProps {
  screenRect: { x: number; y: number; width: number; height: number };
}

export default function PresentationOverlay({
  screenRect,
}: PresentationOverlayProps) {
  const maskId = "presentation-mask";

  return (
    <svg
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 55,
        pointerEvents: "none",
      }}
    >
      <defs>
        <mask id={maskId}>
          {/* White = visible (dim overlay shows) */}
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {/* Black = hole (frame area is clear) */}
          <rect
            x={screenRect.x}
            y={screenRect.y}
            width={screenRect.width}
            height={screenRect.height}
            rx="8"
            fill="black"
          />
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0, 0, 0, 0.5)"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}
