import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon, type IconName } from "./Icon";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: IconName;
  children?: ReactNode;
}

export function Button({ variant = "secondary", icon, children, className, ...props }: ButtonProps) {
  return (
    <button type="button" className={cx(styles.button, styles[variant], className)} {...props}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  active?: boolean;
  size?: "md" | "lg";
}

/** A square, icon-only button. `label` is required for screen readers and the tooltip. */
export function IconButton({ icon, label, active, size = "md", className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cx(styles.iconButton, styles[size], active && styles.active, className)}
      {...props}
    >
      <Icon name={icon} size={size === "lg" ? 26 : 18} />
    </button>
  );
}
