/**
 * 事项设置工具函数
 * 用于保存提醒和重复设置到 SiYuan 块
 */

import type {
  Item,
  FocusPlan,
  ReminderConfig,
  RepeatRule,
  EndCondition,
  PriorityLevel
} from '@/types/models';
import {
  generateReminderMarker,
} from '@/parser/reminderParser';
import {
  generateRepeatRuleMarker,
  generateEndConditionMarker,
} from '@/parser/recurringParser';
import { generatePriorityMarker } from '@/parser/priorityParser';
import { writeBlock } from '@/utils/blockWriter';
import type { BlockPatch, BlockWriteContext } from '@/utils/blockWriter';
import { eventBus, Events } from '@/utils/eventBus';

/**
 * 构建设置项内容选项
 */
export interface BuildItemContentOptions {
  /** 开始时间 (HH:mm) */
  startTime?: string;
  /** 结束时间 (HH:mm) */
  endTime?: string;
  /** 优先级 */
  priority?: PriorityLevel;
  /** 提醒配置 */
  reminder?: ReminderConfig;
  /** 重复规则 */
  repeatRule?: RepeatRule;
  /** 结束条件 */
  endCondition?: EndCondition;
}

export interface ItemSettingWriteOptions {
  writeContext?: BlockWriteContext;
  leadingPatches?: BlockPatch[];
}

function buildWritePayload(
  patch: BlockPatch,
  options?: ItemSettingWriteOptions,
): BlockPatch | BlockPatch[] {
  if (!options?.leadingPatches?.length) {
    return patch;
  }

  return [...options.leadingPatches, patch];
}

function buildWriteContext(
  item: Item,
  options?: ItemSettingWriteOptions,
): BlockWriteContext {
  return options?.writeContext ?? { blockId: item.blockId! };
}

function emitItemSettingMutation(
  kind: 'reminder' | 'recurring' | 'pin' | 'focus-plan',
  blockId: string,
): void {
  eventBus.emit(Events.LOCAL_DATA_MUTATED, {
    source: 'item-setting',
    kind,
    blockId,
  });
}

/**
 * 更新事项的提醒设置
 * @param item 事项对象
 * @param config 提醒配置
 */
export async function updateItemWithReminder(
  item: Item,
  config: ReminderConfig,
  options?: ItemSettingWriteOptions,
): Promise<void> {
  if (!item.blockId) {
    throw new Error('事项缺少 blockId，无法更新');
  }

  const updated = await writeBlock(
    buildWriteContext(item, options),
    buildWritePayload({ type: 'setReminder', reminder: config }, options),
  );
  if (!updated) {
    throw new Error(`更新块内容失败 (${item.blockId})`);
  }
  emitItemSettingMutation('reminder', item.blockId);
}

/**
 * 更新事项的重复设置
 * @param item 事项对象
 * @param repeatRule 重复规则（可选）
 * @param endCondition 结束条件（可选）
 */
export async function updateItemWithRecurring(
  item: Item,
  repeatRule?: RepeatRule,
  endCondition?: EndCondition,
  options?: ItemSettingWriteOptions,
): Promise<void> {
  if (!item.blockId) {
    throw new Error('事项缺少 blockId，无法更新');
  }

  const updated = await writeBlock(
    buildWriteContext(item, options),
    buildWritePayload({ type: 'setRecurring', repeatRule, endCondition }, options),
  );
  if (!updated) {
    throw new Error(`更新块内容失败 (${item.blockId})`);
  }
  emitItemSettingMutation('recurring', item.blockId);
}

export async function toggleItemPinned(item: Item): Promise<void> {
  if (!item.blockId) {
    throw new Error('事项缺少 blockId，无法更新');
  }

  const updated = await writeBlock(
    { blockId: item.blockId },
    { type: 'togglePinned' },
  );
  if (!updated) {
    throw new Error(`更新块内容失败 (${item.blockId})`);
  }
  emitItemSettingMutation('pin', item.blockId);
}

export async function updateItemWithFocusPlan(
  item: Item,
  plan: Pick<FocusPlan, 'type' | 'rawValue'>,
  options?: ItemSettingWriteOptions,
): Promise<void> {
  if (!item.blockId) {
    throw new Error('事项缺少 blockId，无法更新');
  }

  const updated = await writeBlock(
    buildWriteContext(item, options),
    buildWritePayload({ type: 'setFocusPlan', plan }, options),
  );
  if (!updated) {
    throw new Error(`更新块内容失败 (${item.blockId})`);
  }
  emitItemSettingMutation('focus-plan', item.blockId);
}

export async function clearItemFocusPlan(item: Item, options?: ItemSettingWriteOptions): Promise<void> {
  if (!item.blockId) {
    throw new Error('事项缺少 blockId，无法更新');
  }

  const updated = await writeBlock(
    buildWriteContext(item, options),
    buildWritePayload({ type: 'setFocusPlan' }, options),
  );
  if (!updated) {
    throw new Error(`更新块内容失败 (${item.blockId})`);
  }
  emitItemSettingMutation('focus-plan', item.blockId);
}

/**
 * 构建完整的事项内容
 * 用于 QuickCreate 功能，组合日期、优先级、提醒、重复等标记
 *
 * @param baseContent 基础内容（不含标记）
 * @param date 日期 (YYYY-MM-DD)
 * @param options 设置选项
 * @returns 完整的 markdown 内容
 */
export function buildItemContent(
  baseContent: string,
  date: string,
  options: BuildItemContentOptions = {}
): string {
  const { startTime, endTime, priority, reminder, repeatRule, endCondition } = options;

  // 构建日期部分（支持时间范围）
  let datePart = `📅${date}`;
  if (startTime && endTime) {
    datePart = `📅${date} ${startTime}~${endTime}`;
  } else if (startTime) {
    datePart = `📅${date} ${startTime}`;
  }
  let content = `${baseContent} ${datePart}`;

  // 添加优先级标记
  if (priority) {
    const priorityMarker = generatePriorityMarker(priority);
    if (priorityMarker) {
      content = `${content} ${priorityMarker}`;
    }
  }

  // 添加提醒标记
  if (reminder?.enabled) {
    const reminderMarker = generateReminderMarker(reminder);
    if (reminderMarker) {
      content = `${content} ${reminderMarker}`;
    }
  }

  // 添加重复规则标记
  if (repeatRule) {
    const repeatMarker = generateRepeatRuleMarker(repeatRule);
    if (repeatMarker) {
      content = `${content} ${repeatMarker}`;
    }
  }

  // 添加结束条件标记
  if (endCondition && endCondition.type !== 'never') {
    const endMarker = generateEndConditionMarker(endCondition);
    if (endMarker) {
      content = `${content} ${endMarker}`;
    }
  }

  return content;
}
