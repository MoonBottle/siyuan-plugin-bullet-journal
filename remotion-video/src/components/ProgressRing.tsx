import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface ProgressRingProps {
  radius?: number;
  strokeWidth?: number;
  progress: number; // 0-1
  color?: string;
  bgColor?: string;
  children?: React.ReactNode;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  radius = 80,
  strokeWidth = 8,
  progress,
  color = "#FF6347",
  bgColor = "rgba(255,255,255,0.1)",
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const circumference = 2 * Math.PI * radius;
  const animatedProgress = interpolate(
    frame,
    [0, 60],
    [0, progress],
    { extrapolateRight: "clamp" }
  );
  const strokeDashoffset = circumference * (1 - animatedProgress);

  return (
    <div
      style={{
        position: "relative",
        width: radius * 2 + strokeWidth * 2,
        height: radius * 2 + strokeWidth * 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width={radius * 2 + strokeWidth * 2}
        height={radius * 2 + strokeWidth * 2}
        style={{
          position: "absolute",
          transform: "rotate(-90deg)",
        }}
      >
        {/* 背景圆环 */}
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        {/* 进度圆环 */}
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: "stroke-dashoffset 0.1s linear",
          }}
        />
      </svg>
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
};
