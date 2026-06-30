/**
 * Patch 序列归一化：按 PATCH_ORDER 定义的优先级排序 patch
 *
 * 排序逻辑：先按类型优先级排序，同类型保持原始顺序（稳定排序）
 * 设计决策：removeSlashCommand 必须最先执行（清除触发文本），
 * setContent 其次（更新基础内容），日期/提醒/循环等属性变更随后，
 * setStatus 最后（状态变更可能影响其他属性的渲染）
 */
import type { BlockPatch } from '@/utils/blockWriter/shared/types'

/** patch 类型执行优先级：数值越小越先执行 */
const PATCH_ORDER: Record<BlockPatch['type'], number> = {
  removeSlashCommand: 0,
  setContent: 10,
  addDate: 20,
  setReminder: 30,
  setRecurring: 40,
  setPriority: 50,
  setTaskTag: 55,
  setFocusPlan: 60,
  togglePinned: 70,
  setHabitArchive: 80,
  setStatus: 90,
  setHabitDefinition: 100,
  setHabitRecord: 110,
  replaceMarkdown: 120,
}

/** 对 patch 序列进行稳定排序，确保执行顺序符合依赖关系 */
export function normalizePatchSequence(patches: BlockPatch[]): BlockPatch[] {
  return patches
    .map((patch, index) => ({
      patch,
      index,
    }))
    .sort((a, b) => {
      const orderDelta = PATCH_ORDER[a.patch.type] - PATCH_ORDER[b.patch.type]
      return orderDelta !== 0 ? orderDelta : a.index - b.index
    })
    .map((entry) => entry.patch)
}
