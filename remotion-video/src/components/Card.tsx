import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

interface CardProps {
  children: React.ReactNode;
  delay?: number;
  animation?: "slideUp" | "fadeIn" | "scale";
  style?: React.CSSProperties;
  bgColor?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  delay = 0,
  animation = "slideUp",
  style = {},
  bgColor = "#16213e",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  let transform = "none";
  let opacity = interpolate(progress, [0, 1], [0, 1]);

  if (animation === "slideUp") {
    const translateY = interpolate(progress, [0, 1], [50, 0]);
    transform = `translateY(${translateY}px)`;
  } else if (animation === "scale") {
    const scale = interpolate(progress, [0, 1], [0.8, 1]);
    transform = `scale(${scale})`;
  }

  return (
    <div
      style={{
        backgroundColor: bgColor,
        borderRadius: 16,
        padding: 24,
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        transform,
        opacity,
        transition: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
