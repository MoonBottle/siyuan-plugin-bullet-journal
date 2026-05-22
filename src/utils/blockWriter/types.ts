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

export interface BlockWriteContext {
  blockId: string;
  listItemBlockId?: string;
  protyle?: any;
  nodeElement?: HTMLElement;
  slashRange?: Range;
  slashStartOffset?: number;
}

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

export type StatusPatch = {
  type: 'setStatus';
  status: ItemStatus;
};

export type PriorityPatch = {
  type: 'setPriority';
  priority: PriorityLevel | undefined;
};

export type ContentPatch = {
  type: 'setContent';
  suffix?: string;
  newItemContent?: string;
};

export type FocusPlanPatch = {
  type: 'setFocusPlan';
  plan?: Pick<FocusPlan, 'type' | 'rawValue'>;
};

export type ReminderPatch = {
  type: 'setReminder';
  reminder?: ReminderConfig;
};

export type RecurringPatch = {
  type: 'setRecurring';
  repeatRule?: RepeatRule;
  endCondition?: EndCondition;
};

export type PinnedPatch = {
  type: 'togglePinned';
  pinned?: boolean;
};

export type SlashCommandPatch = {
  type: 'removeSlashCommand';
  suffix?: string;
};

export type HabitDefinitionPatch = {
  type: 'setHabitDefinition';
  habit: Partial<Habit>;
};

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

export type HabitArchivePatch = {
  type: 'setHabitArchive';
  archivedAt?: string;
};

export type ReplaceMarkdownPatch = {
  type: 'replaceMarkdown';
  markdown: string;
  preserveIAL?: boolean;
};

export type BlockPatch =
  | DatePatch
  | StatusPatch
  | PriorityPatch
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

export type BatchBlockPatch = BlockPatch[];
export type InsertableBlockPatch = HabitDefinitionPatch | HabitRecordPatch | ReplaceMarkdownPatch;
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
export type ResolvedMutationPlan =
  | {
      kind: 'update';
      targetBlockId: string;
      targetKind: 'paragraph' | 'task-list-item' | 'block';
      sourceKind: 'protyle-dom' | 'api-kramdown';
      commitKind: 'protyle-update' | 'api-update';
      preferDataType: 'dom';
      fallbackDataType: 'markdown';
      context: BlockWriteContext;
      patches: BlockPatch[];
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
export type CaretSnapshot =
  | {
      policy: 'wbr-first';
      containerBlockId: string;
      fallbackOffset?: {
        start: number;
        end: number;
      };
    }
  | {
      policy: 'none';
    };
export type LoadedMutationSource =
  | {
      kind: 'update';
      targetBlockId: string;
      currentMarkdown: string;
      currentDomHtml?: string;
      targetElement?: HTMLElement;
      caretSnapshot?: CaretSnapshot;
    }
  | {
      kind: 'insertAfter';
      anchorBlockId: string;
    };
export interface CaretRestorePlan {
  policy: 'none' | 'wbr';
  placement?: 'after-inserted-text' | 'after-inline' | 'placeholder-anchor' | 'block-end';
}
export type PreparedMutationPayload =
  | {
      kind: 'update';
      targetBlockId: string;
      nextMarkdown: string;
      preferredDataType: 'dom';
      domHtml?: string;
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

export interface KramdownBlockParts {
  contentLines: string[];
  ialLines: string[];
  raw: string;
}

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
