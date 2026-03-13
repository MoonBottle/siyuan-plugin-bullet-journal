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
 * 格式化 Markdown 内容
 * 使用 Lute 的 FormatMd 方法规范化 Markdown 格式
 * 包括：规范化标题格式、列表格式、代码块格式等
 * @param content Markdown 内容
 * @returns 格式化后的 Markdown 字符串
 */
export function formatMarkdown(content: string): string {
  if (typeof window !== 'undefined' && window.Lute) {
    try {
      const lute = window.Lute.New();
      // Lute 的 FormatMd 方法可以规范化 Markdown 格式
      if (typeof lute.FormatMd === 'function') {
        return lute.FormatMd(content);
      }
    } catch (error) {
      console.error('Lute format error:', error);
    }
  }
  // 降级：返回原内容
  return content;
}

/**
 * 智能格式化 Markdown 内容（用于插入笔记）
 * 结合 Lute 格式化和手动处理，确保最佳效果
 * @param content Markdown 内容
 * @returns 格式化后的 Markdown 字符串
 */
export function smartFormatMarkdown(content: string): string {
  // 首先使用 Lute 格式化（如果可用）
  let formatted = formatMarkdown(content);

  // 额外的手动处理：压缩多余空行
  formatted = normalizeExcessiveNewlines(formatted);

  return formatted;
}

/**
 * 将连续多个换行压缩为最多两个（保留段落分隔，避免插入笔记时产生过多空行）
 */
function normalizeExcessiveNewlines(text: string): string {
  if (text == null || typeof text !== 'string') return '';
  return text.replace(/\n{3,}/g, '\n\n');
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
