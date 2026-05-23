/**
 * blockWriter 核心类型定义
 *
 * 类型贯穿整个变更流水线：
 * BlockPatch → BlockMutationIntent → MutationPatchUnit → MutationPatchCapability
 * → MutationExecutionPlan → LoadedMutationSource → PreparedMutationPayload
 */
import type {
  EndCondition,
  FocusPlan,
  Habit,
  HabitRecordStatus,
  ItemDateTimeInfo as ModelItemDateTimeInfo,
  ItemStatus,
  PriorityLevel,
  ReminderConfig,
  RepeatRule,
  TimePrecision,
} from '@/types/models';
import type { HabitCheckInTimePrecision } from '@/settings/types';

export type { ItemDateTimeInfo } from '@/types/models';

/** 块写入上下文：描述变更发生的位置和 DOM 环境 */
export interface BlockWriteContext {
  blockId: string;
  listItemBlockId?: string;
  protyle?: any;
  nodeElement?: HTMLElement;
  slashRange?: Range;
  slashStartOffset?: number;
  slashEndOffset?: number;
}

/** 日期变更：添加/替换日期标记，含时间精度和兄弟项上下文 */
export type DatePatch = {
  type: 'addDate';
  date: string;
  originalDate?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  timePrecision?: TimePrecision;
  siblingItems?: ModelItemDateTimeInfo[];
  status?: ItemStatus;
};

/** 状态变更：设置任务完成状态 */
export type StatusPatch = {
  type: 'setStatus';
  status: ItemStatus;
};

/** 优先级变更：设置或清除优先级 */
export type PriorityPatch = {
  type: 'setPriority';
  priority: PriorityLevel | undefined;
};

/** 内容变更：替换条目的文本内容 */
export type ContentPatch = {
  type: 'setContent';
  newItemContent?: string;
};

/** 任务标签变更：设置或清除任务标签 */
export type TaskTagPatch = {
  type: 'setTaskTag';
  tag?: string;
};

/** 专注计划变更：设置或清除专注计划 */
export type FocusPlanPatch = {
  type: 'setFocusPlan';
  plan?: Pick<FocusPlan, 'type' | 'rawValue'>;
};

/** 提醒变更：设置或清除提醒配置 */
export type ReminderPatch = {
  type: 'setReminder';
  reminder?: ReminderConfig;
};

/** 循环规则变更：设置或清除重复规则和终止条件 */
export type RecurringPatch = {
  type: 'setRecurring';
  repeatRule?: RepeatRule;
  endCondition?: EndCondition;
};

/** 置顶变更：切换条目的置顶状态 */
export type PinnedPatch = {
  type: 'togglePinned';
  pinned?: boolean;
};

/** 斜杠命令清除：移除用户输入的斜杠触发文本 */
export type SlashCommandPatch = {
  type: 'removeSlashCommand';
};

/** 习惯定义变更：设置习惯的属性 */
export type HabitDefinitionPatch = {
  type: 'setHabitDefinition';
  habit: Partial<Habit>;
};

/** 习惯打卡记录变更：写入一条习惯打卡数据 */
export type HabitRecordPatch = {
  type: 'setHabitRecord';
  record: {
    content: string;
    habitType: Habit['type'];
    date: string;
    value?: number;
    target?: number;
    unit?: string;
    precision?: HabitCheckInTimePrecision;
    recordStatus?: HabitRecordStatus;
  };
};

/** 习惯归档变更：设置习惯的归档时间 */
export type HabitArchivePatch = {
  type: 'setHabitArchive';
  archivedAt?: string;
};

/** Markdown 整块替换：用新 markdown 内容替换整个块，可选保留 IAL 属性 */
export type ReplaceMarkdownPatch = {
  type: 'replaceMarkdown';
  markdown: string;
  preserveIAL?: boolean;
};

/** 所有 patch 类型的联合类型，描述对块可执行的单项变更操作 */
export type BlockPatch =
  | DatePatch
  | StatusPatch
  | PriorityPatch
  | TaskTagPatch
  | ContentPatch
  | FocusPlanPatch
  | ReminderPatch
  | RecurringPatch
  | PinnedPatch
  | SlashCommandPatch
  | HabitDefinitionPatch
  | HabitRecordPatch
  | HabitArchivePatch
  | ReplaceMarkdownPatch;

/** 批量 patch：同一块上的多个变更 */
export type BatchBlockPatch = BlockPatch[];
/** 可用于插入操作的 patch 类型（仅支持整块替换语义的类型） */
export type InsertableBlockPatch = HabitDefinitionPatch | HabitRecordPatch | ReplaceMarkdownPatch;
/**
 * 变更意图：描述用户想要做什么
 * - update：更新已有块，携带上下文和 patch 列表
 * - insertAfter：在锚点块之后插入新块
 */
export type BlockMutationIntent =
  | {
      kind: 'update';
      context: BlockWriteContext;
      patches: BlockPatch[];
    }
  | {
      kind: 'insertAfter';
      anchorBlockId: string;
      patch: InsertableBlockPatch;
      context?: Partial<BlockWriteContext>;
      resultMode: 'boolean' | 'operations';
    };
/**
 * 解析后的变更计划：目标解析阶段输出
 * 确定了变更的目标块、数据来源、提交方式等关键决策
 * - sourceKind：数据来源（protyle-dom 优先，api-kramdown 兜底）
 * - commitKind：提交方式（protyle-update 优先，api-update 兜底）
 * - datePatchSource：日期 patch 的特殊源上下文
 */
export type ResolvedMutationPlan =
  | {
      kind: 'update';
      targetBlockId: string;
      targetKind: 'paragraph' | 'task-list-item' | 'block';
      sourceKind: 'protyle-dom' | 'api-kramdown';
      sourceBlockId?: string;
      commitKind: 'protyle-update' | 'api-update';
      preferDataType: 'dom';
      fallbackDataType: 'markdown';
      context: BlockWriteContext;
      patches: BlockPatch[];
      datePatchSource?: DatePatchSourceContext;
    }
  | {
      kind: 'insertAfter';
      anchorBlockId: string;
      commitKind: 'api-insert';
      preferDataType: 'dom';
      fallbackDataType: 'markdown';
      patch: InsertableBlockPatch;
      context?: Partial<BlockWriteContext>;
      resultMode: 'boolean' | 'operations';
    };
/** 光标快照：在变更前捕获光标位置，用于变更后恢复 */
export type CaretSnapshot =
  | {
      policy: 'wbr-first';
      containerBlockId: string;
      clonedHtmlWithWbr?: string;
      fallbackOffset?: {
        start: number;
        end: number;
      };
    }
  | {
      policy: 'none';
    };
/**
 * 已加载的变更源：源加载阶段输出
 * - protyle-dom 来源：包含当前 DOM HTML、目标元素和光标快照
 * - api-kramdown 来源：仅包含从 API 获取的 kramdown 文本
 */
export type LoadedMutationSource =
  | {
      kind: 'update';
      targetBlockId: string;
      sourceBlockId?: string;
      currentMarkdown: string;
      currentDomHtml?: string;
      targetElement?: HTMLElement;
      paragraphElement?: HTMLElement;
      caretSnapshot?: CaretSnapshot;
    }
  | {
      kind: 'insertAfter';
      anchorBlockId: string;
    };
/**
 * 光标恢复计划：描述变更提交后如何恢复光标位置
 * - wbr 策略：在 DOM 中注入 <wbr> 标记，提交后定位到该标记
 * - placement：光标放置位置（行尾、块尾、锚点文本后等）
 */
export interface CaretRestorePlan {
  policy: 'none' | 'wbr';
  placement?: 'after-inserted-text' | 'after-inline' | 'placeholder-anchor' | 'block-end' | 'line-end';
  anchorText?: string;
  targetOffset?: number;
  lineIndex?: number;
  fallbackOffset?: {
    start: number;
    end: number;
  };
}

/**
 * 日期 patch 源上下文：日期变更需要特殊处理
 * 因为日期标记可能位于父文档中而非当前块，需要记录源块和目标块的映射关系
 */
export interface DatePatchSourceContext {
  originalBlockId: string;
  sourceBlockId: string;
  sourceMarkdown: string;
  targetItemBlockRaw: string | null;
  usedParentDocumentContext: boolean;
  finalTargetBlockId: string;
}

/**
 * 准备好的提交载荷：渲染阶段输出
 * 包含最终要提交的 markdown、DOM HTML、transaction HTML 和光标恢复计划
 * - preferredDataType: dom — 优先用 DOM 提交（保留内联样式）
 * - fallbackDataType: markdown — DOM 提交失败时用 markdown 兜底
 */
export type PreparedMutationPayload =
  | {
      kind: 'update';
      targetBlockId: string;
      nextMarkdown: string;
      preferredDataType: 'dom';
      domHtml?: string;
      transactionDomHtml?: string;
      fallbackMarkdown: string;
      oldDomHtml?: string;
      targetElement?: HTMLElement;
      caretRestorePlan?: CaretRestorePlan;
    }
  | {
      kind: 'insertAfter';
      anchorBlockId: string;
      preferredDataType: 'dom';
      domHtml?: string;
      fallbackMarkdown: string;
      resultMode: 'boolean' | 'operations';
      caretRestorePlan?: CaretRestorePlan;
    };

/** Kramdown 块拆分结果：内容行与 IAL 属性行分离 */
export interface KramdownBlockParts {
  contentLines: string[];
  ialLines: string[];
  raw: string;
}

/** 目标解析结果：包含块的 kramdown 原文和替换模式 */
export interface ResolvedBlockTarget {
  originalBlockId: string;
  targetBlockId: string;
  targetType?: string;
  targetSubType?: string;
  fullKramdown: string;
  targetRaw: string;
  parts: KramdownBlockParts;
  replaceMode: 'whole-block' | 'raw-within-parent';
}

/**
 * 可规划单元：patch 在规划流水线中的最小调度单位
 * 同一 atomicGroup 内的 patch 不会被拆分到不同计划
 */
export interface MutationPatchUnit {
  index: number;
  patch: BlockPatch;
  intentKind: 'update' | 'insertAfter';
  atomicGroup?: string;
}

/**
 * 能力描述：标注每个 patch 单元的目标、来源、提交方式和约束
 * 用于规划阶段判断哪些 patch 可以合并到同一执行计划
 * - canSharePlan：是否可与前一个单元共享计划
 * - requiresCurrentDom：是否需要当前 DOM（protyle-dom 来源）
 * - canFallbackToApi：protyle 提交失败时是否可回退到 API
 */
export interface MutationPatchCapability {
  unit: MutationPatchUnit;
  targetBlockId?: string;
  targetKind?: 'paragraph' | 'task-list-item' | 'block';
  sourceKind: 'protyle-dom' | 'api-kramdown';
  sourceBlockId?: string;
  commitKind: 'protyle-update' | 'api-update' | 'api-insert';
  preferredCaretPolicy: 'none' | 'wbr';
  canSharePlan: boolean;
  requiresCurrentDom: boolean;
  canFallbackToApi: boolean;
  datePatchSource?: DatePatchSourceContext;
}

/**
 * 执行计划：规划器最终输出，描述一次原子性变更
 * - caretOwner：该计划是否负责光标恢复（仅最后一个 protyle-dom 计划拥有）
 * - atomicBoundary：single-commit = 不可拆分，split-subplan = 由拆分产生
 * - apiFallbackPlan：protyle 提交失败时的 API 回退方案
 */
export interface MutationExecutionPlan {
  id: string;
  kind: 'update' | 'insertAfter';
  resolvedPlan: ResolvedMutationPlan;
  targetBlockId?: string;
  targetKind?: 'paragraph' | 'task-list-item' | 'block';
  sourceKind: 'protyle-dom' | 'api-kramdown';
  sourceBlockId?: string;
  commitKind: 'protyle-update' | 'api-update' | 'api-insert';
  caretPolicy: 'none' | 'wbr';
  caretOwner: boolean;
  units: MutationPatchUnit[];
  order: number;
  atomicBoundary: 'single-commit' | 'split-subplan';
  context?: BlockWriteContext | Partial<BlockWriteContext>;
  anchorBlockId?: string;
  resultMode?: 'boolean' | 'operations';
  datePatchSource?: DatePatchSourceContext;
  apiFallbackPlan?: {
    sourceKind: 'api-kramdown';
    sourceBlockId: string;
    commitKind: 'api-update';
  };
}

/**
 * 规划结果：包含执行计划列表和拆分原因
 * reason 描述了为何产生多个计划（单计划 / 按目标拆分 / 按来源拆分 / 按提交方式拆分 / 按意图类型拆分）
 */
export interface MutationPlannerResult {
  plans: MutationExecutionPlan[];
  reason:
    | 'single-plan'
    | 'split-by-target'
    | 'split-by-source'
    | 'split-by-commit-kind'
    | 'split-by-intent-kind';
}
