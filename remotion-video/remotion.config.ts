import { Config } from "@remotion/cli/config";

export const config: Config = {
  // 视频输出配置
  setDefaults: {
    width: 1080,
    height: 1920,
    fps: 30,
  },
  // 使用系统已安装的 Chrome，跳过下载
  setChromiumExecutable: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
};

export default config;
