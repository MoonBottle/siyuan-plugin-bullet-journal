import {
  Composition,
  AbsoluteFill,
  staticFile,
  CalculateMetadataFunction,
} from "remotion";
import { Audio } from "remotion";
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
import {
  SCENE_AUDIO_FILES,
  getAudioDurations,
  calculateSceneDurations,
  calculateTotalDuration,
} from "./utils";

const FPS = 30;
const TRANSITION_DURATION = 15; // 转场时长（帧）

// 定义 Props 类型
interface VideoProps {
  sceneDurations?: number[];
}

// 计算元数据（动态设置视频时长）
export const calculateMetadata: CalculateMetadataFunction<VideoProps> = async ({
  props,
}) => {
  // 获取音频时长
  const audioDurations = await getAudioDurations();

  // 计算场景时长（帧数）
  const sceneDurations = calculateSceneDurations(audioDurations, FPS);

  // 计算总时长
  const totalDuration = calculateTotalDuration(sceneDurations, TRANSITION_DURATION);

  // 添加一些缓冲时间（让音频播放完整）
  const durationWithBuffer = totalDuration + FPS * 2; // 额外2秒

  return {
    durationInFrames: durationWithBuffer,
    props: {
      ...props,
      sceneDurations,
    },
  };
};

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="PomodoroPromo"
        component={PomodoroPromoVideo}
        durationInFrames={1950} // 默认65秒，实际会根据音频动态计算
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          sceneDurations: [240, 300, 300, 210, 300, 300, 300], // 默认时长
        }}
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};

const PomodoroPromoVideo: React.FC<VideoProps> = ({ sceneDurations = [] }) => {
  // 使用传入的场景时长或默认值
  const durations =
    sceneDurations.length > 0
      ? sceneDurations
      : [240, 300, 300, 210, 300, 300, 300];

  return (
    <AbsoluteFill
      style={{
        background: "#1a1a2e",
      }}
    >
      {/* 场景配音 */}
      <SceneVoiceovers />

      <TransitionSeries>
        {/* 开场场景 */}
        <TransitionSeries.Sequence durationInFrames={durations[0]}>
          <OpeningScene />
        </TransitionSeries.Sequence>

        {/* 转场 */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* 专注计时场景 */}
        <TransitionSeries.Sequence durationInFrames={durations[1]}>
          <FocusTimerScene />
        </TransitionSeries.Sequence>

        {/* 转场 */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* 统计数据场景 */}
        <TransitionSeries.Sequence durationInFrames={durations[2]}>
          <StatsScene />
        </TransitionSeries.Sequence>

        {/* 转场 */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* 记录列表演示场景 */}
        <TransitionSeries.Sequence durationInFrames={durations[3]}>
          <RecordsScene />
        </TransitionSeries.Sequence>

        {/* 转场 */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* AI 智能助手场景 */}
        <TransitionSeries.Sequence durationInFrames={durations[4]}>
          <AIAssistantScene />
        </TransitionSeries.Sequence>

        {/* 转场 */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* 价值主张场景 */}
        <TransitionSeries.Sequence durationInFrames={durations[5]}>
          <PomodoroIntroScene />
        </TransitionSeries.Sequence>

        {/* 转场 */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* 结尾场景 */}
        <TransitionSeries.Sequence durationInFrames={durations[6]}>
          <EndingScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

// 场景配音组件
const SceneVoiceovers: React.FC = () => {
  return (
    <>
      {SCENE_AUDIO_FILES.map((file, index) => (
        <Audio
          key={file}
          src={staticFile(file)}
          volume={1}
          // 每个音频在对应场景开始时播放
          // 由于 TransitionSeries 的复杂性，我们在每个场景内单独控制音频
        />
      ))}
    </>
  );
};
