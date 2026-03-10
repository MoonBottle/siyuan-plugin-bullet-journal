import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { Background } from "../components";

export const PomodoroIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 标题淡入
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // 四个步骤
  const steps = [
    { icon: "📝", title: "选择任务", desc: "明确当前要完成的工作" },
    { icon: "⏱️", title: "设定计时", desc: "通常为25分钟" },
    { icon: "🎯", title: "专注工作", desc: "直到计时器响起" },
    { icon: "☕", title: "短暂休息", desc: "休息5分钟恢复精力" },
  ];

  // 效率数据动画
  const efficiencyOpacity = interpolate(frame, [140, 160], [0, 1], { extrapolateRight: "clamp" });
  const efficiencyScale = interpolate(frame, [140, 180], [0.8, 1], { extrapolateRight: "clamp" });

  return (
    <Background>
      {/* 标题 */}
      <div
        style={{
          position: "absolute",
          top: 80,
          opacity: titleOpacity,
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: 40, color: "#ffffff", margin: 0 }}>
          什么是番茄工作法？
        </h2>
        <p style={{ fontSize: 24, color: "#a0a0a0", marginTop: 8 }}>
          Pomodoro Technique
        </p>
      </div>

      {/* 四个步骤 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          marginTop: 40,
          padding: "0 60px",
          width: "100%",
          maxWidth: 600,
        }}
      >
        {steps.map((step, index) => {
          const stepOpacity = interpolate(
            frame,
            [30 + index * 20, 50 + index * 20],
            [0, 1],
            { extrapolateRight: "clamp" }
          );
          const stepX = interpolate(
            frame,
            [30 + index * 20, 50 + index * 20],
            [-50, 0],
            { extrapolateRight: "clamp" }
          );

          return (
            <div
              key={index}
              style={{
                opacity: stepOpacity,
                transform: `translateX(${stepX}px)`,
                display: "flex",
                alignItems: "center",
                gap: 20,
                background: "#16213e",
                padding: 20,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {/* 步骤序号 */}
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #FF6347, #e94560)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  flexShrink: 0,
                }}
              >
                {step.icon}
              </div>

              {/* 步骤内容 */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: "#ffffff",
                    marginBottom: 4,
                  }}
                >
                  {step.title}
                </div>
                <div style={{ fontSize: 16, color: "#a0a0a0" }}>
                  {step.desc}
                </div>
              </div>

              {/* 箭头（除了最后一个） */}
              {index < steps.length - 1 && (
                <div
                  style={{
                    fontSize: 24,
                    color: "#FF6347",
                    opacity: interpolate(
                      frame,
                      [50 + index * 20, 70 + index * 20],
                      [0, 1],
                      { extrapolateRight: "clamp" }
                    ),
                  }}
                >
                  →
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 效率提升数据 */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          opacity: efficiencyOpacity,
          transform: `scale(${efficiencyScale})`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, rgba(76,175,80,0.2), rgba(76,175,80,0.1))",
            padding: "20px 40px",
            borderRadius: 16,
            border: "1px solid rgba(76,175,80,0.3)",
          }}
        >
          <div style={{ fontSize: 18, color: "#a0a0a0", marginBottom: 8 }}>
            研究表明
          </div>
          <div style={{ fontSize: 36, fontWeight: "bold", color: "#4CAF50" }}>
            提升 30% 工作效率
          </div>
        </div>
      </div>
    </Background>
  );
};
