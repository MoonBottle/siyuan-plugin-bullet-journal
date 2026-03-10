import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

interface TomatoIconProps {
  size?: number;
  color?: string;
  animate?: "bounce" | "pulse" | "none";
  delay?: number;
}

export const TomatoIcon: React.FC<TomatoIconProps> = ({
  size = 120,
  color = "#FF6347",
  animate = "bounce",
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let scale = 1;
  let rotation = 0;

  if (animate === "bounce") {
    const bounceProgress = spring({
      frame: frame - delay,
      fps,
      config: { damping: 10, stiffness: 100 },
    });
    scale = interpolate(bounceProgress, [0, 1], [0, 1]);
  } else if (animate === "pulse") {
    const pulseProgress = interpolate(
      frame % 60,
      [0, 30, 60],
      [1, 1.1, 1],
      { extrapolateRight: "clamp" }
    );
    scale = pulseProgress;
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        transition: "transform 0.1s linear",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 番茄主体 */}
        <ellipse
          cx="50"
          cy="55"
          rx="35"
          ry="32"
          fill={color}
        />
        {/* 高光 */}
        <ellipse
          cx="38"
          cy="45"
          rx="10"
          ry="8"
          fill="rgba(255,255,255,0.3)"
        />
        {/* 番茄蒂 */}
        <path
          d="M50 23 L45 10 M50 23 L50 8 M50 23 L55 10"
          stroke="#228B22"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M35 25 Q50 15 65 25 Q60 30 50 28 Q40 30 35 25"
          fill="#228B22"
        />
      </svg>
    </div>
  );
};
