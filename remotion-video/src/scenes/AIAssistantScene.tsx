import { useCurrentFrame, useVideoConfig, interpolate, staticFile } from "remotion";
import { Audio } from "remotion";
import { Background } from "../components";

export const AIAssistantScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 标题淡入
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // 用户消息动画
  const userMsgOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });
  const userMsgX = interpolate(frame, [30, 50], [50, 0], { extrapolateRight: "clamp" });

  // AI 回复动画（打字机效果）
  const aiReplyOpacity = interpolate(frame, [70, 90], [0, 1], { extrapolateRight: "clamp" });

  // 工具调用动画
  const toolOpacity = interpolate(frame, [100, 120], [0, 1], { extrapolateRight: "clamp" });

  // 报告卡片动画
  const reportOpacity = interpolate(frame, [160, 180], [0, 1], { extrapolateRight: "clamp" });
  const reportY = interpolate(frame, [160, 180], [30, 0], { extrapolateRight: "clamp" });

  // 打字机效果文本
  const fullText = "我来帮您查看今天的专注度情况。";
  const charCount = Math.min(
    Math.floor((frame - 90) / 3),
    fullText.length
  );
  const displayText = fullText.slice(0, charCount);

  return (
    <Background>
      {/* 场景配音 */}
      <Audio src={staticFile("voiceover/ai-assistant.mp3")} volume={1} />

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
          AI 智能助手
        </h2>
        <p style={{ fontSize: 24, color: "#a0a0a0", marginTop: 8 }}>
          一句话查询专注统计和记录
        </p>
      </div>

      {/* 对话界面 */}
      <div
        style={{
          width: "calc(100% - 80px)",
          maxWidth: 800,
          marginTop: 40,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* 用户消息 */}
        <div
          style={{
            opacity: userMsgOpacity,
            transform: `translateX(${userMsgX}px)`,
            alignSelf: "flex-end",
            background: "#3b82f6",
            padding: "16px 24px",
            borderRadius: "20px 20px 4px 20px",
            maxWidth: "80%",
          }}
        >
          <span style={{ fontSize: 18, color: "#ffffff" }}>
            今天专注度怎么样
          </span>
        </div>

        {/* AI 头像和回复 */}
        <div
          style={{
            opacity: aiReplyOpacity,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          {/* AI 头像 */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            🤖
          </div>

          <div style={{ flex: 1 }}>
            {/* AI 名称 */}
            <div
              style={{
                fontSize: 16,
                color: "#a0a0a0",
                marginBottom: 4,
              }}
            >
              任务助手
            </div>

            {/* AI 回复内容 */}
            <div
              style={{
                background: "#16213e",
                padding: "16px 20px",
                borderRadius: "4px 20px 20px 20px",
                fontSize: 18,
                color: "#ffffff",
                lineHeight: 1.6,
              }}
            >
              {displayText}
              {frame < 90 + fullText.length * 3 && (
                <span style={{ opacity: 0.5 }}>|</span>
              )}
            </div>
          </div>
        </div>

        {/* 工具调用展示 */}
        <div
          style={{
            opacity: toolOpacity,
            marginLeft: 56,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {[
            { name: "get_user_time", icon: "⏱️" },
            { name: "get_pomodoro_stats", icon: "📊" },
            { name: "get_pomodoro_records", icon: "📝" },
          ].map((tool, index) => (
            <div
              key={tool.name}
              style={{
                opacity: interpolate(
                  frame,
                  [120 + index * 10, 140 + index * 10],
                  [0, 1],
                  { extrapolateRight: "clamp" }
                ),
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(245, 166, 35, 0.15)",
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid rgba(245, 166, 35, 0.3)",
                width: "fit-content",
              }}
            >
              <span>{tool.icon}</span>
              <span style={{ fontSize: 14, color: "#f5a623" }}>{tool.name}</span>
            </div>
          ))}
        </div>

        {/* 专注度报告卡片 */}
        <div
          style={{
            opacity: reportOpacity,
            transform: `translateY(${reportY}px)`,
            marginLeft: 56,
            marginTop: 8,
            background: "#16213e",
            borderRadius: 16,
            padding: 24,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <h3
            style={{
              fontSize: 20,
              color: "#ffffff",
              margin: "0 0 16px 0",
              fontWeight: 600,
            }}
          >
            📈 今日专注度报告
          </h3>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, color: "#a0a0a0", marginBottom: 8 }}>
              总体数据：
            </div>
            <div style={{ display: "flex", gap: 24 }}>
              <div>
                <span style={{ fontSize: 14, color: "#a0a0a0" }}>番茄钟数量：</span>
                <span style={{ fontSize: 18, color: "#FF6347", fontWeight: 600 }}>2个</span>
              </div>
              <div>
                <span style={{ fontSize: 14, color: "#a0a0a0" }}>总专注时间：</span>
                <span style={{ fontSize: 18, color: "#4CAF50", fontWeight: 600 }}>40分钟</span>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 16, color: "#a0a0a0", marginBottom: 8 }}>
              详细记录：
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 8,
                fontSize: 13,
              }}
            >
              <div style={{ color: "#a0a0a0" }}>时间</div>
              <div style={{ color: "#a0a0a0" }}>计划时长</div>
              <div style={{ color: "#a0a0a0" }}>实际时长</div>
              <div style={{ color: "#a0a0a0" }}>专注事项</div>
              <div style={{ color: "#a0a0a0" }}>所属项目</div>

              <div style={{ color: "#fff" }}>14:00-14:30</div>
              <div style={{ color: "#fff" }}>30分钟</div>
              <div style={{ color: "#FF6347" }}>15分钟</div>
              <div style={{ color: "#fff" }}>确定设计风格</div>
              <div style={{ color: "#a0a0a0" }}>网站重构项目</div>

              <div style={{ color: "#fff" }}>14:00-14:25</div>
              <div style={{ color: "#fff" }}>25分钟</div>
              <div style={{ color: "#4CAF50" }}>25分钟</div>
              <div style={{ color: "#fff" }}>完成首页原型设计</div>
              <div style={{ color: "#a0a0a0" }}>网站重构项目</div>
            </div>
          </div>
        </div>
      </div>
    </Background>
  );
};
