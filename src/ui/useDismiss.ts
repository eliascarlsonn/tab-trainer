import { useEffect, type RefObject } from "react";

type Refs = readonly RefObject<HTMLElement | null>[];

/** Calls `onDismiss` on Escape or on a pointer press outside all `refs`, while `active`. */
export function useDismiss(refs: Refs, active: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!active) return;
    const onPointer = (e: PointerEvent) => {
      const inside = refs.some((ref) => ref.current?.contains(e.target as Node));
      if (!inside) onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
    // `refs` holds stable ref objects; the array identity changing each render is irrelevant.
  }, [active, onDismiss]);
}
