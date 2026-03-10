import { Config } from "@remotion/cli/config";

export const config: Config = {
  // 视频输出配置
  setDefaults: {
    width: 1080,
    height: 1920,
    fps: 30,
  },
  // 使用国内镜像下载 Chromium
  setChromiumHeadlessMode: true,
};

export default config;
