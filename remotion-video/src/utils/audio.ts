/**
 * 音频工具函数
 * 用于获取音频时长和生成音频序列
 */

import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { staticFile } from "remotion";

// 场景音频配置
export const SCENE_AUDIO_FILES = [
  "voiceover/opening.mp3",
  "voiceover/focus-timer.mp3",
  "voiceover/stats.mp3",
  "voiceover/records.mp3",
  "voiceover/ai-assistant.mp3",
  "voiceover/pomodoro-intro.mp3",
  "voiceover/ending.mp3",
];

// 场景名称映射
export const SCENE_NAMES = [
  "开场",
  "专注计时",
  "统计数据",
  "记录列表",
  "AI助手",
  "番茄工作法",
  "结尾",
];

/**
 * 获取所有音频文件的时长
 * @returns 每个音频的时长（秒）
 */
export async function getAudioDurations(): Promise<number[]> {
  const durations = await Promise.all(
    SCENE_AUDIO_FILES.map(async (file) => {
      try {
        const duration = await getAudioDurationInSeconds(staticFile(file));
        return duration;
      } catch (error) {
        console.warn(`无法获取音频时长: ${file}`, error);
        return 0;
      }
    })
  );
  return durations;
}

/**
 * 计算场景时长（帧数）
 * @param durations 音频时长数组（秒）
 * @param fps 帧率
 * @returns 每个场景的时长（帧数）
 */
export function calculateSceneDurations(
  durations: number[],
  fps: number
): number[] {
  return durations.map((duration) => Math.ceil(duration * fps));
}

/**
 * 计算总时长
 * @param sceneDurations 场景时长数组（帧数）
 * @param transitionDuration 转场时长（帧数）
 * @returns 总时长（帧数）
 */
export function calculateTotalDuration(
  sceneDurations: number[],
  transitionDuration: number = 15
): number {
  const totalScenes = sceneDurations.length;
  const totalTransitions = Math.max(0, totalScenes - 1);
  
  const scenesTotal = sceneDurations.reduce((sum, d) => sum + d, 0);
  const transitionsTotal = totalTransitions * transitionDuration;
  
  return scenesTotal + transitionsTotal;
}
