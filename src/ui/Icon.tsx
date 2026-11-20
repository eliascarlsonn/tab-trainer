/** Stroke icons drawn on a 24px grid. */
const PATHS = {
  play: "M7 4.5v15l12.5-7.5z",
  pause: "M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z",
  stop: "M6 6h12v12H6z",
  back: "M15 5l-7 7 7 7",
  skipBack: "M18 6l-7 6 7 6zM7 6v12",
  skipForward: "M6 6l7 6-7 6zM17 6v12",
  loop: "M17 3l3 3-3 3M4 11V9a3 3 0 013-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 01-3 3H4",
  close: "M6 6l12 12M18 6L6 18",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6",
  video:
    "M3 6.5A1.5 1.5 0 014.5 5h10A1.5 1.5 0 0116 6.5v11a1.5 1.5 0 01-1.5 1.5h-10A1.5 1.5 0 013 17.5zM16 10l5-3v10l-5-3",
  waveform: "M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  chevronDown: "M6 9l6 6 6-6",
  music: "M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM20 16a3 3 0 11-6 0 3 3 0 016 0z",
  check: "M5 12.5l4.5 4.5L19 7",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
  eyeOff:
    "M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.1M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.7 9.7 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2",
  keyboard:
    "M3 6.5A1.5 1.5 0 014.5 5h15A1.5 1.5 0 0121 6.5v11a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5zM7 9h.01M11 9h.01M15 9h.01M7 13h.01M17 13h.01M9 16h6",
} as const;

export type IconName = keyof typeof PATHS;

const FILLED: ReadonlySet<IconName> = new Set(["play", "pause", "stop", "skipBack", "skipForward"]);

interface IconProps {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18 }: IconProps) {
  const filled = FILLED.has(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
