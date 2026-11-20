import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/cx";
import styles from "./Popover.module.css";
import { useDismiss } from "./useDismiss";

type Placement = "above" | "below";
type Align = "start" | "end";

interface PopoverProps {
  /** Renders the trigger; call `toggle` to open or close the panel. */
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  placement?: Placement;
  align?: Align;
  className?: string;
}

const GAP = 8;

/** Fixed-position coordinates next to the trigger, so no scrolling container can clip the panel. */
function panelPosition(anchor: DOMRect, placement: Placement, align: Align): CSSProperties {
  const vertical =
    placement === "below" ? { top: anchor.bottom + GAP } : { bottom: window.innerHeight - anchor.top + GAP };
  const horizontal = align === "start" ? { left: anchor.left } : { right: window.innerWidth - anchor.right };
  return { ...vertical, ...horizontal };
}

export function Popover({ trigger, children, placement = "below", align = "start", className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss([anchor, panel], open, close);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (rect) setPosition(panelPosition(rect, placement, align));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, placement, align]);

  return (
    <div ref={anchor} className={styles.anchor}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open &&
        createPortal(
          <div ref={panel} className={cx(styles.panel, styles[placement], className)} style={position} role="dialog">
            {children(close)}
          </div>,
          document.body,
        )}
    </div>
  );
}

interface MenuItemProps {
  children: ReactNode;
  onSelect: () => void;
  selected?: boolean;
  hint?: ReactNode;
  disabled?: boolean;
  /** A secondary control (e.g. an IconButton) shown at the end of the row, beside the item. */
  action?: ReactNode;
}

export function MenuItem({ children, onSelect, selected, hint, disabled, action }: MenuItemProps) {
  const item = (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      disabled={disabled}
      className={cx(styles.item, selected && styles.selected)}
      onClick={onSelect}
    >
      <span className={styles.itemText}>{children}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </button>
  );
  if (!action) return item;
  return (
    <div className={styles.row}>
      {item}
      {action}
    </div>
  );
}

export function MenuHeading({ children }: { children: ReactNode }) {
  return <div className={styles.heading}>{children}</div>;
}
