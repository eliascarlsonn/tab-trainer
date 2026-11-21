import { useEffect, useRef, type PointerEvent, type RefObject } from "react";
import type { LoopEdge } from "@/player/engine/engineState";
import { useEngine, useEngineState } from "./engineContext";
import styles from "./LoopHandles.module.css";

/** How close (px) to the top or bottom of the score the pointer must be to scroll while dragging. */
const SCROLL_ZONE = 64;
/** Fastest scroll speed while dragging, in px per frame, reached at the very edge. */
const MAX_SCROLL_STEP = 18;

interface Pointer {
  x: number;
  y: number;
  wholeBars: boolean;
}

/**
 * Loop editing on top of the score: grab handles on the loop's start and end, plus Shift-snapping
 * and auto-scrolling while painting a new loop across the tab.
 */
export function LoopHandles() {
  const edges = useEngineState((s) => s.loopEdges);
  const layer = useRef<HTMLDivElement>(null);
  useLoopPainting(layer);

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

function scrollParent(element: HTMLElement | null): HTMLElement | null {
  for (let el = element?.parentElement; el; el = el.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(el).overflowY)) return el;
  }
  return null;
}

/**
 * Scrolls the score while a drag is held near its top or bottom edge, faster closer to the edge.
 * `onScroll` runs after each step, since the beat under a still pointer has changed.
 */
function useAutoScroll(layer: RefObject<HTMLDivElement | null>, onScroll: (pointer: Pointer) => void) {
  const pointer = useRef<Pointer | null>(null);
  const frame = useRef(0);
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;

  const step = () => {
    frame.current = 0;
    const scroller = scrollParent(layer.current);
    const at = pointer.current;
    if (!at || !scroller) return;
    const bounds = scroller.getBoundingClientRect();
    const intoTop = bounds.top + SCROLL_ZONE - at.y;
    const intoBottom = at.y - (bounds.bottom - SCROLL_ZONE);
    const depth = Math.max(intoTop, intoBottom);
    if (depth <= 0) return;
    const before = scroller.scrollTop;
    const amount = Math.ceil(MAX_SCROLL_STEP * Math.min(1, depth / SCROLL_ZONE));
    scroller.scrollTop += intoTop > 0 ? -amount : amount;
    if (scroller.scrollTop === before) return;
    onScrollRef.current(at);
    frame.current = requestAnimationFrame(step);
  };

  const stop = () => {
    pointer.current = null;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  };
  useEffect(() => stop, []);

  return {
    /** Records where the pointer is and starts scrolling if it's in an edge zone. */
    track(next: Pointer) {
      pointer.current = next;
      if (!frame.current) frame.current = requestAnimationFrame(step);
    },
    stop,
  };
}

/** Host coordinates of a viewport point; the layer shares the score host's origin. */
function toHost(layer: RefObject<HTMLDivElement | null>, pointer: Pointer) {
  const origin = layer.current?.getBoundingClientRect();
  return origin && { x: pointer.x - origin.left, y: pointer.y - origin.top };
}

/**
 * Follows alphaTab's own drag selection. Mouse events are used (not pointer events) because
 * alphaTab handles the mouse events of a press at document capture level; listening on the
 * window afterwards lets these adjustments win.
 */
function useLoopPainting(layer: RefObject<HTMLDivElement | null>) {
  const engine = useEngine();
  const paint = (pointer: Pointer) => {
    const at = toHost(layer, pointer);
    if (at) engine.paintLoop(at.x, at.y, pointer.wholeBars);
  };
  const scroll = useAutoScroll(layer, paint);
  const paintRef = useRef(paint);
  paintRef.current = paint;
  const scrollRef = useRef(scroll);
  scrollRef.current = scroll;

  useEffect(() => {
    const frame = layer.current?.parentElement;
    if (!frame) return;
    let pressed = false;

    const onUp = () => {
      if (!pressed) return;
      pressed = false;
      scrollRef.current.stop();
      engine.endLoopPaint();
    };
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || !(e.target as HTMLElement).closest(".at-surface")) return;
      const at = toHost(layer, { x: e.clientX, y: e.clientY, wholeBars: false });
      if (!at) return;
      pressed = true;
      engine.startLoopPaint(at.x, at.y);
    };
    const onMove = (e: MouseEvent) => {
      if (!pressed) return;
      if ((e.buttons & 1) === 0) return onUp();
      const pointer = { x: e.clientX, y: e.clientY, wholeBars: e.shiftKey };
      paintRef.current(pointer);
      scrollRef.current.track(pointer);
    };

    frame.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      frame.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [engine, layer]);
}

interface HandleProps {
  edge: "start" | "end";
  position: LoopEdge;
  layer: RefObject<HTMLDivElement | null>;
}

function Handle({ edge, position, layer }: HandleProps) {
  const engine = useEngine();
  const dragging = useRef(false);
  // The latest position, read by the scroll loop, which outlives the render that started it.
  const positionRef = useRef(position);
  positionRef.current = position;

  const resize = (pointer: Pointer) => {
    const at = toHost(layer, pointer);
    if (!at) return;
    const { top, height } = positionRef.current;
    engine.resizeLoop(edge, at.x, at.y, top + height / 2, pointer.wholeBars);
  };
  const scroll = useAutoScroll(layer, resize);

  const onMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const pointer = { x: e.clientX, y: e.clientY, wholeBars: e.shiftKey };
    resize(pointer);
    scroll.track(pointer);
  };

  const finish = () => {
    if (!dragging.current) return;
    dragging.current = false;
    scroll.stop();
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
        dragging.current = true;
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
