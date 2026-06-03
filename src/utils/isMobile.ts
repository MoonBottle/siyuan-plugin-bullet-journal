import { getFrontend } from 'siyuan'

/**
 * 判断当前是否为移动端环境
 *
 * 统一收口移动端判断逻辑，避免散落在各处重复调用 getFrontend()。
 * 与 TaskAssistantPlugin.isMobile 保持一致的判断标准。
 */
export function isMobileDevice(): boolean {
  const frontend = getFrontend()
  return frontend === 'mobile' || frontend === 'browser-mobile'
}
