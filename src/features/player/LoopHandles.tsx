import { useRef, type PointerEvent } from "react";
import type { LoopEdge } from "@/player/engine/engineState";
import { useEngine, useEngineState } from "./engineContext";
import styles from "./LoopHandles.module.css";

/** Grab handles on the loop's start and end, drawn over the score so they scroll with it. */
export function LoopHandles() {
  const edges = useEngineState((s) => s.loopEdges);
  const layer = useRef<HTMLDivElement>(null);

  return (
    <div ref={layer} className={styles.layer}>
      {edges && (
        <>
          <Handle edge="start" position={edges.start} layer={layer} />
          <Handle edge="end" position={edges.end} layer={layer} />
        </>
      )}
    </div>
  );
}

interface HandleProps {
  edge: "start" | "end";
  position: LoopEdge;
  layer: React.RefObject<HTMLDivElement | null>;
}

function Handle({ edge, position, layer }: HandleProps) {
  const engine = useEngine();
  const dragging = useRef(false);

  const move = (e: PointerEvent) => {
    const origin = layer.current?.getBoundingClientRect();
    if (!origin) return;
    const middle = position.top + position.height / 2;
    engine.resizeLoop(edge, e.clientX - origin.left, e.clientY - origin.top, middle);
  };

  return (
    <div
      className={styles.handle}
      data-edge={edge}
      style={{ left: position.x, top: position.top, height: position.height }}
      role="slider"
      aria-label={edge === "start" ? "Loop start" : "Loop end"}
      aria-valuetext="Drag to move this edge of the loop"
      onPointerDown={(e) => {
        // Keep alphaTab from starting a new selection underneath.
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
      }}
      onPointerMove={(e) => dragging.current && move(e)}
      onPointerUp={() => {
        if (!dragging.current) return;
        dragging.current = false;
        engine.finishLoopResize();
      }}
      onPointerCancel={() => {
        dragging.current = false;
        engine.finishLoopResize();
      }}
    >
      <span className={styles.line} />
      <span className={styles.grip} />
    </div>
  );
}
