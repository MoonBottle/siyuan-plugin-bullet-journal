import { useCurrentFrame, useVideoConfig, spring, interpolate, staticFile } from "remotion";
import { Audio, Img } from "remotion";
import { Background, TomatoIcon } from "../components";

export const EndingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // CTA 动画
  const ctaOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const ctaScale = interpolate(frame, [0, 30], [0.8, 1], { extrapolateRight: "clamp" });

  // 步骤动画
  const stepsOpacity = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });

  // GitHub 链接动画
  const githubOpacity = interpolate(frame, [100, 120], [0, 1], { extrapolateRight: "clamp" });

  // 二维码区域动画
  const qrOpacity = interpolate(frame, [140, 160], [0, 1], { extrapolateRight: "clamp" });

  return (
    <Background>
      {/* 场景配音 */}
      <Audio src={staticFile("voiceover/ending.mp3")} volume={1} />

      {/* 番茄图标 */}
      <div
        style={{
          opacity: ctaOpacity,
          transform: `scale(${ctaScale})`,
          marginBottom: 24,
        }}
      >
        <TomatoIcon size={100} color="#FF6347" animate="pulse" />
      </div>

      {/* CTA 标题 */}
      <div
        style={{
          opacity: ctaOpacity,
          textAlign: "center",
          marginBottom: 40,
        }}
      >
        <h2
          style={{
            fontSize: 56,
            fontWeight: "bold",
            color: "#ffffff",
            margin: 0,
          }}
        >
          立即体验
        </h2>
        <p
          style={{
            fontSize: 24,
            color: "#a0a0a0",
            marginTop: 12,
          }}
        >
          让番茄工作法提升你的效率
        </p>
      </div>

      {/* 更新步骤 */}
      <div
        style={{
          opacity: stepsOpacity,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          marginBottom: 40,
          padding: "0 60px",
          width: "100%",
          maxWidth: 500,
        }}
      >
        {[
          { step: 1, text: "打开思源笔记" },
          { step: 2, text: "进入 集市 → 已下载" },
          { step: 3, text: "找到「任务助手」点击更新" },
        ].map((item, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: "#16213e",
              padding: "16px 24px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#FF6347",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: "bold",
                color: "#fff",
              }}
            >
              {item.step}
            </div>
            <span style={{ fontSize: 20, color: "#ffffff" }}>{item.text}</span>
          </div>
        ))}
      </div>

      {/* GitHub 链接 */}
      <div
        style={{
          opacity: githubOpacity,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(255,255,255,0.05)",
            padding: "12px 24px",
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 24 }}>⭐</span>
          <span style={{ fontSize: 16, color: "#a0a0a0" }}>
            GitHub: github.com/MoonBottle/siyuan-plugin-bullet-journal
          </span>
        </div>
      </div>

      {/* 公众号二维码 */}
      <div
        style={{
          opacity: qrOpacity,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 220,
            height: 220,
            background: "#fff",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
            padding: 10,
          }}
        >
          <Img
            src={staticFile("qrcode_for_gh_8cb0a9f23ea0_258.jpg")}
            style={{
              width: 200,
              height: 200,
              borderRadius: 4,
            }}
          />
        </div>
        <p style={{ fontSize: 16, color: "#a0a0a0", marginTop: 10 }}>
          扫码关注公众号
        </p>
      </div>
    </Background>
  );
};
