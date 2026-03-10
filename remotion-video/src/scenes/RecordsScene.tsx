import { useCurrentFrame, useVideoConfig, spring, interpolate, staticFile } from "remotion";
import { Audio } from "remotion";
import { Background, Card } from "../components";

interface RecordItem {
  time: string;
  duration: string;
  content: string;
  project: string;
}

export const RecordsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 标题淡入
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const records: RecordItem[] = [
    { time: "14:00-14:25", duration: "25m", content: "完成文章大纲", project: "写作项目" },
    { time: "15:00-15:45", duration: "45m", content: "修复登录bug", project: "网站重构" },
    { time: "16:00-16:25", duration: "25m", content: "阅读《深度学习》", project: "学习计划" },
    { time: "20:00-20:25", duration: "25m", content: "总结今日学习", project: "学习计划" },
  ];

  return (
    <Background>
      {/* 场景配音 */}
      <Audio src={staticFile("voiceover/records.mp3")} volume={1} />

      {/* 标题 */}
      <div
        style={{
          position: "absolute",
          top: 100,
          opacity: titleOpacity,
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: 40, color: "#ffffff", margin: 0 }}>
          专注记录
        </h2>
        <p style={{ fontSize: 24, color: "#a0a0a0", marginTop: 8 }}>
          按日期分组，历史记录一目了然
        </p>
      </div>

      {/* 日期标题 */}
      <div
        style={{
          marginTop: 40,
          marginBottom: 16,
          padding: "0 60px",
          width: "100%",
          opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div
          style={{
            fontSize: 20,
            color: "#a0a0a0",
            padding: "8px 16px",
            background: "rgba(255,255,255,0.05)",
            borderRadius: 8,
            display: "inline-block",
          }}
        >
          📅 3月10日
        </div>
      </div>

      {/* 记录列表 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "0 60px",
          width: "100%",
          maxWidth: 800,
        }}
      >
        {records.map((record, index) => {
          const itemOpacity = interpolate(
            frame,
            [40 + index * 10, 60 + index * 10],
            [0, 1],
            { extrapolateRight: "clamp" }
          );
          const itemX = interpolate(
            frame,
            [40 + index * 10, 60 + index * 10],
            [50, 0],
            { extrapolateRight: "clamp" }
          );

          return (
            <div
              key={index}
              style={{
                opacity: itemOpacity,
                transform: `translateX(${itemX}px)`,
                background: "#16213e",
                borderRadius: 12,
                padding: 16,
                display: "flex",
                alignItems: "center",
                gap: 16,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {/* 番茄图标 */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "rgba(255,99,71,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                }}
              >
                🍅
              </div>

              {/* 时间 */}
              <div
                style={{
                  fontSize: 18,
                  color: "#ffffff",
                  fontVariantNumeric: "tabular-nums",
                  minWidth: 120,
                }}
              >
                {record.time}
              </div>

              {/* 时长 */}
              <div
                style={{
                  fontSize: 16,
                  color: "#FF6347",
                  fontWeight: 500,
                  minWidth: 50,
                }}
              >
                {record.duration}
              </div>

              {/* 内容 */}
              <div
                style={{
                  flex: 1,
                  fontSize: 18,
                  color: "#ffffff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {record.content}
              </div>

              {/* 项目标签 */}
              <div
                style={{
                  fontSize: 14,
                  color: "#a0a0a0",
                  background: "rgba(255,255,255,0.05)",
                  padding: "4px 12px",
                  borderRadius: 12,
                }}
              >
                {record.project}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部说明 */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          opacity: interpolate(frame, [100, 130], [0, 1], { extrapolateRight: "clamp" }),
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 18, color: "#a0a0a0" }}>
          点击记录可跳转到思源笔记对应位置
        </p>
      </div>
    </Background>
  );
};
