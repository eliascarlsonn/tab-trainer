import { useEffect, useRef, type PointerEvent } from "react";
import type { LoopEdge } from "@/player/engine/engineState";
import { useEngine, useEngineState } from "./engineContext";
import styles from "./LoopHandles.module.css";

/** How close (px) to the top or bottom of the score the pointer must be to scroll while dragging. */
const SCROLL_ZONE = 64;
/** Fastest scroll speed while dragging, in px per frame, reached at the very edge. */
const MAX_SCROLL_STEP = 18;

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

function scrollParent(element: HTMLElement | null): HTMLElement | null {
  for (let el = element?.parentElement; el; el = el.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(el).overflowY)) return el;
  }
  return null;
}

function Handle({ edge, position, layer }: HandleProps) {
  const engine = useEngine();
  const drag = useRef<{ x: number; y: number; wholeBars: boolean } | null>(null);
  const frame = useRef(0);
  // The latest position, read by the scroll loop, which outlives the render that started it.
  const positionRef = useRef(position);
  positionRef.current = position;

  const update = () => {
    const pointer = drag.current;
    const origin = layer.current?.getBoundingClientRect();
    if (!pointer || !origin) return;
    const { top, height } = positionRef.current;
    engine.resizeLoop(edge, pointer.x - origin.left, pointer.y - origin.top, top + height / 2, pointer.wholeBars);
  };

  /** Scrolls while the pointer is held near the top or bottom of the score, extending the drag. */
  const autoScroll = () => {
    frame.current = 0;
    const pointer = drag.current;
    const scroller = scrollParent(layer.current);
    if (!pointer || !scroller) return;
    const bounds = scroller.getBoundingClientRect();
    const intoTop = bounds.top + SCROLL_ZONE - pointer.y;
    const intoBottom = pointer.y - (bounds.bottom - SCROLL_ZONE);
    const depth = Math.max(intoTop, intoBottom);
    if (depth <= 0) return;
    const step = Math.ceil(MAX_SCROLL_STEP * Math.min(1, depth / SCROLL_ZONE));
    const before = scroller.scrollTop;
    scroller.scrollTop += intoTop > 0 ? -step : step;
    if (scroller.scrollTop === before) return;
    // The score moved under a still pointer, so the beat under it changed.
    update();
    frame.current = requestAnimationFrame(autoScroll);
  };

  const stopScrolling = () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  };
  useEffect(() => stopScrolling, []);

  const onMove = (e: PointerEvent) => {
    if (!drag.current) return;
    drag.current = { x: e.clientX, y: e.clientY, wholeBars: e.shiftKey };
    update();
    if (!frame.current) frame.current = requestAnimationFrame(autoScroll);
  };

  const finish = () => {
    if (!drag.current) return;
    drag.current = null;
    stopScrolling();
    engine.finishLoopResize();
  };

  return (
    <div
      className={styles.handle}
      data-edge={edge}
      style={{ left: position.x, top: position.top, height: position.height }}
      role="slider"
      aria-label={edge === "start" ? "Loop start" : "Loop end"}
      aria-valuetext="Drag to move this edge of the loop; hold Shift to snap to whole bars"
      title="Drag to move; hold Shift to snap to whole bars"
      onPointerDown={(e) => {
        // Keep alphaTab from starting a new selection underneath.
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, wholeBars: e.shiftKey };
      }}
      onPointerMove={onMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      <span className={styles.line} />
      <span className={styles.grip} />
    </div>
  );
}
