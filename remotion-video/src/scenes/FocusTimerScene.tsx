import { useCurrentFrame, useVideoConfig, interpolate, staticFile } from "remotion";
import { Audio } from "remotion";
import { Background, ProgressRing } from "../components";

export const FocusTimerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 总时长 25 分钟 = 1500 秒
  const totalSeconds = 25 * 60;
  // 模拟倒计时：从 25:00 到 24:30（展示 30 秒的倒计时）
  const elapsedSeconds = Math.min(frame, 30);
  const remainingSeconds = totalSeconds - elapsedSeconds;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeText = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  // 进度计算
  const progress = elapsedSeconds / totalSeconds;

  // 标题淡入
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // 脉冲动画
  const pulseScale = interpolate(frame % 60, [0, 30, 60], [1, 1.05, 1]);

  return (
    <Background>
      {/* 场景配音 */}
      <Audio src={staticFile("voiceover/focus-timer.mp3")} volume={1} />

      {/* 标题 */}
      <div
        style={{
          position: "absolute",
          top: 120,
          opacity: titleOpacity,
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: 40, color: "#ffffff", margin: 0 }}>
          专注计时
        </h2>
        <p style={{ fontSize: 24, color: "#a0a0a0", marginTop: 8 }}>
          内置倒计时器，支持暂停/继续
        </p>
      </div>

      {/* 计时器圆环 */}
      <div style={{ marginTop: 40 }}>
        <ProgressRing
          radius={140}
          strokeWidth={12}
          progress={1 - progress}
          color="#FF6347"
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            {/* 时间显示 */}
            <div
              style={{
                fontSize: 72,
                fontWeight: "bold",
                color: "#ffffff",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: 4,
              }}
            >
              {timeText}
            </div>

            {/* 专注中标签 */}
            <div
              style={{
                transform: `scale(${pulseScale})`,
                background: "linear-gradient(135deg, #FF6347, #e94560)",
                padding: "8px 24px",
                borderRadius: 20,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#fff",
                  animation: "pulse 1s infinite",
                }}
              />
              <span style={{ color: "#fff", fontSize: 18, fontWeight: 500 }}>
                专注中
              </span>
            </div>

            {/* 已专注时长 */}
            <div style={{ fontSize: 16, color: "#a0a0a0", marginTop: 8 }}>
              已专注 {elapsedSeconds} 分钟
            </div>
          </div>
        </ProgressRing>
      </div>

      {/* 按钮展示 */}
      <div
        style={{
          position: "absolute",
          bottom: 160,
          display: "flex",
          gap: 24,
          opacity: interpolate(frame, [60, 90], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div
          style={{
            padding: "16px 40px",
            background: "rgba(245, 166, 35, 0.9)",
            borderRadius: 12,
            color: "#fff",
            fontSize: 20,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>⏸️</span> 暂停
        </div>
        <div
          style={{
            padding: "16px 40px",
            background: "rgba(76, 175, 80, 0.9)",
            borderRadius: 12,
            color: "#fff",
            fontSize: 20,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>✓</span> 结束专注
        </div>
      </div>
    </Background>
  );
};
