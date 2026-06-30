import type { ProjectDirectory } from '@/types/models'

/**
 * 根据文档路径匹配目录配置，返回对应的分组 ID
 * 使用最长路径优先匹配策略
 *
 * @param docPath 文档路径（如 "工作/项目/重要/A项目"）
 * @param directories 目录配置列表
 * @returns 匹配的分组 ID，未匹配返回 undefined
 */
export function matchGroupId(
  docPath: string,
  directories: ProjectDirectory[],
): string | undefined {
  const enabledDirs = directories.filter((d) => d.enabled)

  if (enabledDirs.length === 0) {
    return undefined
  }

  // 按路径长度降序排序，确保最长路径优先匹配
  const sortedDirs = [...enabledDirs].sort((a, b) => b.path.length - a.path.length)

  const matched = sortedDirs.find((d) => docPath.startsWith(d.path))
  return matched?.groupId
}

/**
 * 判断文档路径是否被未启用的目录排除
 * 在全库扫描模式下，未启用目录路径下的文档将被排除
 *
 * @param docPath 文档路径（hpath）
 * @param directories 所有目录配置（含启用和未启用的）
 * @returns true 表示该文档应被排除
 */
export function isExcludedByDisabledDirectories(
  docPath: string,
  directories: ProjectDirectory[],
): boolean {
  const disabledDirs = directories.filter((d) => !d.enabled)
  if (disabledDirs.length === 0) return false

  // 按路径长度降序排序，确保最长路径优先匹配
  const sorted = [...disabledDirs].sort((a, b) => b.path.length - a.path.length)
  return sorted.some((d) => docPath.startsWith(d.path))
}
