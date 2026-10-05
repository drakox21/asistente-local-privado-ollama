import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { THEME } from "../constants";

const ACTIVITY_BARS = [0, 1, 2, 3, 4];

const GRID_BACKGROUND_STYLE: CSSProperties = {
  backgroundColor: THEME.beigeLight,
  backgroundImage: `
    linear-gradient(${THEME.beigeDark} 1px, transparent 1px),
    linear-gradient(90deg, ${THEME.beigeDark} 1px, transparent 1px)
  `,
  backgroundSize: "40px 40px",
};

export const AppGridBackground = ({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className: string;
  style?: CSSProperties;
}) => (
  <div className={className} style={{ ...GRID_BACKGROUND_STYLE, ...style }}>
    {children}
  </div>
);

export const MicrophoneIcon = ({
  className,
  strokeWidth = 2,
  style,
}: {
  className: string;
  strokeWidth?: number;
  style?: CSSProperties;
}) => (
  <svg
    className={className}
    style={style}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={strokeWidth}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 10v2a7 7 0 01-14 0v-2"
    />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

export const VoiceMeter = ({
  color,
  active = false,
}: {
  color: string;
  active?: boolean;
}) => (
  <div className="flex items-end justify-center gap-1.5">
    {ACTIVITY_BARS.map((bar) => (
      <span
        key={bar}
        className={`voice-meter-bar${active ? " is-active" : ""}`}
        style={{
          backgroundColor: color,
          animationDelay: `${bar * 120}ms`,
        }}
      />
    ))}
  </div>
);

export const useMountedTransition = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
};

export const ErrorMessageBox = ({
  message,
  className,
}: {
  message: string;
  className?: string;
}) => (
  <div
    className={className}
    style={{
      backgroundColor: `${THEME.errorRed}0D`,
      borderColor: `${THEME.errorRed}33`,
    }}
  >
    <p
      className="font-mono text-xs break-words"
      style={{ color: THEME.errorRed }}
    >
      {`> Error: ${message}`}
    </p>
  </div>
);
