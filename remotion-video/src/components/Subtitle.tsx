import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface SubtitleProps {
  text: string;
  startFrame?: number;
  duration?: number;
}

export const Subtitle: React.FC<SubtitleProps> = ({
  text,
  startFrame = 0,
  duration = 120,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(
    frame,
    [startFrame, startFrame + 15, startFrame + duration - 15, startFrame + duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const translateY = interpolate(
    frame,
    [startFrame, startFrame + 15],
    [20, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 120,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity,
        transform: `translateY(${translateY}px)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "rgba(0, 0, 0, 0.7)",
          padding: "16px 32px",
          borderRadius: 12,
          maxWidth: "80%",
        }}
      >
        <p
          style={{
            fontSize: 28,
            color: "#ffffff",
            margin: 0,
            textAlign: "center",
            lineHeight: 1.5,
            fontWeight: 500,
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
};
