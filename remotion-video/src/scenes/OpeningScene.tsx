import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { Background, TomatoIcon } from "../components";

export const OpeningScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 番茄图标弹跳动画
  const tomatoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  // 标题淡入动画
  const titleOpacity = interpolate(
    frame,
    [30, 60],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const titleY = interpolate(
    frame,
    [30, 60],
    [30, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // 副标题淡入动画
  const subtitleOpacity = interpolate(
    frame,
    [60, 90],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // 品牌信息淡入
  const brandOpacity = interpolate(
    frame,
    [120, 150],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <Background>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        {/* 番茄图标 */}
        <div
          style={{
            transform: `scale(${interpolate(tomatoScale, [0, 1], [0, 1])})`,
          }}
        >
          <TomatoIcon size={160} color="#FF6347" animate="none" />
        </div>

        {/* 主标题 */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            textAlign: "center",
          }}
        >
          <h1
            style={{
              fontSize: 56,
              fontWeight: "bold",
              color: "#ffffff",
              margin: 0,
              textShadow: "0 2px 10px rgba(0,0,0,0.3)",
            }}
          >
            🍅 番茄钟功能上线
          </h1>
        </div>

        {/* 副标题 */}
        <div
          style={{
            opacity: subtitleOpacity,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 32,
              color: "#FF6347",
              margin: 0,
              fontWeight: 500,
            }}
          >
            任务助手 v0.9.1
          </p>
        </div>

        {/* 品牌信息 */}
        <div
          style={{
            opacity: brandOpacity,
            marginTop: 40,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: "bold",
              color: "white",
            }}
          >
            Si
          </div>
          <span style={{ fontSize: 20, color: "#a0a0a0" }}>
            思源笔记 · 任务助手插件
          </span>
        </div>
      </div>
    </Background>
  );
};
