import { useRef, type ReactNode } from "react";
import { IconButton } from "./Button";
import styles from "./Sheet.module.css";
import { useDismiss } from "./useDismiss";

interface SheetProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** A panel that slides in from the right edge, over the score. */
export function Sheet({ title, open, onClose, children }: SheetProps) {
  const panel = useRef<HTMLElement>(null);
  useDismiss([panel], open, onClose);
  if (!open) return null;

  return (
    <aside ref={panel} className={styles.sheet} aria-label={title}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <IconButton icon="close" label="Close" onClick={onClose} />
      </header>
      <div className={styles.body}>{children}</div>
    </aside>
  );
}
