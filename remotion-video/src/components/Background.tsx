import { useCurrentFrame, interpolate } from "remotion";

interface BackgroundProps {
  children?: React.ReactNode;
}

export const Background: React.FC<BackgroundProps> = ({ children }) => {
  const frame = useCurrentFrame();

  // 微妙的背景动画
  const gradientOffset = interpolate(frame % 300, [0, 150, 300], [0, 10, 0]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: `linear-gradient(${135 + gradientOffset}deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 装饰性背景元素 */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,99,71,0.1) 0%, transparent 70%)",
          top: -200,
          right: -200,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(76,175,80,0.08) 0%, transparent 70%)",
          bottom: -100,
          left: -100,
        }}
      />
      {children}
    </div>
  );
};
