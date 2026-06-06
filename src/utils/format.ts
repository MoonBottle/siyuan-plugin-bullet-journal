/** 链接名称最大显示长度，超出则截断并 hover 显示全部 */
const LINK_NAME_MAX_LEN = 12

/** 格式化链接显示，返回截断后的 display 和可选的 fullText（用于 tooltip） */
export function formatLinkForDisplay(name: string): { display: string, fullText?: string } {
  if (!name || name.length <= LINK_NAME_MAX_LEN) {
    return { display: name }
  }
  return {
    display: `${name.slice(0, LINK_NAME_MAX_LEN)}...`,
    fullText: name,
  }
}
