import { useCurrentFrame, useVideoConfig, spring, interpolate, staticFile } from "remotion";
import { Audio } from "remotion";
import { Background, Card, AnimatedNumber } from "../components";

export const StatsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 标题淡入
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const stats = [
    { label: "今日番茄", value: 6, suffix: "个", format: "number" as const },
    { label: "今日专注", value: 150, suffix: "", format: "duration" as const },
    { label: "总番茄", value: 42, suffix: "个", format: "number" as const },
    { label: "总专注", value: 1080, suffix: "", format: "duration" as const },
  ];

  return (
    <Background>
      {/* 场景配音 */}
      <Audio src={staticFile("voiceover/stats.mp3")} volume={1} />

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
          专注统计
        </h2>
        <p style={{ fontSize: 24, color: "#a0a0a0", marginTop: 8 }}>
          今日/累计番茄数和专注时长一目了然
        </p>
      </div>

      {/* 统计卡片网格 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginTop: 60,
          padding: "0 60px",
        }}
      >
        {stats.map((stat, index) => (
          <Card
            key={stat.label}
            delay={40 + index * 25}
            animation="slideUp"
            style={{
              minWidth: 200,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 16,
                color: "#a0a0a0",
                marginBottom: 12,
              }}
            >
              {stat.label}
            </div>
            <div
              style={{
                fontSize: 48,
                fontWeight: "bold",
                color: "#FF6347",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <AnimatedNumber
                value={stat.value}
                duration={60}
                delay={40 + index * 25 + 35}
                format={stat.format}
                suffix={stat.suffix}
              />
            </div>
          </Card>
        ))}
      </div>

      {/* 装饰性说明 */}
      <div
        style={{
          position: "absolute",
          bottom: 140,
          opacity: interpolate(frame, [120, 150], [0, 1], { extrapolateRight: "clamp" }),
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 20, color: "#a0a0a0" }}>
          📊 数据自动同步，随时掌握专注情况
        </p>
      </div>
    </Background>
  );
};
