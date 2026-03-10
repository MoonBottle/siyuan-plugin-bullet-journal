/**
 * 免费 TTS 配音生成脚本
 * 使用 Edge TTS（微软 Edge 浏览器的免费 TTS 服务）
 * 
 * 安装依赖: npm install edge-tts
 * 运行: node scripts/generate-voiceover.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 确保输出目录存在
const outputDir = path.join(__dirname, '../public/voiceover');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 场景配音文案
const scenes = [
  {
    id: 'opening',
    text: '任务助手番茄钟功能正式上线！帮助你追踪专注时间，提升工作效率。',
    voice: 'zh-CN-XiaoxiaoNeural',
  },
  {
    id: 'focus-timer',
    text: '内置专注计时器，圆形进度条实时显示剩余时间。支持暂停和继续，让专注更灵活。',
    voice: 'zh-CN-XiaoxiaoNeural',
  },
  {
    id: 'stats',
    text: '全面的数据统计，今日番茄数、专注时长一目了然。累计数据帮助你长期追踪专注习惯。',
    voice: 'zh-CN-XiaoxiaoNeural',
  },
  {
    id: 'records',
    text: '所有专注记录自动保存在笔记中，按日期分组，历史记录随时查看。',
    voice: 'zh-CN-XiaoxiaoNeural',
  },
  {
    id: 'ai-assistant',
    text: 'AI 智能助手，一句话查询专注统计。生成专注度报告，分析工作效率。',
    voice: 'zh-CN-XiaoxiaoNeural',
  },
  {
    id: 'pomodoro-intro',
    text: '番茄工作法，单任务专注，规律休息。研究表明可提升百分之三十以上的工作效率。',
    voice: 'zh-CN-XiaoxiaoNeural',
  },
  {
    id: 'ending',
    text: '立即体验任务助手番茄钟功能，让专注成为一种习惯。更新插件，开启高效工作新模式。',
    voice: 'zh-CN-XiaoxiaoNeural',
  },
];

// 检查是否安装了 edge-tts
try {
  execSync('edge-tts --version', { stdio: 'ignore' });
} catch (error) {
  console.log('正在安装 edge-tts...');
  try {
    execSync('pip install edge-tts', { stdio: 'inherit' });
  } catch (e) {
    console.error('安装 edge-tts 失败，请手动运行: pip install edge-tts');
    process.exit(1);
  }
}

// 生成每个场景的配音
async function generateVoiceover() {
  console.log('开始生成配音...\n');

  for (const scene of scenes) {
    const outputFile = path.join(outputDir, `${scene.id}.mp3`);
    
    console.log(`生成: ${scene.id}`);
    console.log(`文案: ${scene.text}`);
    
    try {
      // 使用 edge-tts 生成音频
      const command = `edge-tts --voice "${scene.voice}" --text "${scene.text}" --write-media "${outputFile}"`;
      execSync(command, { stdio: 'ignore' });
      
      // 获取音频时长
      const stats = fs.statSync(outputFile);
      console.log(`✓ 完成: ${outputFile} (${(stats.size / 1024).toFixed(1)} KB)\n`);
    } catch (error) {
      console.error(`✗ 失败: ${scene.id}`, error.message);
    }
  }

  console.log('配音生成完成！');
  console.log(`音频文件保存在: ${outputDir}`);
}

generateVoiceover().catch(console.error);
