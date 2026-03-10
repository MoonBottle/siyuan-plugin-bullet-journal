import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  delay?: number;
  format?: "number" | "duration";
  suffix?: string;
  style?: React.CSSProperties;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 60,
  delay = 0,
  format = "number",
  suffix = "",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const animatedValue = interpolate(
    frame - delay,
    [0, duration],
    [0, value],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const displayValue = Math.floor(animatedValue);

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
  };

  const displayText =
    format === "duration" ? formatDuration(displayValue) : `${displayValue}${suffix}`;

  return (
    <span
      style={{
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
    >
      {displayText}
    </span>
  );
};
