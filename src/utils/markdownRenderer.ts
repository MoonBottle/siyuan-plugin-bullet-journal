/**
 * Markdown 渲染工具函数
 * 使用思源笔记内置的 Lute 渲染引擎替代 marked.js
 */

/**
 * 将 Markdown 内容渲染为 HTML
 * 优先使用思源的 Lute 引擎，不可用时降级为纯文本显示
 * @param content Markdown 内容
 * @returns 渲染后的 HTML 字符串
 */
export function renderMarkdown(content: string): string {
  // 尝试使用思源的 Lute 渲染引擎
  if (typeof window !== 'undefined' && window.Lute) {
    try {
      const lute = window.Lute.New();
      return lute.MarkdownStr('', content);
    } catch (error) {
      console.error('Lute rendering error:', error);
    }
  }

  // 降级处理：将内容作为纯文本显示
  return escapeHtml(content);
}

/**
 * HTML 转义函数
 * 将特殊字符转换为 HTML 实体，防止 XSS 攻击
 * @param text 原始文本
 * @returns 转义后的文本
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 检查 Lute 渲染器是否可用
 * @returns 如果 Lute 可用返回 true，否则返回 false
 */
export function isLuteAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.Lute;
}
