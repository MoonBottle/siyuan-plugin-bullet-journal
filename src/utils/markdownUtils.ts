/**
 * 预处理：确保行中的 ATX 标题前有换行（Markdown 要求标题在行首）
 * 用于修复 AI 流式输出时内容拼接缺少换行导致的标题渲染失败
 * 注意：[^\n#] 避免将 ## 误拆为 #\n#（前导字符不能是 #）
 */
export function ensureHeadingNewlines(text: string): string {
  if (text == null || typeof text !== 'string') return '';
  return text.split('```').map((part, i) => {
    if (i % 2 === 1) return part; // 代码块，不修改
    return part.replace(/([^\n#])(#{1,6}\s)/g, '$1\n$2');
  }).join('```');
}

/**
 * 将连续多个换行压缩为最多两个（保留段落分隔，避免插入笔记时产生过多空行）
 */
export function normalizeExcessiveNewlines(text: string): string {
  if (text == null || typeof text !== 'string') return '';
  return text.replace(/\n{3,}/g, '\n\n');
}
