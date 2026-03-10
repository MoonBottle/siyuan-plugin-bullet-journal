import { Composition, AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import {
  OpeningScene,
  FocusTimerScene,
  StatsScene,
  RecordsScene,
  AIAssistantScene,
  PomodoroIntroScene,
  EndingScene,
} from "./scenes";

// 场景时长配置（帧数，30fps）
const SCENE_DURATIONS = {
  opening: 240,      // 8秒
  focusTimer: 300,   // 10秒
  stats: 300,        // 10秒
  records: 210,      // 7秒
  aiAssistant: 300,  // 10秒
  pomodoroIntro: 300, // 10秒
  ending: 300,       // 10秒
};

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="PomodoroPromo"
        component={PomodoroPromoVideo}
        durationInFrames={1950} // 65秒
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
    </>
  );
};

const PomodoroPromoVideo: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: "#1a1a2e",
      }}
    >
      <TransitionSeries>
        {/* 开场场景 */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.opening}>
          <OpeningScene />
        </TransitionSeries.Sequence>

        {/* 转场 */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* 专注计时场景 */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.focusTimer}>
          <FocusTimerScene />
        </TransitionSeries.Sequence>

        {/* 转场 */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* 统计数据场景 */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.stats}>
          <StatsScene />
        </TransitionSeries.Sequence>

        {/* 转场 */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* 记录列表演示场景 */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.records}>
          <RecordsScene />
        </TransitionSeries.Sequence>

        {/* 转场 */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* AI 智能助手场景 */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.aiAssistant}>
          <AIAssistantScene />
        </TransitionSeries.Sequence>

        {/* 转场 */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* 价值主张场景 */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.pomodoroIntro}>
          <PomodoroIntroScene />
        </TransitionSeries.Sequence>

        {/* 转场 */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* 结尾场景 */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.ending}>
          <EndingScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
